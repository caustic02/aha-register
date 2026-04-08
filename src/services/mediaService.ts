import type { SQLiteDatabase } from 'expo-sqlite';
import { File, Paths } from 'expo-file-system';

import { generateId } from '../utils/uuid';
import { computeSHA256 } from '../utils/hash';
import { logAuditEntry } from '../db/audit';
import { SyncEngine } from '../sync/engine';
import { getSetting, SETTING_KEYS } from './settingsService';
import type { Media } from '../db/types';
import { uploadAndRecordStoragePath } from './storage-upload';
import { supabase } from './supabase';

/**
 * Returns all media rows for an object, ordered by is_primary DESC, sort_order ASC.
 */
export async function getMediaForObject(
  db: SQLiteDatabase,
  objectId: string,
): Promise<Media[]> {
  return db.getAllAsync<Media>(
    'SELECT * FROM media WHERE object_id = ? ORDER BY is_primary DESC, sort_order ASC',
    [objectId],
  );
}

/**
 * Adds a new media record to an existing object.
 * Copies file to app storage, computes SHA-256 on raw bytes,
 * and wraps all DB writes in a transaction.
 */
export async function addMediaToObject(
  db: SQLiteDatabase,
  objectId: string,
  imageUri: string,
  mimeType: string,
  options?: { caption?: string; fileName?: string; fileSize?: number },
): Promise<Media> {
  const mediaId = generateId();
  const now = new Date().toISOString();

  // 1. Copy image to app storage
  const ext = mimeType.split('/')[1] ?? 'jpg';
  const storageName = `${mediaId}.${ext}`;
  const storageDir = `${Paths.document.uri}media/`;
  const destUri = `${storageDir}${storageName}`;

  const srcFile = new File(imageUri);
  const destFile = new File(destUri);
  const parentDir = destFile.parentDirectory;
  if (!parentDir.exists) {
    parentDir.create({ intermediates: true, idempotent: true });
  }
  srcFile.copy(destFile);
  // Validate copy succeeded — expo-file-system File.copy() silently discards
  // the Kotlin copyRecursively() return value, so an I/O failure won't throw.
  if (!destFile.exists) {
    throw new Error('FILE_COPY_FAILED: destination file missing after copy');
  }

  // 2. Compute SHA-256 hash on raw bytes
  const sha256 = await computeSHA256(destUri);

  // 3. Read default privacy tier from settings
  const privacyTier =
    (await getSetting(db, SETTING_KEYS.DEFAULT_PRIVACY_TIER)) ?? 'public';

  // 4. Determine next sort_order and whether this photo should become primary.
  // If the object has no primary media yet, this new photo is promoted to
  // primary so the list-screen thumbnail query (is_primary = 1) finds it.
  const existingRow = await db.getFirstAsync<{ maxSort: number | null; hasPrimary: number }>(
    `SELECT MAX(sort_order) AS maxSort,
            COALESCE(MAX(CASE WHEN is_primary = 1 THEN 1 ELSE 0 END), 0) AS hasPrimary
     FROM media WHERE object_id = ?`,
    [objectId],
  );
  const nextSort = (existingRow?.maxSort ?? -1) + 1;
  const isPrimary = existingRow?.hasPrimary ? 0 : 1;

  // 5. Normalize file type
  const fileType = mimeType.split('/')[0];
  const normalizedFileType =
    fileType === 'image' || fileType === 'video' || fileType === 'audio'
      ? fileType
      : 'document';

  // 6. All DB writes in a single transaction
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO media
         (id, object_id, file_path, file_name, file_type, mime_type, file_size,
          sha256_hash, caption, privacy_tier, is_primary, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        mediaId,
        objectId,
        destUri,
        options?.fileName ?? storageName,
        normalizedFileType,
        mimeType,
        options?.fileSize ?? null,
        sha256,
        options?.caption ?? null,
        privacyTier,
        isPrimary,
        nextSort,
        now,
        now,
      ],
    );

    await logAuditEntry(db, {
      tableName: 'media',
      recordId: mediaId,
      action: 'insert',
      newValues: { objectId, mediaId, sha256 },
    });

    const syncEngine = new SyncEngine(db);
    await syncEngine.queueChange('media', mediaId, 'insert', {
      objectId,
      mediaId,
    });
  });

  // Fire-and-forget: upload to Supabase Storage in background
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session?.user?.id) {
      uploadAndRecordStoragePath(
        db, mediaId, destUri, session.user.id, objectId, ext,
      ).catch(() => {});
    }
  }).catch(() => {});

  // Return the inserted record
  const inserted = await db.getFirstAsync<Media>(
    'SELECT * FROM media WHERE id = ?',
    [mediaId],
  );
  return inserted!;
}

/**
 * Sets a media record as the primary display image for its object.
 * Clears is_primary on all other media for the same object.
 */
export async function setAsPrimary(
  db: SQLiteDatabase,
  mediaId: string,
  objectId: string,
): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'UPDATE media SET is_primary = 0, updated_at = ? WHERE object_id = ?',
      [new Date().toISOString(), objectId],
    );
    await db.runAsync(
      'UPDATE media SET is_primary = 1, updated_at = ? WHERE id = ?',
      [new Date().toISOString(), mediaId],
    );

    await logAuditEntry(db, {
      tableName: 'media',
      recordId: mediaId,
      action: 'update',
      newValues: { is_primary: 1 },
    });
  });
}

/**
 * Deletes a media record and its file from storage.
 * Will not delete the last remaining media for an object.
 * If the deleted media was primary, promotes the next one.
 */
export async function deleteMedia(
  db: SQLiteDatabase,
  mediaId: string,
): Promise<void> {
  const row = await db.getFirstAsync<Media>(
    'SELECT * FROM media WHERE id = ?',
    [mediaId],
  );
  if (!row) return;

  // Don't allow deleting the only media
  const countRow = await db.getFirstAsync<{ c: number }>(
    'SELECT COUNT(*) as c FROM media WHERE object_id = ?',
    [row.object_id],
  );
  if ((countRow?.c ?? 0) <= 1) {
    throw new Error('LAST_MEDIA');
  }

  const wasPrimary = row.is_primary === 1;

  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM media WHERE id = ?', [mediaId]);

    // If it was primary, promote the next one
    if (wasPrimary) {
      const next = await db.getFirstAsync<{ id: string }>(
        'SELECT id FROM media WHERE object_id = ? ORDER BY sort_order ASC LIMIT 1',
        [row.object_id],
      );
      if (next) {
        await db.runAsync(
          'UPDATE media SET is_primary = 1, updated_at = ? WHERE id = ?',
          [new Date().toISOString(), next.id],
        );
      }
    }

    await logAuditEntry(db, {
      tableName: 'media',
      recordId: mediaId,
      action: 'delete',
      oldValues: { file_path: row.file_path, sha256_hash: row.sha256_hash },
    });

    const syncEngine = new SyncEngine(db);
    await syncEngine.queueChange('media', mediaId, 'delete', {
      objectId: row.object_id,
    });
  });

  // Delete file from storage (outside transaction — DB is source of truth)
  try {
    const file = new File(row.file_path);
    if (file.exists) {
      file.delete();
    }
  } catch {
    // File cleanup is best-effort
  }
}
