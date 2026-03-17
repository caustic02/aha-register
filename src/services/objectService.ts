import type { SQLiteDatabase } from 'expo-sqlite';
import { File, Paths } from 'expo-file-system';

import { generateId } from '../utils/uuid';
import { computeSHA256 } from '../utils/hash';
import { logAuditEntry } from '../db/audit';
import { SyncEngine } from '../sync/engine';
import { getSetting, SETTING_KEYS } from './settingsService';
import type { CaptureMetadata } from './metadata';

// ── Save reviewed object ────────────────────────────────────────────────────

export interface SaveReviewedObjectParams {
  imageUri: string;
  mimeType: string;
  captureMetadata: CaptureMetadata;
  title: string;
  objectType: string;
  description?: string;
  condition?: string;
  dateCreated?: string;
  medium?: string;
  dimensions?: string;
  stylePeriod?: string;
  cultureOrigin?: string;
  keywords?: string[];
}

/**
 * Persists a fully-reviewed object from the AI review card.
 * Follows the same atomic pattern as createDraftObject:
 *   copy → hash → transaction(insert object + media + audit + sync)
 *
 * SHA-256 is computed on the stored copy BEFORE any database write.
 */
export async function saveReviewedObject(
  db: SQLiteDatabase,
  params: SaveReviewedObjectParams,
): Promise<string> {
  const objectId = generateId();
  const mediaId = generateId();
  const now = new Date().toISOString();

  // ── 1. Copy image to app storage ────────────────────────────────────────
  const ext = params.mimeType.split('/')[1] ?? 'jpg';
  const storageName = `${mediaId}.${ext}`;
  const storageDir = `${Paths.document.uri}media/`;
  const destUri = `${storageDir}${storageName}`;

  console.log('[saveReviewedObject] step 1: copy image', {
    src: params.imageUri,
    dest: destUri,
  });

  try {
    const srcFile = new File(params.imageUri);
    if (!srcFile.exists) {
      throw new Error(`Source file does not exist: ${params.imageUri}`);
    }
    const destFile = new File(destUri);
    const parentDir = destFile.parentDirectory;
    if (!parentDir.exists) {
      parentDir.create({ intermediates: true, idempotent: true });
    }
    srcFile.copy(destFile);
    if (!destFile.exists) {
      throw new Error(`File copy produced no output at: ${destUri}`);
    }
  } catch (err) {
    console.error('[saveReviewedObject] step 1 FAILED: file copy', {
      imageUri: params.imageUri,
      destUri,
      error: err,
    });
    throw new Error(`Step 1 failed: file copy — ${err instanceof Error ? err.message : String(err)}`);
  }

  // ── 2. Compute SHA-256 on the stored copy (SACRED: hash before insert) ──
  let sha256: string;
  try {
    sha256 = await computeSHA256(destUri);
    console.log('[saveReviewedObject] step 2: SHA-256 computed', sha256.slice(0, 16));
  } catch (err) {
    console.error('[saveReviewedObject] step 2 FAILED: SHA-256', { destUri, error: err });
    throw new Error(`Step 2 failed: SHA-256 hash — ${err instanceof Error ? err.message : String(err)}`);
  }

  // ── 3. Read default privacy tier ────────────────────────────────────────
  const privacyTier =
    (await getSetting(db, SETTING_KEYS.DEFAULT_PRIVACY_TIER)) ?? 'public';

  // ── 4. Build type-specific JSON for extra AI metadata ───────────────────
  const extras: Record<string, unknown> = {};
  if (params.dateCreated) extras.dateCreated = params.dateCreated;
  if (params.medium) extras.medium = params.medium;
  if (params.dimensions) extras.dimensions = params.dimensions;
  if (params.stylePeriod) extras.stylePeriod = params.stylePeriod;
  if (params.cultureOrigin) extras.cultureOrigin = params.cultureOrigin;
  if (params.condition) extras.condition = params.condition;
  if (params.keywords?.length) extras.keywords = params.keywords;
  const typeSpecificData = Object.keys(extras).length > 0
    ? JSON.stringify(extras)
    : null;

  // ── 5. File type normalization ──────────────────────────────────────────
  const fileType = params.mimeType.split('/')[0];
  const normalizedFileType =
    fileType === 'image' || fileType === 'video' || fileType === 'audio'
      ? fileType
      : 'document';

  // ── 6-9. Single atomic transaction ──────────────────────────────────────
  console.log('[saveReviewedObject] step 6: starting transaction', {
    objectId,
    mediaId,
    objectType: params.objectType,
    privacyTier,
  });

  await db.withTransactionAsync(async () => {
    // 6. INSERT object
    try {
      await db.runAsync(
        `INSERT INTO objects
           (id, object_type, status, title, description,
            latitude, longitude, altitude,
            coordinate_accuracy, coordinate_source,
            privacy_tier, legal_hold, type_specific_data,
            created_at, updated_at)
         VALUES (?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
        [
          objectId,
          params.objectType || 'museum_object',
          params.title || 'Untitled',
          params.description || null,
          params.captureMetadata.latitude ?? null,
          params.captureMetadata.longitude ?? null,
          params.captureMetadata.altitude ?? null,
          params.captureMetadata.accuracy ?? null,
          params.captureMetadata.coordinateSource ?? null,
          privacyTier,
          typeSpecificData,
          now,
          now,
        ],
      );
      console.log('[saveReviewedObject] step 6: object inserted');
    } catch (err) {
      throw new Error(`Step 6 failed: INSERT objects — ${err instanceof Error ? err.message : String(err)}`);
    }

    // 7. INSERT media
    try {
      await db.runAsync(
        `INSERT INTO media
           (id, object_id, file_path, file_name, file_type, mime_type,
            sha256_hash, privacy_tier, is_primary, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?)`,
        [
          mediaId,
          objectId,
          destUri,
          storageName,
          normalizedFileType,
          params.mimeType,
          sha256,
          privacyTier,
          now,
          now,
        ],
      );
      console.log('[saveReviewedObject] step 7: media inserted');
    } catch (err) {
      throw new Error(`Step 7 failed: INSERT media — ${err instanceof Error ? err.message : String(err)}`);
    }

    // 8. Audit trail
    try {
      await logAuditEntry(db, {
        tableName: 'objects',
        recordId: objectId,
        action: 'insert',
        newValues: { objectId, mediaId, sha256, title: params.title },
        deviceInfo: {
          model: params.captureMetadata.deviceModel,
          os: params.captureMetadata.osVersion,
          app: params.captureMetadata.appVersion,
        },
      });
      console.log('[saveReviewedObject] step 8: audit logged');
    } catch (err) {
      throw new Error(`Step 8 failed: audit trail — ${err instanceof Error ? err.message : String(err)}`);
    }

    // 9. Queue sync
    try {
      const syncEngine = new SyncEngine(db);
      await syncEngine.queueChange('objects', objectId, 'insert', {
        objectId,
        mediaId,
      });
      console.log('[saveReviewedObject] step 9: sync queued');
    } catch (err) {
      throw new Error(`Step 9 failed: sync queue — ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  console.log('[saveReviewedObject] SUCCESS objectId=', objectId);
  return objectId;
}

/**
 * Deletes an object and all associated data.
 * Media files are removed from the filesystem first (best-effort).
 * The DB DELETE cascades to: media rows, object_collections, annotations, documents.
 */
export async function deleteObject(
  db: SQLiteDatabase,
  objectId: string,
): Promise<void> {
  // 1. Collect all media file paths before deletion
  const mediaRows = await db.getAllAsync<{ id: string; file_path: string }>(
    'SELECT id, file_path FROM media WHERE object_id = ?',
    [objectId],
  );

  // 2. Log audit entry before the DELETE (record still exists at this point)
  await logAuditEntry(db, {
    tableName: 'objects',
    recordId: objectId,
    action: 'delete',
    oldValues: { mediaCount: mediaRows.length },
  });

  // 3. Delete the object — cascades to media rows, object_collections, annotations
  await db.runAsync('DELETE FROM objects WHERE id = ?', [objectId]);

  // 4. Delete media files from filesystem (best-effort, outside transaction)
  for (const row of mediaRows) {
    try {
      const file = new File(row.file_path);
      if (file.exists) {
        file.delete();
      }
    } catch {
      // File cleanup is best-effort; DB is source of truth
    }
  }
}
