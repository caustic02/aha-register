import type { SQLiteDatabase } from 'expo-sqlite';
import { File } from 'expo-file-system';
import { logAuditEntry } from '../db/audit';

/**
 * Deletes an object and all associated data.
 * Media files are removed from the filesystem first (best-effort).
 * The DB DELETE cascades to: media rows, object_collections, annotations, documents.
 */
export async function deleteObject(
  db: SQLiteDatabase,
  objectId: string,
): Promise<void> {
  // 1. Collect all media file paths before deletion
  const mediaRows = await db.getAllAsync<{ id: string; file_path: string }>(
    'SELECT id, file_path FROM media WHERE object_id = ?',
    [objectId],
  );

  // 2. Log audit entry before the DELETE (record still exists at this point)
  await logAuditEntry(db, {
    tableName: 'objects',
    recordId: objectId,
    action: 'delete',
    userId: 'local',
    oldValues: { mediaCount: mediaRows.length },
  });

  // 3. Delete the object — cascades to media rows, object_collections, annotations
  await db.runAsync('DELETE FROM objects WHERE id = ?', [objectId]);

  // 4. Delete media files from filesystem (best-effort, outside transaction)
  for (const row of mediaRows) {
    try {
      const file = new File(row.file_path);
      if (file.exists) {
        file.delete();
      }
    } catch {
      // File cleanup is best-effort; DB is source of truth
    }
  }
}
