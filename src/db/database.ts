import * as SQLite from 'expo-sqlite';
import { SCHEMA_SQL, runMigrations } from './schema';
import { INDEXES_SQL } from './indexes';
import { getOrCreateDatabaseKey } from '../utils/db-encryption';
import { migrateToEncryptedDatabase } from '../utils/db-migration-encrypt';
import { SecureStorage } from '../utils/secure-storage';

const DB_NAME = 'aha-register.db';
const DB_ENCRYPTED_FLAG = '_db_encrypted';

/**
 * Applies the SQLCipher encryption key and standard PRAGMAs.
 * MUST be the first operation after opening the database — any
 * query before PRAGMA key will cause SQLCipher to fail.
 */
async function configureEncryption(
  db: SQLite.SQLiteDatabase,
  encryptionKey: string,
): Promise<void> {
  await db.execAsync(`PRAGMA key = "x'${encryptionKey}'"`);
  await db.execAsync('PRAGMA journal_mode=WAL;');
  await db.execAsync('PRAGMA foreign_keys=ON;');
}

/**
 * Opens (or creates) the aha-register database with SQLCipher AES-256
 * encryption, enables WAL mode and foreign keys, runs the full
 * schema + indexes, and returns the db handle.
 *
 * On first launch after enabling SQLCipher, transparently migrates any
 * existing unencrypted database to encrypted format.
 *
 * Safe to call multiple times — every CREATE uses IF NOT EXISTS.
 */
export async function initDatabase(): Promise<SQLite.SQLiteDatabase> {
  const encryptionKey = await getOrCreateDatabaseKey();
  const isEncrypted = await SecureStorage.getItem(DB_ENCRYPTED_FLAG);

  let db: SQLite.SQLiteDatabase;

  if (!isEncrypted) {
    // First launch with SQLCipher — check for existing unencrypted data
    let hasExistingData = false;
    try {
      const testDb = await SQLite.openDatabaseAsync(DB_NAME, {
        useNewConnection: true,
      });
      try {
        const result = await testDb.getFirstAsync<{ cnt: number }>(
          'SELECT count(*) as cnt FROM objects',
        );
        hasExistingData = (result?.cnt ?? 0) > 0;
      } catch {
        // 'objects' table doesn't exist — fresh install
      }
      await testDb.closeAsync();
    } catch {
      // Can't open — treat as fresh install
    }

    if (hasExistingData) {
      // Migrate plaintext → encrypted
      db = await migrateToEncryptedDatabase(
        DB_NAME,
        encryptionKey,
        SCHEMA_SQL,
        INDEXES_SQL,
      );
    } else {
      // Fresh install — remove any empty placeholder, create encrypted
      try {
        await SQLite.deleteDatabaseAsync(DB_NAME);
      } catch {
        // File may not exist yet
      }
      db = await SQLite.openDatabaseAsync(DB_NAME);
      await configureEncryption(db, encryptionKey);
      await db.execAsync(SCHEMA_SQL);
      await db.execAsync(INDEXES_SQL);
      await runMigrations(db);
    }

    await SecureStorage.setItem(DB_ENCRYPTED_FLAG, 'true');
  } else {
    // Normal path — DB is already encrypted
    db = await SQLite.openDatabaseAsync(DB_NAME);
    await configureEncryption(db, encryptionKey);
    await db.execAsync(SCHEMA_SQL);
    await db.execAsync(INDEXES_SQL);
    await runMigrations(db);
  }

  return db;
}
