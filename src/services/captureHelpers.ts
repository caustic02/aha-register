/**
 * Shared utilities for capture services (draftObject, objectService, quickCapture).
 * Centralises the image-copy-to-storage and file-type normalisation logic
 * that was previously duplicated across three files.
 */
import { File, Paths } from 'expo-file-system';

// ── File copy ─────────────────────────────────────────────────────────────────

/**
 * Copies a source image to `{Paths.document}/media/{mediaId}.{ext}`.
 * Creates the parent directory if it doesn't exist.
 * Returns the destination URI.
 */
export function copyToMediaStorage(
  sourceUri: string,
  mediaId: string,
  mimeType: string,
): string {
  const ext = mimeType.split('/')[1] ?? 'jpg';
  const storageName = `${mediaId}.${ext}`;
  const storageDir = `${Paths.document.uri}media/`;
  const destUri = `${storageDir}${storageName}`;

  const srcFile = new File(sourceUri);
  const destFile = new File(destUri);
  const parentDir = destFile.parentDirectory;
  if (!parentDir.exists) {
    parentDir.create({ intermediates: true, idempotent: true });
  }
  srcFile.copy(destFile);

  return destUri;
}

/**
 * Returns the storage file name for the given media ID and mime type.
 */
export function buildStorageName(mediaId: string, mimeType: string): string {
  const ext = mimeType.split('/')[1] ?? 'jpg';
  return `${mediaId}.${ext}`;
}

// ── File type normalisation ────────────────────────────────────────────────────

export type NormalizedFileType = 'image' | 'video' | 'audio' | 'document';

/**
 * Normalises the first segment of a MIME type into one of the four
 * media file types used in the `media` table.
 */
export function normalizeFileType(mimeType: string): NormalizedFileType {
  const fileType = mimeType.split('/')[0];
  if (fileType === 'image' || fileType === 'video' || fileType === 'audio') {
    return fileType;
  }
  return 'document';
}
