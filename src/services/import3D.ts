/**
 * 3D model import helpers.
 *
 * Two entry points:
 *   - pickAndPrepare3DFile: opens document picker, validates, copies the
 *     file into media/{uuid}/ with a SHA-256 hash. Returns file metadata
 *     ready to be inserted into the media table.
 *   - importNew3DObject: full flow — pick, create new draft object,
 *     insert primary media, queue sync. Returns the new object ID.
 *
 * Shared between HomeScreen ("3D Scan" tool tile → new object) and
 * ObjectDetailScreen (add to existing object — uses pickAndPrepare3DFile
 * only).
 */
import { Alert } from 'react-native';
import type { SQLiteDatabase } from 'expo-sqlite';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';

import {
  MODEL_3D_PICKER_TYPES,
  mimeTypeFor3dExtension,
  normalizeFileTypeWithExtension,
} from './captureHelpers';
import { computeSHA256 } from '../utils/hash';
import { generateId } from '../utils/uuid';
import { SyncEngine } from '../sync/engine';

export interface Prepared3DFile {
  mediaId: string;
  destUri: string;
  fileName: string;
  resolvedMime: string;
  fileSize: number;
  hash: string;
}

/**
 * Opens the system document picker, validates the selection is a supported
 * 3D model, copies it into media/{mediaId}/model.{ext}, and hashes it.
 * Returns null if the user cancelled or the file type is unsupported
 * (in which case an alert is shown).
 */
export async function pickAndPrepare3DFile(
  t: (key: string) => string,
): Promise<Prepared3DFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: MODEL_3D_PICKER_TYPES,
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets || result.assets.length === 0) {
    return null;
  }

  const asset = result.assets[0];
  const fileName = asset.name;
  const fileType = normalizeFileTypeWithExtension(
    asset.mimeType ?? 'application/octet-stream',
    fileName,
  );
  if (fileType !== '3d_scan') {
    Alert.alert(t('model3d.import'), t('model3d.unsupported_format'));
    return null;
  }

  // Resolve MIME type (Android often reports application/octet-stream).
  const resolvedMime =
    asset.mimeType && asset.mimeType !== 'application/octet-stream'
      ? asset.mimeType
      : (mimeTypeFor3dExtension(fileName) ?? 'application/octet-stream');

  // Copy file into media/{mediaId}/model.{ext}
  const mediaId = generateId();
  const ext = fileName.split('.').pop()?.toLowerCase() ?? 'bin';
  const dir = `${Paths.document.uri}media/${mediaId}/`;
  const destUri = `${dir}model.${ext}`;
  const srcFile = new File(asset.uri);
  const destFile = new File(destUri);
  const parentDir = destFile.parentDirectory;
  if (!parentDir.exists) {
    parentDir.create({ intermediates: true, idempotent: true });
  }
  srcFile.copy(destFile);

  // Hash raw bytes for provenance (SHA-256).
  const hash = await computeSHA256(destUri);
  const fileSize = destFile.size ?? asset.size ?? 0;

  return { mediaId, destUri, fileName, resolvedMime, fileSize, hash };
}

/**
 * Picks a 3D file and creates a new draft object with it as the primary
 * media record. Returns the new object ID on success, or null if the
 * picker was cancelled / the file was invalid / the DB write failed.
 *
 * Used when the user taps the "3D Scan" tool from the home screen —
 * there is no object context yet, so we mint a new draft.
 */
export async function importNew3DObject(
  db: SQLiteDatabase,
  t: (key: string) => string,
): Promise<string | null> {
  try {
    const picked = await pickAndPrepare3DFile(t);
    if (!picked) return null;

    const objectId = generateId();
    const now = new Date().toISOString();

    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `INSERT INTO objects
           (id, object_type, status, title, privacy_tier, legal_hold,
            review_status, created_at, updated_at)
         VALUES (?, 'museum_object', 'draft', ?, 'public', 0, 'complete', ?, ?)`,
        [objectId, 'Untitled', now, now],
      );

      await db.runAsync(
        `INSERT INTO media
           (id, object_id, file_path, file_name, file_type, mime_type, file_size,
            sha256_hash, privacy_tier, is_primary, sort_order,
            media_type, created_at, updated_at)
         VALUES (?, ?, ?, ?, '3d_scan', ?, ?, ?, 'public', 1, 0, 'original', ?, ?)`,
        [
          picked.mediaId,
          objectId,
          picked.destUri,
          picked.fileName,
          picked.resolvedMime,
          picked.fileSize,
          picked.hash,
          now,
          now,
        ],
      );
    });

    // Queue sync for both the object and its media (fire-and-forget).
    const syncEngine = new SyncEngine(db);
    await syncEngine.queueChange('objects', objectId, 'insert', {});
    await syncEngine.queueChange('media', picked.mediaId, 'insert', {
      object_id: objectId,
      file_path: picked.destUri,
      file_name: picked.fileName,
      file_type: '3d_scan',
      mime_type: picked.resolvedMime,
      file_size: picked.fileSize,
      sha256_hash: picked.hash,
    });

    return objectId;
  } catch (err) {
    console.warn('[3d-import-new] failed:', err);
    Alert.alert(t('model3d.import'), t('model3d.import_failed'));
    return null;
  }
}
