import type { SQLiteDatabase } from 'expo-sqlite';
import { generateId } from '../utils/uuid';
import { logAuditEntry } from '../db/audit';
import type { Collection } from '../db/types';

export interface CollectionWithCount extends Collection {
  objectCount: number;
}

export interface CollectionObject {
  id: string;
  title: string;
  object_type: string;
  created_at: string;
  file_path: string | null;
}

export async function getAllCollections(
  db: SQLiteDatabase,
): Promise<CollectionWithCount[]> {
  return db.getAllAsync<CollectionWithCount>(
    `SELECT c.*, COALESCE(cnt.c, 0) as objectCount
     FROM collections c
     LEFT JOIN (
       SELECT collection_id, COUNT(*) as c
       FROM object_collections
       GROUP BY collection_id
     ) cnt ON cnt.collection_id = c.id
     ORDER BY c.created_at DESC`,
  );
}

export async function getCollectionById(
  db: SQLiteDatabase,
  id: string,
): Promise<{ collection: Collection; objects: CollectionObject[] } | null> {
  const collection = await db.getFirstAsync<Collection>(
    'SELECT * FROM collections WHERE id = ?',
    [id],
  );
  if (!collection) return null;

  const objects = await db.getAllAsync<CollectionObject>(
    `SELECT o.id, o.title, o.object_type, o.created_at, m.file_path
     FROM object_collections oc
     JOIN objects o ON o.id = oc.object_id
     LEFT JOIN media m ON m.object_id = o.id AND m.is_primary = 1
     WHERE oc.collection_id = ?
     ORDER BY oc.display_order ASC, o.created_at DESC`,
    [id],
  );

  return { collection, objects };
}

export async function createCollection(
  db: SQLiteDatabase,
  data: { name: string; collection_type: string; description?: string },
): Promise<Collection> {
  const id = generateId();
  const now = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO collections (id, name, collection_type, description, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, data.name, data.collection_type, data.description ?? null, now, now],
    );

    await logAuditEntry(db, {
      tableName: 'collections',
      recordId: id,
      action: 'insert',
      userId: 'local',
      newValues: data,
    });
  });

  return {
    id,
    institution_id: null,
    name: data.name,
    collection_type: data.collection_type,
    description: data.description ?? null,
    created_at: now,
    updated_at: now,
  };
}

export async function deleteCollection(
  db: SQLiteDatabase,
  id: string,
): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM collections WHERE id = ?', [id]);

    await logAuditEntry(db, {
      tableName: 'collections',
      recordId: id,
      action: 'delete',
      userId: 'local',
    });
  });
}

export async function updateCollection(
  db: SQLiteDatabase,
  id: string,
  data: Partial<{ name: string; description: string; collection_type: string }>,
): Promise<void> {
  const sets: string[] = [];
  const values: unknown[] = [];

  if (data.name !== undefined) {
    sets.push('name = ?');
    values.push(data.name);
  }
  if (data.description !== undefined) {
    sets.push('description = ?');
    values.push(data.description);
  }
  if (data.collection_type !== undefined) {
    sets.push('collection_type = ?');
    values.push(data.collection_type);
  }
  if (sets.length === 0) return;

  sets.push('updated_at = ?');
  const now = new Date().toISOString();
  values.push(now, id);

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE collections SET ${sets.join(', ')} WHERE id = ?`,
      values as any[],
    );

    await logAuditEntry(db, {
      tableName: 'collections',
      recordId: id,
      action: 'update',
      userId: 'local',
      newValues: data,
    });
  });
}
