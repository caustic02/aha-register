import type { SQLiteDatabase } from 'expo-sqlite';
import { File } from 'expo-file-system';

import { generateId } from '../utils/uuid';
import { computeSHA256 } from '../utils/hash';
import { logAuditEntry } from '../db/audit';
import { SyncEngine } from '../sync/engine';
import { getSetting, SETTING_KEYS } from './settingsService';
import { copyToMediaStorage, buildStorageName, normalizeFileType } from './captureHelpers';
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
  const storageName = buildStorageName(mediaId, params.mimeType);
  let destUri: string;

  try {
    const srcFile = new File(params.imageUri);
    if (!srcFile.exists) {
      throw new Error(`Source file does not exist: ${params.imageUri}`);
    }
    destUri = copyToMediaStorage(params.imageUri, mediaId, params.mimeType);
    const destFile = new File(destUri);
    if (!destFile.exists) {
      throw new Error(`File copy produced no output at: ${destUri}`);
    }
  } catch (err) {
    console.error('[saveReviewedObject] step 1 FAILED: file copy', {
      imageUri: params.imageUri,
      error: err,
    });
    throw new Error(`Step 1 failed: file copy — ${err instanceof Error ? err.message : String(err)}`);
  }

  // ── 2. Compute SHA-256 on the stored copy (SACRED: hash before insert) ──
  let sha256: string;
  try {
    sha256 = await computeSHA256(destUri);
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
  const normalizedFileType = normalizeFileType(params.mimeType);

  // ── 6-9. Single atomic transaction ──────────────────────────────────────
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
    } catch (err) {
      throw new Error(`Step 9 failed: sync queue — ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  return objectId;
}

// ── Update reviewed object (review-existing path for quick captures) ─────────

export interface UpdateReviewedObjectParams {
  objectId: string;
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
 * Updates an existing quick-captured object with full review metadata.
 * Does NOT copy the image or recompute the hash — those are sacred from quick capture.
 * Sets review_status = 'complete'.
 */
export async function updateReviewedObject(
  db: SQLiteDatabase,
  params: UpdateReviewedObjectParams,
): Promise<void> {
  const now = new Date().toISOString();

  // Build type-specific JSON
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

  await db.withTransactionAsync(async () => {
    // UPDATE object with full metadata
    await db.runAsync(
      `UPDATE objects SET
         object_type = ?,
         title = ?,
         description = ?,
         type_specific_data = ?,
         review_status = 'complete',
         updated_at = ?
       WHERE id = ?`,
      [
        params.objectType || 'museum_object',
        params.title || 'Untitled',
        params.description || null,
        typeSpecificData,
        now,
        params.objectId,
      ],
    );

    // Audit trail
    await logAuditEntry(db, {
      tableName: 'objects',
      recordId: params.objectId,
      action: 'review_complete',
      newValues: {
        title: params.title,
        objectType: params.objectType,
      },
    });

    // Queue sync
    const syncEngine = new SyncEngine(db);
    await syncEngine.queueChange('objects', params.objectId, 'update', {
      objectId: params.objectId,
      reviewStatus: 'complete',
    });
  });
}

// ── Review status transitions ────────────────────────────────────────────────

import type { ReviewStatus } from '../db/types';

/**
 * Transitions an object's review_status and logs an audit entry.
 */
export async function updateReviewStatus(
  db: SQLiteDatabase,
  objectId: string,
  status: ReviewStatus,
): Promise<void> {
  const now = new Date().toISOString();
  await db.runAsync(
    'UPDATE objects SET review_status = ?, updated_at = ? WHERE id = ?',
    [status, now, objectId],
  );
  await logAuditEntry(db, {
    tableName: 'objects',
    recordId: objectId,
    action: `review_status_${status}`,
    newValues: { review_status: status },
  });
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
