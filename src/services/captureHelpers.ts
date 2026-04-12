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

export type NormalizedFileType = 'image' | 'video' | 'audio' | 'document' | '3d_scan';

/** File extensions recognised as 3D model formats. */
const MODEL_3D_EXTENSIONS = new Set([
  'glb', 'gltf', 'usdz', 'obj', 'fbx', 'ply',
]);

/** MIME types that map to `3d_scan`. */
const MODEL_3D_MIMES = new Set([
  'model/gltf-binary',
  'model/gltf+json',
  'model/vnd.usdz+zip',
  'model/vnd.usd+zip',
  'model/obj',
  'model/vnd.pixar.usd',
]);

/**
 * Normalises the first segment of a MIME type into one of the
 * media file types used in the `media` table.
 */
export function normalizeFileType(mimeType: string): NormalizedFileType {
  // Check explicit 3D MIME types first
  if (MODEL_3D_MIMES.has(mimeType)) return '3d_scan';
  const fileType = mimeType.split('/')[0];
  if (fileType === 'model') return '3d_scan';
  if (fileType === 'image' || fileType === 'video' || fileType === 'audio') {
    return fileType;
  }
  return 'document';
}

/**
 * Determine file type from extension when MIME is ambiguous
 * (Android often sends application/octet-stream for 3D files).
 */
export function normalizeFileTypeWithExtension(
  mimeType: string,
  fileName: string,
): NormalizedFileType {
  const byMime = normalizeFileType(mimeType);
  if (byMime !== 'document') return byMime;
  // Fallback: check extension for 3D formats
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  if (MODEL_3D_EXTENSIONS.has(ext)) return '3d_scan';
  return byMime;
}

/** MIME type map for 3D file extensions (for document picker results with missing/generic MIME). */
export function mimeTypeFor3dExtension(fileName: string): string | null {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  switch (ext) {
    case 'glb':  return 'model/gltf-binary';
    case 'gltf': return 'model/gltf+json';
    case 'usdz': return 'model/vnd.usdz+zip';
    case 'obj':  return 'model/obj';
    case 'fbx':  return 'application/octet-stream';
    case 'ply':  return 'application/octet-stream';
    default:     return null;
  }
}

/** Accepted MIME types passed to expo-document-picker for 3D import. */
export const MODEL_3D_PICKER_TYPES = [
  'model/gltf-binary',
  'model/gltf+json',
  'model/vnd.usdz+zip',
  'model/obj',
  'application/octet-stream', // catch-all for Android
];
