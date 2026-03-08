import * as SQLite from 'expo-sqlite';
import { SCHEMA_SQL } from './schema';
import { INDEXES_SQL } from './indexes';

const DB_NAME = 'aha-register.db';

/**
 * Opens (or creates) the aha-register database, enables WAL mode and
 * foreign keys, runs the full schema + indexes, and returns the db handle.
 *
 * Safe to call multiple times — every CREATE uses IF NOT EXISTS.
 */
export async function initDatabase(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);

  // WAL for better concurrent read/write performance
  await db.execAsync('PRAGMA journal_mode=WAL;');

  // Enforce foreign key constraints
  await db.execAsync('PRAGMA foreign_keys=ON;');

  // Create tables and indexes (idempotent)
  await db.execAsync(SCHEMA_SQL);
  await db.execAsync(INDEXES_SQL);

  return db;
}
