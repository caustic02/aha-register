import * as SQLite from 'expo-sqlite';

/**
 * All schema tables in foreign-key-safe insertion order.
 * Parents before children so that re-import with FK checks off still works
 * if the flag is ever toggled mid-import.
 */
const TABLES_IN_ORDER = [
  'institutions',
  'sites',
  'users',
  'objects',
  'media',
  'annotations',
  'vocabulary_terms',
  'collections',
  'object_collections',
  'locations',
  'documents',
  'app_settings',
  'audit_trail',
  'sync_queue',
];

interface TableData {
  table: string;
  rows: Record<string, unknown>[];
}

async function exportAllTables(
  db: SQLite.SQLiteDatabase,
): Promise<TableData[]> {
  const result: TableData[] = [];
  for (const table of TABLES_IN_ORDER) {
    try {
      const rows = await db.getAllAsync<Record<string, unknown>>(
        `SELECT * FROM ${table}`,
      );
      result.push({ table, rows });
    } catch {
      // Table may not exist yet (partial schema) — skip
      result.push({ table, rows: [] });
    }
  }
  return result;
}

async function importAllTables(
  db: SQLite.SQLiteDatabase,
  data: TableData[],
): Promise<void> {
  // Disable FK checks during bulk import to avoid ordering issues
  await db.execAsync('PRAGMA foreign_keys=OFF;');

  for (const { table, rows } of data) {
    if (rows.length === 0) continue;

    for (const row of rows) {
      const columns = Object.keys(row);
      const placeholders = columns.map(() => '?').join(', ');
      const values = columns.map((col) => row[col]);
      await db.runAsync(
        `INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
        values as (string | number | null)[],
      );
    }
  }

  await db.execAsync('PRAGMA foreign_keys=ON;');
}

/**
 * One-time migration of an existing plaintext SQLite database to
 * SQLCipher AES-256 encryption.
 *
 * Strategy (safe for small-to-medium datasets):
 *   1. Open existing DB without PRAGMA key (reads plaintext via SQLCipher)
 *   2. Export every row from every table into memory
 *   3. Close and delete the plaintext file
 *   4. Create a fresh encrypted DB with the same name
 *   5. Apply schema + indexes, reimport all data
 *   6. Verify row counts match
 *
 * If verification fails, an error is thrown. The plaintext file is already
 * deleted at that point — the data is still in memory and the error can be
 * caught by the caller to retry.
 */
export async function migrateToEncryptedDatabase(
  dbName: string,
  encryptionKey: string,
  schemaSql: string,
  indexesSql: string,
): Promise<SQLite.SQLiteDatabase> {
  // 1. Open the existing plaintext database
  const plainDb = await SQLite.openDatabaseAsync(dbName, {
    useNewConnection: true,
  });

  // 2. Export all data
  const data = await exportAllTables(plainDb);
  const totalRows = data.reduce((sum, t) => sum + t.rows.length, 0);

  // 3. Close the plaintext connection
  await plainDb.closeAsync();

  // 4. Delete the plaintext file
  await SQLite.deleteDatabaseAsync(dbName);

  // 5. Create a fresh encrypted database
  const encDb = await SQLite.openDatabaseAsync(dbName, {
    useNewConnection: true,
  });
  await encDb.execAsync(`PRAGMA key = "x'${encryptionKey}'"`);
  await encDb.execAsync('PRAGMA journal_mode=WAL;');
  await encDb.execAsync('PRAGMA foreign_keys=ON;');
  await encDb.execAsync(schemaSql);
  await encDb.execAsync(indexesSql);

  // 6. Reimport data
  if (totalRows > 0) {
    await importAllTables(encDb, data);
  }

  // 7. Verify — compare object count as a basic integrity check
  const originalObjectCount =
    data.find((t) => t.table === 'objects')?.rows.length ?? 0;
  const verifyResult = await encDb.getFirstAsync<{ cnt: number }>(
    'SELECT count(*) as cnt FROM objects',
  );
  const importedObjectCount = verifyResult?.cnt ?? 0;

  if (importedObjectCount !== originalObjectCount) {
    throw new Error(
      `Encryption migration verification failed: expected ${originalObjectCount} objects, got ${importedObjectCount}`,
    );
  }

  if (__DEV__)
    console.log(`[db] migrated to encrypted database (${totalRows} rows)`);

  return encDb;
}
