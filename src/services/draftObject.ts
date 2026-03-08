import type { SQLiteDatabase } from 'expo-sqlite';
import { File, Paths } from 'expo-file-system';

import { generateId } from '../utils/uuid';
import { computeSHA256 } from '../utils/hash';
import { logAuditEntry } from '../db/audit';
import { SyncEngine } from '../sync/engine';
import type { CaptureMetadata } from './metadata';

export interface CreateDraftParams {
  imageUri: string;
  fileName: string | null;
  fileSize: number | null;
  mimeType: string;
  metadata: CaptureMetadata;
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
  const ext = params.mimeType.split('/')[1] ?? 'jpg';
  const storageName = `${mediaId}.${ext}`;
  const storageDir = `${Paths.document.uri}media/`;
  const destUri = `${storageDir}${storageName}`;

  const srcFile = new File(params.imageUri);
  const destFile = new File(destUri);
  const parentDir = destFile.parentDirectory;
  if (!parentDir.exists) {
    parentDir.create({ intermediates: true, idempotent: true });
  }
  srcFile.copy(destFile);

  // 2. Compute SHA-256 hash
  const sha256 = await computeSHA256(destUri);

  // 3. Insert object record
  await db.runAsync(
    `INSERT INTO objects
       (id, object_type, title, latitude, longitude, altitude,
        coordinate_accuracy, coordinate_source, privacy_tier,
        legal_hold, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'public', 0, ?, ?)`,
    [
      objectId,
      'museum_object',
      'Untitled',
      params.metadata.latitude ?? null,
      params.metadata.longitude ?? null,
      params.metadata.altitude ?? null,
      params.metadata.accuracy ?? null,
      params.metadata.coordinateSource ?? null,
      now,
      now,
    ],
  );

  // 4. Insert media record (sort_order=0 → primary)
  await db.runAsync(
    `INSERT INTO media
       (id, object_id, file_path, file_name, mime_type, file_size,
        sha256_hash, privacy_tier, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'public', 0, ?, ?)`,
    [
      mediaId,
      objectId,
      destUri,
      params.fileName ?? storageName,
      params.mimeType,
      params.fileSize ?? null,
      sha256,
      now,
      now,
    ],
  );

  // 5. Audit trail
  await logAuditEntry(db, {
    tableName: 'objects',
    recordId: objectId,
    action: 'insert',
    userId: 'local',
    newValues: { objectId, mediaId, sha256 },
    deviceInfo: {
      model: params.metadata.deviceModel,
      os: params.metadata.osVersion,
      app: params.metadata.appVersion,
    },
  });

  // 6. Queue sync
  const syncEngine = new SyncEngine(db);
  await syncEngine.queueChange('objects', objectId, 'insert', {
    objectId,
    mediaId,
  });

  return objectId;
}
