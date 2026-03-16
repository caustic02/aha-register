import type { SQLiteDatabase } from 'expo-sqlite';
import { generateId } from '../utils/uuid';
import { logAuditEntry } from '../db/audit';
import type { Collection } from '../db/types';

export interface CollectionWithCount extends Collection {
  objectCount: number;
}

export interface CollectionForObject extends Collection {
  added_at: string;
}

export interface PickerObject {
  id: string;
  title: string;
  object_type: string;
  file_path: string | null;
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
    // Before CASCADE removes them, log each object_collections row being disassociated
    const members = await db.getAllAsync<{ id: string; object_id: string }>(
      'SELECT id, object_id FROM object_collections WHERE collection_id = ?',
      [id],
    );
    for (const row of members) {
      await logAuditEntry(db, {
        tableName: 'object_collections',
        recordId: row.id,
        action: 'delete',
        oldValues: { objectId: row.object_id, collectionId: id },
      });
    }

    await db.runAsync('DELETE FROM collections WHERE id = ?', [id]);

    await logAuditEntry(db, {
      tableName: 'collections',
      recordId: id,
      action: 'delete',
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
      values as (string | number | null)[],
    );

    await logAuditEntry(db, {
      tableName: 'collections',
      recordId: id,
      action: 'update',
      newValues: data,
    });
  });
}

export async function addObjectToCollection(
  db: SQLiteDatabase,
  objectId: string,
  collectionId: string,
  addedBy?: string,
): Promise<void> {
  const id = generateId();
  const now = new Date().toISOString();

  try {
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `INSERT INTO object_collections (id, object_id, collection_id, added_at, added_by)
         VALUES (?, ?, ?, ?, ?)`,
        [id, objectId, collectionId, now, addedBy ?? null],
      );

      await logAuditEntry(db, {
        tableName: 'object_collections',
        recordId: id,
        action: 'insert',
        userId: addedBy,
        newValues: { objectId, collectionId },
      });
    });
  } catch (err: unknown) {
    // Ignore UNIQUE constraint violation (object already in collection)
    if (String(err).includes('UNIQUE constraint')) return;
    throw err;
  }
}

export async function removeObjectFromCollection(
  db: SQLiteDatabase,
  objectId: string,
  collectionId: string,
): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'DELETE FROM object_collections WHERE object_id = ? AND collection_id = ?',
      [objectId, collectionId],
    );

    await logAuditEntry(db, {
      tableName: 'object_collections',
      recordId: `${objectId}_${collectionId}`,
      action: 'delete',
      oldValues: { objectId, collectionId },
    });
  });
}

export async function getCollectionsForObject(
  db: SQLiteDatabase,
  objectId: string,
): Promise<CollectionForObject[]> {
  return db.getAllAsync<CollectionForObject>(
    `SELECT c.*, oc.added_at
     FROM object_collections oc
     JOIN collections c ON c.id = oc.collection_id
     WHERE oc.object_id = ?
     ORDER BY oc.added_at DESC`,
    [objectId],
  );
}

export async function getObjectsNotInCollection(
  db: SQLiteDatabase,
  collectionId: string,
): Promise<PickerObject[]> {
  return db.getAllAsync<PickerObject>(
    `SELECT o.id, o.title, o.object_type, m.file_path
     FROM objects o
     LEFT JOIN media m ON m.object_id = o.id AND m.is_primary = 1
     WHERE o.id NOT IN (
       SELECT object_id FROM object_collections WHERE collection_id = ?
     )
     ORDER BY o.created_at DESC`,
    [collectionId],
  );
}
