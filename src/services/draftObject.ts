import type { SQLiteDatabase } from 'expo-sqlite';

import { generateId } from '../utils/uuid';
import { computeSHA256 } from '../utils/hash';
import { logAuditEntry } from '../db/audit';
import { SyncEngine } from '../sync/engine';
import type { CaptureMetadata } from './metadata';
import { getSetting, SETTING_KEYS } from './settingsService';
import { copyToMediaStorage, buildStorageName, normalizeFileType } from './captureHelpers';

export interface CreateDraftParams {
  imageUri: string;
  fileName: string | null;
  fileSize: number | null;
  mimeType: string;
  metadata: CaptureMetadata;
  objectType?: string;
}

/**
 * Creates a draft object + media record from a captured/picked image.
 * Returns the new object ID.
 */
export async function createDraftObject(
  db: SQLiteDatabase,
  params: CreateDraftParams,
): Promise<string> {
  const objectId = generateId();
  const mediaId = generateId();
  const now = new Date().toISOString();

  // 1. Copy image to app storage
  const storageName = buildStorageName(mediaId, params.mimeType);
  const destUri = copyToMediaStorage(params.imageUri, mediaId, params.mimeType);

  // 2. Compute SHA-256 hash
  const sha256 = await computeSHA256(destUri);

  // 2b. Read default privacy tier from settings
  const privacyTier =
    (await getSetting(db, SETTING_KEYS.DEFAULT_PRIVACY_TIER)) ?? 'public';

  // 2c. Build device metadata for type_specific_data
  const deviceData: Record<string, string> = {};
  if (params.metadata.deviceModel != null) deviceData.model = params.metadata.deviceModel;
  if (params.metadata.deviceManufacturer != null) deviceData.manufacturer = params.metadata.deviceManufacturer;
  if (params.metadata.osName != null && params.metadata.osVersion != null) {
    deviceData.os = `${params.metadata.osName} ${params.metadata.osVersion}`;
  }
  if (params.metadata.appVersion != null) deviceData.appVersion = params.metadata.appVersion;
  if (params.metadata.deviceId != null) deviceData.deviceId = params.metadata.deviceId;

  const typeSpecificData = JSON.stringify({ device: deviceData });

  // 3-6. All database writes in a single transaction.
  // If any INSERT fails, the entire capture rolls back cleanly.
  const normalizedFileType = normalizeFileType(params.mimeType);

  await db.withTransactionAsync(async () => {
    // 3. Insert object record
    await db.runAsync(
      `INSERT INTO objects
         (id, object_type, status, title, latitude, longitude, altitude,
          coordinate_accuracy, coordinate_source, privacy_tier,
          type_specific_data, legal_hold, created_at, updated_at)
       VALUES (?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      [
        objectId,
        params.objectType ?? 'museum_object',
        'Untitled',
        params.metadata.latitude ?? null,
        params.metadata.longitude ?? null,
        params.metadata.altitude ?? null,
        params.metadata.accuracy ?? null,
        params.metadata.coordinateSource ?? null,
        privacyTier,
        typeSpecificData,
        now,
        now,
      ],
    );

    // 4. Insert media record (is_primary=1 → primary display image)
    await db.runAsync(
      `INSERT INTO media
         (id, object_id, file_path, file_name, file_type, mime_type, file_size,
          sha256_hash, privacy_tier, is_primary, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?)`,
      [
        mediaId,
        objectId,
        destUri,
        params.fileName ?? storageName,
        normalizedFileType,
        params.mimeType,
        params.fileSize ?? null,
        sha256,
        privacyTier,
        now,
        now,
      ],
    );

    // 5. Audit trail
    await logAuditEntry(db, {
      tableName: 'objects',
      recordId: objectId,
      action: 'insert',
      newValues: { objectId, mediaId, sha256 },
      deviceInfo: {
        model: params.metadata.deviceModel,
        os: params.metadata.osName != null && params.metadata.osVersion != null
          ? `${params.metadata.osName} ${params.metadata.osVersion}`
          : params.metadata.osVersion,
        app: params.metadata.appVersion,
      },
    });

    // 6. Queue sync
    const syncEngine = new SyncEngine(db);
    await syncEngine.queueChange('objects', objectId, 'insert', {
      objectId,
      mediaId,
    });
  });

  return objectId;
}
