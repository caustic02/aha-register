/**
 * Object isolation (background removal) service.
 *
 * Creates a derivative PNG with the background removed, linked to the
 * original media record via parent_media_id. The original file and its
 * SHA-256 hash are NEVER modified.
 *
 * Derivatives have NO hash — they are presentation assets, not evidence.
 */
import type { SQLiteDatabase } from 'expo-sqlite';
import { File, Paths } from 'expo-file-system';
import * as Network from 'expo-network';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

import { generateId } from '../utils/uuid';
import { logAuditEntry } from '../db/audit';
import { SyncEngine } from '../sync/engine';
import { supabase, ensureMigrated } from './supabase';
import type { Media } from '../db/types';

// ── Constants ─────────────────────────────────────────────────────────────────

const EDGE_FUNCTION_URL =
  'https://fdwmfijtpknwaesyvzbg.supabase.co/functions/v1/remove-background';

const TIMEOUT_MS = 60_000; // Background removal can take longer than AI analysis

/** Max dimension before sending to remove.bg (keeps payload under 12 MB limit) */
const MAX_ISOLATION_PX = 2048;
const ISOLATION_QUALITY = 0.8;

// ── Auth helper (same pattern as ai-analysis.ts) ─────────────────────────────

async function getAccessToken(): Promise<string | null> {
  await ensureMigrated();

  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    const expiresAt = session.expires_at ?? 0;
    if (expiresAt > Date.now() / 1000 + 30) {
      return session.access_token;
    }
  }

  const { data: { session: refreshed } } = await supabase.auth.refreshSession();
  if (refreshed?.access_token) return refreshed.access_token;

  const { data: { session: anonSession }, error } =
    await supabase.auth.signInAnonymously();
  if (error || !anonSession?.access_token) return null;
  return anonSession.access_token;
}

// ── Service ──────────────────────────────────────────────────────────────────

export interface IsolationResult {
  derivativeId: string;
  filePath: string;
}

/**
 * Removes the background from an object's primary media.
 *
 * 1. Read original media → resize to 2048px → base64
 * 2. Check network
 * 3. Call remove-background Edge Function (with product type hint)
 * 4. Save PNG to app storage
 * 5. Transaction: INSERT derivative media + audit + sync
 *
 * Returns the derivative info, or null on failure.
 * Throws on network errors (caller should catch and show user message).
 */
export async function isolateObject(
  db: SQLiteDatabase,
  objectId: string,
  mediaId: string,
): Promise<IsolationResult | null> {
  // 1. Read the original media record
  const original = await db.getFirstAsync<Media>(
    'SELECT * FROM media WHERE id = ?',
    [mediaId],
  );
  if (!original) {
    console.error('[BG-REMOVAL] Original media record not found:', mediaId);
    throw new Error('Original media record not found');
  }

  // 2. Read image file, resize, and convert to base64
  const file = new File(original.file_path);
  if (!file.exists) {
    console.error('[BG-REMOVAL] Original media file not found on disk:', original.file_path);
    throw new Error('Original media file not found on disk');
  }

  // Resize to max 2048px to stay within remove.bg 12 MB payload limit.
  // The original full-res image is never modified.
  let imageBase64: string;
  try {
    const resized = await manipulateAsync(
      original.file_path,
      [{ resize: { width: MAX_ISOLATION_PX } }],
      { compress: ISOLATION_QUALITY, format: SaveFormat.JPEG },
    );
    const resizedFile = new File(resized.uri);
    imageBase64 = await resizedFile.base64();
    console.log(
      '[BG-REMOVAL] Resized image for upload:',
      resized.width, 'x', resized.height,
      'base64 length:', imageBase64.length,
    );
  } catch (resizeErr) {
    console.error('[BG-REMOVAL] Image resize failed, using original:', resizeErr);
    // Fallback to original if resize fails
    imageBase64 = await file.base64();
  }

  // 3. Check network connectivity
  const networkState = await Network.getNetworkStateAsync();
  const isOnline =
    (networkState.isConnected ?? false) &&
    (networkState.isInternetReachable ?? false);
  if (!isOnline) {
    console.error('[BG-REMOVAL] Device is offline');
    throw new Error('OFFLINE');
  }

  // 4. Get auth token
  const token = await getAccessToken();
  if (!token) {
    console.error('[BG-REMOVAL] No auth session available');
    throw new Error('No auth session available');
  }

  // 5. Read AI object identification for remove.bg type hint
  //    "product" tells remove.bg to expect a single object, not a person
  let objectType = 'product';
  try {
    const obj = await db.getFirstAsync<{ type_specific_data: string | null }>(
      'SELECT type_specific_data FROM objects WHERE id = ?',
      [objectId],
    );
    if (obj?.type_specific_data) {
      const tsd = JSON.parse(obj.type_specific_data) as Record<string, unknown>;
      // If AI identified this as a person/portrait, use "person" type
      const title = typeof tsd.title === 'string' ? tsd.title.toLowerCase() : '';
      const desc = typeof tsd.description === 'string' ? tsd.description.toLowerCase() : '';
      if (title.includes('portrait') || desc.includes('portrait') || desc.includes('person')) {
        objectType = 'person';
      }
    }
  } catch {
    // Non-critical — default to 'product'
  }
  console.log('[BG-REMOVAL] Using type hint:', objectType);

  // 6. Call Edge Function
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let resultBase64: string;
  try {
    console.log('[BG-REMOVAL] Calling Edge Function...');
    const response = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        imageBase64,
        mimeType: 'image/jpeg',
        type: objectType,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      // Parse structured error from Edge Function for better reporting
      let detail = errorBody;
      try {
        const parsed = JSON.parse(errorBody) as { error?: string; detail?: string };
        detail = parsed.detail ?? parsed.error ?? errorBody;
      } catch {
        // Use raw text if not JSON
      }
      console.error('[BG-REMOVAL] Edge Function error:', response.status, detail);
      if (response.status === 402) {
        throw new Error('QUOTA_EXHAUSTED');
      }
      throw new Error(
        `ISOLATION_API_ERROR:${response.status}:${detail}`,
      );
    }

    const data = (await response.json()) as {
      resultBase64: string;
      mimeType: string;
    };
    resultBase64 = data.resultBase64;
    console.log('[BG-REMOVAL] Success, result base64 length:', resultBase64.length);
  } catch (fetchErr) {
    if (fetchErr instanceof Error && fetchErr.name === 'AbortError') {
      console.error('[BG-REMOVAL] Request timed out after', TIMEOUT_MS, 'ms');
      throw new Error('ISOLATION_API_ERROR:408:Request timed out');
    }
    throw fetchErr;
  } finally {
    clearTimeout(timeout);
  }

  // 7. Save PNG to app storage
  const derivativeId = generateId();
  const storageName = `${derivativeId}.png`;
  const storageDir = `${Paths.document.uri}media/`;
  const destUri = `${storageDir}${storageName}`;

  // Decode base64 and write file
  const destFile = new File(destUri);
  const parentDir = destFile.parentDirectory;
  if (!parentDir.exists) {
    parentDir.create({ intermediates: true, idempotent: true });
  }
  await destFile.write(resultBase64, { encoding: 'base64' });

  // 8. Transaction: INSERT derivative media + audit + sync
  // Derivatives have NO sha256_hash (not evidence)
  const now = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO media
         (id, object_id, file_path, file_name, file_type, mime_type,
          sha256_hash, privacy_tier, is_primary, sort_order,
          parent_media_id, media_type, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'image', 'image/png',
               '', ?, 0, 1,
               ?, 'derivative_isolated', ?, ?)`,
      [
        derivativeId,
        objectId,
        destUri,
        storageName,
        original.privacy_tier,
        mediaId,
        now,
        now,
      ],
    );

    await logAuditEntry(db, {
      tableName: 'media',
      recordId: derivativeId,
      action: 'background_removed',
      newValues: {
        objectId,
        parentMediaId: mediaId,
        derivativeId,
      },
    });

    const syncEngine = new SyncEngine(db);
    await syncEngine.queueChange('media', derivativeId, 'insert', {
      objectId,
      parentMediaId: mediaId,
      derivativeId,
    });
  });

  return { derivativeId, filePath: destUri };
}
