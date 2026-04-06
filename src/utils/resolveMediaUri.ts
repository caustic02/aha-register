/**
 * Resolves a stored media file_path to a valid URI for the current app session.
 *
 * On iOS, the application container UUID changes between TestFlight/App Store
 * updates. Files are preserved but their absolute paths become stale because
 * the UUID segment differs. This utility extracts the relative portion of the
 * stored path and reconstructs it using the current `Paths.document.uri`.
 *
 * HTTP/HTTPS URLs (e.g. images pulled from Supabase Storage or Met CDN) pass
 * through unchanged.
 */
import { Paths, File } from 'expo-file-system';

/** Well-known subdirectories inside the app's Documents directory. */
const KNOWN_SEGMENTS = ['/media/', '/floor_maps/', '/storage/'] as const;

export function resolveMediaUri(storedPath: string | null | undefined): string {
  if (!storedPath) return '';

  // Remote URLs pass through unchanged
  if (storedPath.startsWith('http://') || storedPath.startsWith('https://')) {
    return storedPath;
  }

  // Quick check: if the file exists at the stored path, use it as-is.
  // This handles the common case (same session, no container change).
  try {
    const f = new File(storedPath);
    if (f.exists) return storedPath;
  } catch {
    // File constructor or exists check failed — try resolution below
  }

  // Extract relative path by finding a known subdirectory segment.
  // Stored path looks like: file:///var/mobile/.../Documents/media/uuid.jpg
  // We want: media/uuid.jpg  →  reconstruct with current Paths.document.uri
  for (const seg of KNOWN_SEGMENTS) {
    const idx = storedPath.indexOf(seg);
    if (idx !== -1) {
      const relative = storedPath.slice(idx + 1); // e.g. 'media/uuid.jpg'
      return `${Paths.document.uri}${relative}`;
    }
  }

  // No known segment found — return as-is (best effort)
  return storedPath;
}
