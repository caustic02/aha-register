/**
 * Read a media file as base64, accepting either a local file URI or a
 * remote http(s):// URL.
 *
 * Why: after the sync engine pulls a media row, `file_path` may have been
 * rewritten to a remote URL (e.g. Supabase Storage public URL or the source
 * URL of a seeded image). AI analysis and other consumers need the bytes as
 * base64 regardless of where they live, so this helper handles both paths.
 *
 * For local paths, it first tries the session-corrected URI from
 * resolveMediaUri (which rebuilds the Documents directory prefix), falling
 * back to the raw stored path if that fails.
 */
import { File } from 'expo-file-system';
import { resolveMediaUri } from './resolveMediaUri';

export async function readMediaBase64(storedPath: string | null | undefined): Promise<string> {
  if (!storedPath) {
    throw new Error('readMediaBase64: empty path');
  }

  // Remote URL — fetch and convert to base64
  if (storedPath.startsWith('http://') || storedPath.startsWith('https://')) {
    console.log('[readMediaBase64] fetching remote:', storedPath.substring(0, 120));
    const res = await fetch(storedPath);
    if (!res.ok) {
      throw new Error(`readMediaBase64: HTTP ${res.status} fetching ${storedPath.substring(0, 80)}`);
    }
    const buf = await res.arrayBuffer();
    // btoa on a binary string is the standard RN path for converting
    // an ArrayBuffer to base64 without extra dependencies.
    const bytes = new Uint8Array(buf);
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(
        null,
        Array.from(bytes.subarray(i, i + chunkSize)),
      );
    }
    // eslint-disable-next-line no-undef
    return btoa(binary);
  }

  // Local file — try resolved URI first, then raw path.
  const resolved = resolveMediaUri(storedPath);
  try {
    const f = new File(resolved);
    if (f.exists) {
      return await f.base64();
    }
  } catch {
    // fall through
  }
  try {
    const f = new File(storedPath);
    if (f.exists) {
      return await f.base64();
    }
  } catch {
    // fall through
  }
  throw new Error(`readMediaBase64: local file not found for ${storedPath.substring(0, 120)}`);
}
