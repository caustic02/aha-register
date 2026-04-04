/**
 * Quick-capture service for non-blocking capture (B2).
 *
 * Persists a photo with the absolute minimum metadata needed:
 *   copy → SHA-256 → single transaction (object + media + audit + sync)
 *
 * No AI call, no type selection, no user-entered metadata.
 * SHA-256 is SACRED: computed on the stored copy before any DB write.
 */
import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

import { generateId } from '../utils/uuid';
import { computeSHA256 } from '../utils/hash';
import { logAuditEntry } from '../db/audit';
import { SyncEngine } from '../sync/engine';
import { getSetting, SETTING_KEYS } from './settingsService';
import { copyToMediaStorage, buildStorageName, normalizeFileType } from './captureHelpers';
import { uploadAndRecordStoragePath } from './storage-upload';
import { supabase } from './supabase';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LocationData {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;
  coordinateSource: 'exif' | 'gps_hardware';
}

// ── Quick capture ─────────────────────────────────────────────────────────────

/**
 * Persists a capture with minimal metadata. Returns the new object ID.
 *
 * 1. Generate UUIDs
 * 2. Copy image to app storage
 * 3. Compute SHA-256 on stored copy (SACRED: before any DB write)
 * 4. Read default privacy tier
 * 5. Single transaction: objects + media + audit_trail + sync_queue
 */
export async function quickCapture(
  db: SQLiteDatabase,
  photoUri: string,
  location: LocationData | null,
): Promise<string> {
  const objectId = generateId();
  const mediaId = generateId();
  const now = new Date().toISOString();
  const mimeType = 'image/jpeg';

  // 1. Copy image to app storage
  const storageName = buildStorageName(mediaId, mimeType);
  const destUri = copyToMediaStorage(photoUri, mediaId, mimeType);

  // 2. SHA-256 on the stored copy — SACRED: happens before any DB write
  const sha256 = await computeSHA256(destUri);

  // 3. Read default privacy tier from settings
  const privacyTier =
    (await getSetting(db, SETTING_KEYS.DEFAULT_PRIVACY_TIER)) ?? 'public';

  // 4. Single atomic transaction
  const normalizedFileType = normalizeFileType(mimeType);

  await db.withTransactionAsync(async () => {
    // INSERT object — minimal fields, review_status = 'needs_review'
    await db.runAsync(
      `INSERT INTO objects
         (id, object_type, status, title, review_status,
          latitude, longitude, altitude,
          coordinate_accuracy, coordinate_source,
          privacy_tier, legal_hold, created_at, updated_at)
       VALUES (?, 'uncategorized', 'draft', 'Untitled Object', 'needs_review',
               ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      [
        objectId,
        location?.latitude ?? null,
        location?.longitude ?? null,
        location?.altitude ?? null,
        location?.accuracy ?? null,
        location?.coordinateSource ?? null,
        privacyTier,
        now,
        now,
      ],
    );

    // INSERT media
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
        mimeType,
        sha256,
        privacyTier,
        now,
        now,
      ],
    );

    // Audit trail
    await logAuditEntry(db, {
      tableName: 'objects',
      recordId: objectId,
      action: 'quick_capture',
      newValues: { objectId, mediaId, sha256 },
      deviceInfo: {
        model: `${Platform.OS} device`,
        os: `${Platform.OS} ${Platform.Version}`,
      },
    });

    // Sync queue — both object AND media
    const syncEngine = new SyncEngine(db);
    await syncEngine.queueChange('objects', objectId, 'insert', {});
    await syncEngine.queueChange('media', mediaId, 'insert', {});
  });

  // Fire-and-forget: upload to Supabase Storage in background
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session?.user?.id) {
      const ext = mimeType.split('/')[1] ?? 'jpg';
      uploadAndRecordStoragePath(
        db, mediaId, destUri, session.user.id, objectId, ext,
      ).catch(() => {});
    }
  }).catch(() => {});

  return objectId;
}
