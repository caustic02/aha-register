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

import { generateId } from '../utils/uuid';
import { logAuditEntry } from '../db/audit';
import { SyncEngine } from '../sync/engine';
import { supabase, ensureMigrated } from './supabase';
import type { Media } from '../db/types';

// ── Constants ─────────────────────────────────────────────────────────────────

const EDGE_FUNCTION_URL =
  'https://fdwmfijtpknwaesyvzbg.supabase.co/functions/v1/remove-background';

const TIMEOUT_MS = 60_000; // Background removal can take longer than AI analysis

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
 * 1. Read original media → base64
 * 2. Check network
 * 3. Call remove-background Edge Function
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
    throw new Error('Original media record not found');
  }

  // 2. Read image file to base64
  const file = new File(original.file_path);
  if (!file.exists) {
    throw new Error('Original media file not found on disk');
  }
  const imageBase64 = await file.base64();

  // 3. Check network connectivity
  const networkState = await Network.getNetworkStateAsync();
  const isOnline =
    (networkState.isConnected ?? false) &&
    (networkState.isInternetReachable ?? false);
  if (!isOnline) {
    throw new Error('OFFLINE');
  }

  // 4. Get auth token
  const token = await getAccessToken();
  if (!token) {
    throw new Error('No auth session available');
  }

  // 5. Call Edge Function
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let resultBase64: string;
  try {
    const response = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        imageBase64,
        mimeType: original.mime_type,
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
  } finally {
    clearTimeout(timeout);
  }

  // 6. Save PNG to app storage
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

  // 7. Transaction: INSERT derivative media + audit + sync
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
