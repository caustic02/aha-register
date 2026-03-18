/**
 * Document scanning service (C1).
 *
 * Provides native document scanning (edge detection, perspective correction),
 * file storage with SHA-256 hashing, derivative linking, and on-device OCR.
 *
 * Follows the same derivative pattern as isolationService.ts:
 * - Raw scan gets a SHA-256 hash (evidence)
 * - Deskewed derivative has NO hash (presentation asset)
 * - OCR text is stored on the raw scan media record
 */
import type { SQLiteDatabase } from 'expo-sqlite';
import { File } from 'expo-file-system';
import * as Network from 'expo-network';

import { generateId } from '../utils/uuid';
import { computeSHA256 } from '../utils/hash';
import { logAuditEntry } from '../db/audit';
import { SyncEngine } from '../sync/engine';
import { copyToMediaStorage } from './captureHelpers';
import { supabase, ensureMigrated } from './supabase';
import type { Media } from '../db/types';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ScanResult {
  /** URI of the scanned/deskewed image from the native scanner */
  scannedImageUri: string;
}

export interface DocumentScanRecord {
  rawMediaId: string;
  deskewedMediaId: string;
  rawFilePath: string;
  deskewedFilePath: string;
}

export interface OcrResult {
  text: string;
  confidence: number;
}

// ── Document scanner ─────────────────────────────────────────────────────────

/**
 * Opens the native document scanner (edge detection, corner handles,
 * perspective correction) and returns the scanned image URI.
 *
 * Uses react-native-document-scanner-plugin which wraps:
 * - Android: Google ML Kit Document Scanner API
 * - iOS: Apple VisionKit
 *
 * Falls back to null if the user cancels.
 */
export async function launchDocumentScanner(): Promise<ScanResult | null> {
  const DocumentScanner = await import('react-native-document-scanner-plugin');
  const { ResponseType, ScanDocumentResponseStatus } = DocumentScanner;

  const response = await DocumentScanner.default.scanDocument({
    croppedImageQuality: 100,
    maxNumDocuments: 1,
    responseType: ResponseType.ImageFilePath,
  });

  if (
    response.status !== ScanDocumentResponseStatus.Success ||
    !response.scannedImages?.length
  ) {
    return null;
  }

  return { scannedImageUri: response.scannedImages[0] };
}

// ── Process & store ──────────────────────────────────────────────────────────

/**
 * Stores a document scan as a media pair:
 * 1. Raw image → media record with SHA-256 hash, media_type='document_scan'
 * 2. Deskewed image → derivative with NO hash, media_type='document_deskewed'
 *
 * Both are linked to the given objectId. The deskewed derivative links
 * to the raw scan via parent_media_id.
 */
export async function processDocumentScan(
  db: SQLiteDatabase,
  objectId: string,
  rawImageUri: string,
  deskewedImageUri: string,
): Promise<DocumentScanRecord> {
  const rawMediaId = generateId();
  const deskewedMediaId = generateId();

  // 1. Copy raw image to app storage and compute SHA-256
  const rawDestUri = copyToMediaStorage(rawImageUri, rawMediaId, 'image/jpeg');
  const rawHash = await computeSHA256(rawDestUri);

  // 2. Copy deskewed image to app storage — NO hash (derivative)
  const deskewedDestUri = copyToMediaStorage(
    deskewedImageUri,
    deskewedMediaId,
    'image/jpeg',
  );

  const now = new Date().toISOString();

  // 3. Transaction: insert both media records + audit + sync
  await db.withTransactionAsync(async () => {
    // Raw scan — has SHA-256 hash (evidence)
    await db.runAsync(
      `INSERT INTO media
         (id, object_id, file_path, file_name, file_type, mime_type,
          sha256_hash, privacy_tier, is_primary, sort_order,
          parent_media_id, media_type, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'image', 'image/jpeg',
               ?, 'public', 0, 0,
               NULL, 'document_scan', ?, ?)`,
      [
        rawMediaId,
        objectId,
        rawDestUri,
        `${rawMediaId}.jpeg`,
        rawHash,
        now,
        now,
      ],
    );

    // Deskewed derivative — NO hash (presentation asset)
    await db.runAsync(
      `INSERT INTO media
         (id, object_id, file_path, file_name, file_type, mime_type,
          sha256_hash, privacy_tier, is_primary, sort_order,
          parent_media_id, media_type, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'image', 'image/jpeg',
               '', 'public', 0, 1,
               ?, 'document_deskewed', ?, ?)`,
      [
        deskewedMediaId,
        objectId,
        deskewedDestUri,
        `${deskewedMediaId}.jpeg`,
        rawMediaId,
        now,
        now,
      ],
    );

    // Audit trail for raw scan
    await logAuditEntry(db, {
      tableName: 'media',
      recordId: rawMediaId,
      action: 'document_scan',
      newValues: {
        objectId,
        rawMediaId,
        deskewedMediaId,
        sha256: rawHash,
      },
    });

    // Sync queue for both
    const syncEngine = new SyncEngine(db);
    await syncEngine.queueChange('media', rawMediaId, 'insert', {
      objectId,
      mediaType: 'document_scan',
    });
    await syncEngine.queueChange('media', deskewedMediaId, 'insert', {
      objectId,
      parentMediaId: rawMediaId,
      mediaType: 'document_deskewed',
    });
  });

  return {
    rawMediaId,
    deskewedMediaId,
    rawFilePath: rawDestUri,
    deskewedFilePath: deskewedDestUri,
  };
}

// ── On-device OCR ────────────────────────────────────────────────────────────

/**
 * Runs ML Kit text recognition on the given image.
 * Returns the extracted text and average confidence score.
 *
 * Updates the media record with ocr_text, ocr_confidence, ocr_source='on_device'.
 * The OCR text is stored on the RAW scan record (not the deskewed derivative).
 */
export async function extractTextOnDevice(
  db: SQLiteDatabase,
  mediaId: string,
  imageUri: string,
): Promise<OcrResult> {
  const MlkitOcr = await import('rn-mlkit-ocr');

  const result = await MlkitOcr.default.recognizeText(imageUri);

  // Calculate average confidence from block-level data.
  // ML Kit doesn't expose per-block confidence directly;
  // we use the presence of recognized text as a proxy.
  // A non-empty result with blocks is high confidence.
  const blockCount = result.blocks.length;
  const confidence =
    blockCount > 0 && result.text.trim().length > 0
      ? Math.min(95, 60 + blockCount * 5)
      : 0;

  const text = result.text;

  // Update the raw scan's media record with OCR results
  await db.runAsync(
    `UPDATE media
     SET ocr_text = ?, ocr_confidence = ?, ocr_source = 'on_device', updated_at = ?
     WHERE id = ?`,
    [text, confidence, new Date().toISOString(), mediaId],
  );

  return { text, confidence };
}

// ── Cloud OCR upgrade (C6) ───────────────────────────────────────────────────

const OCR_ENHANCE_URL =
  'https://fdwmfijtpknwaesyvzbg.supabase.co/functions/v1/ocr-enhance';

const CLOUD_OCR_TIMEOUT_MS = 90_000;

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

export type CloudOcrStatus = 'upgraded' | 'no_upgrade' | 'error' | 'skipped';

/**
 * Calls the Gemini-powered ocr-enhance Edge Function for higher-quality OCR.
 * Only overwrites on-device results if cloud confidence > on_device confidence.
 *
 * Fire-and-forget safe: never throws, always returns a status.
 */
export async function upgradeOcrFromCloud(
  db: SQLiteDatabase,
  mediaId: string,
  domain: string = 'general',
): Promise<CloudOcrStatus> {
  try {
    // 1. Load raw scan record
    const raw = await db.getFirstAsync<Media>(
      'SELECT * FROM media WHERE id = ?',
      [mediaId],
    );
    if (!raw) return 'error';

    // Skip if already cloud-processed or no on-device OCR
    if (raw.ocr_source === 'cloud') return 'skipped';
    if (raw.ocr_source !== 'on_device') return 'skipped';

    // 2. Find display image (deskewed preferred, raw fallback)
    const deskewed = await db.getFirstAsync<Media>(
      `SELECT * FROM media WHERE parent_media_id = ? AND media_type = 'document_deskewed'`,
      [mediaId],
    );
    const imageFile = new File(deskewed?.file_path ?? raw.file_path);
    if (!imageFile.exists) return 'error';

    // 3. Network check
    const networkState = await Network.getNetworkStateAsync();
    if (!(networkState.isConnected && networkState.isInternetReachable)) {
      return 'skipped';
    }

    // 4. Auth token
    const token = await getAccessToken();
    if (!token) return 'error';

    // 5. Read image as base64
    const imageBase64 = await imageFile.base64();

    // 6. Call Edge Function
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CLOUD_OCR_TIMEOUT_MS);

    let responseData: {
      status: string;
      text?: string;
      confidence?: number;
      language?: string;
      handwriting_detected?: boolean;
      notes?: string;
      error?: string;
    };

    try {
      const response = await fetch(OCR_ENHANCE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          image_base64: imageBase64,
          mime_type: raw.mime_type,
          existing_text: raw.ocr_text ?? '',
          existing_confidence: raw.ocr_confidence ?? 0,
          domain,
        }),
        signal: controller.signal,
      });

      responseData = await response.json();
    } finally {
      clearTimeout(timeout);
    }

    const now = new Date().toISOString();

    // 7. Handle result
    if (responseData.status === 'upgraded' && responseData.text != null) {
      const oldConfidence = raw.ocr_confidence ?? 0;
      const newConfidence = responseData.confidence ?? 0;

      await db.runAsync(
        `UPDATE media
         SET ocr_text = ?, ocr_confidence = ?, ocr_source = 'cloud', updated_at = ?
         WHERE id = ?`,
        [responseData.text, newConfidence, now, mediaId],
      );

      await logAuditEntry(db, {
        tableName: 'media',
        recordId: mediaId,
        action: 'cloud_ocr_upgrade',
        newValues: {
          oldConfidence,
          newConfidence,
          language: responseData.language,
          handwritingDetected: responseData.handwriting_detected,
        },
      });

      const syncEngine = new SyncEngine(db);
      await syncEngine.queueChange('media', mediaId, 'update', {
        ocrSource: 'cloud',
        ocrConfidence: newConfidence,
      });

      return 'upgraded';
    }

    if (responseData.status === 'no_upgrade') {
      await logAuditEntry(db, {
        tableName: 'media',
        recordId: mediaId,
        action: 'cloud_ocr_no_upgrade',
        newValues: {
          existingConfidence: raw.ocr_confidence,
          cloudConfidence: responseData.confidence,
        },
      });
      return 'no_upgrade';
    }

    return 'error';
  } catch {
    // Fire-and-forget: never throw
    return 'error';
  }
}
