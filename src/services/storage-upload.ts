/**
 * aha! Register — Supabase Storage Upload
 *
 * Uploads media files to Supabase Storage bucket "media".
 * Path convention: {userId}/{objectId}/{mediaId}.{ext}
 *
 * SHA-256 hash is computed BEFORE this runs. This service never modifies
 * the original file. It reads and uploads only.
 */

import { File } from 'expo-file-system';
import { supabase } from './supabase';
import type { SQLiteDatabase } from 'expo-sqlite';

const BUCKET = 'media';

/**
 * Upload a local media file to Supabase Storage.
 *
 * @returns The storage path on success, null on failure.
 *          Does NOT throw — callers should handle null gracefully.
 */
export async function uploadMediaToStorage(
  localFilePath: string,
  userId: string,
  objectId: string,
  mediaId: string,
  fileExtension: string,
): Promise<string | null> {
  try {
    const storagePath = `${userId}/${objectId}/${mediaId}.${fileExtension}`;
    const file = new File(localFilePath);

    if (!file.exists) {
      if (__DEV__) console.warn('[storage-upload] file does not exist:', localFilePath);
      return null;
    }

    // Read file as base64, convert to Uint8Array for Supabase upload
    const base64 = await file.base64();
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const mimeType = fileExtension === 'png' ? 'image/png'
      : fileExtension === 'webp' ? 'image/webp'
      : fileExtension === 'mp4' ? 'video/mp4'
      : 'image/jpeg';

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, bytes.buffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (error) {
      if (__DEV__) console.warn('[storage-upload] upload failed:', error.message);
      return null;
    }

    if (__DEV__) console.log('[storage-upload] uploaded:', storagePath);
    return storagePath;
  } catch (err) {
    if (__DEV__) console.warn('[storage-upload] error:', err);
    return null;
  }
}

/**
 * Upload a media file and update both local SQLite and Supabase with the storage_path.
 * Fire-and-forget safe — never throws.
 */
export async function uploadAndRecordStoragePath(
  db: SQLiteDatabase,
  mediaId: string,
  localFilePath: string,
  userId: string,
  objectId: string,
  fileExtension: string,
): Promise<void> {
  try {
    const storagePath = await uploadMediaToStorage(
      localFilePath,
      userId,
      objectId,
      mediaId,
      fileExtension,
    );

    if (!storagePath) return;

    const now = new Date().toISOString();

    // Update local SQLite
    await db.runAsync(
      `UPDATE media SET storage_path = ?, updated_at = ? WHERE id = ?`,
      [storagePath, now, mediaId],
    );

    // Update Supabase directly (don't go through sync queue to avoid loops)
    await supabase
      .from('media')
      .update({ storage_path: storagePath, updated_at: now })
      .eq('id', mediaId);
  } catch {
    // Fire-and-forget: never crash the app
  }
}
