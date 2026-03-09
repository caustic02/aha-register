import type { SQLiteDatabase } from 'expo-sqlite';

// ── Known setting keys ───────────────────────────────────────────────────────

export const SETTING_KEYS = {
  INSTITUTION_NAME: 'institution_name',
  INSTITUTION_TYPE: 'institution_type',
  DEFAULT_PRIVACY_TIER: 'default_privacy_tier',
  DEFAULT_OBJECT_TYPE: 'default_object_type',
  LANGUAGE: 'language',
  USER_DISPLAY_NAME: 'user_display_name',
  ONBOARDING_COMPLETE: 'onboarding_complete',
  CAMERA_FLASH_MODE: 'camera_flash_mode',
  LAST_SYNC_TIMESTAMP: 'last_sync_timestamp',
  SYNC_INSTITUTION_ID: 'sync_institution_id',
  SYNC_ENABLED: 'sync_enabled',
} as const;

export const INSTITUTION_TYPES = [
  'museum',
  'gallery',
  'archive',
  'university',
  'research_institute',
  'field_organization',
  'other',
] as const;

export type InstitutionType = (typeof INSTITUTION_TYPES)[number];

// ── Service functions ────────────────────────────────────────────────────────

export async function getSetting(
  db: SQLiteDatabase,
  key: string,
): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_settings WHERE key = ?',
    [key],
  );
  return row?.value ?? null;
}

export async function setSetting(
  db: SQLiteDatabase,
  key: string,
  value: string,
): Promise<void> {
  const now = new Date().toISOString();
  await db.runAsync(
    'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)',
    [key, value, now],
  );
}

export async function getAllSettings(
  db: SQLiteDatabase,
): Promise<Record<string, string>> {
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    'SELECT key, value FROM app_settings',
  );
  const result: Record<string, string> = {};
  for (const row of rows) {
    result[row.key] = row.value;
  }
  return result;
}

export interface StorageStats {
  objectCount: number;
  mediaCount: number;
  collectionCount: number;
  pendingSyncCount: number;
  lastSyncAt: string | null;
}

export async function getStorageStats(
  db: SQLiteDatabase,
): Promise<StorageStats> {
  const [objects, media, collections, pendingSync] = await Promise.all([
    db.getFirstAsync<{ c: number }>('SELECT COUNT(*) as c FROM objects'),
    db.getFirstAsync<{ c: number }>('SELECT COUNT(*) as c FROM media'),
    db.getFirstAsync<{ c: number }>('SELECT COUNT(*) as c FROM collections'),
    db.getFirstAsync<{ c: number }>(
      "SELECT COUNT(*) as c FROM sync_queue WHERE status = 'pending'",
    ),
  ]);

  const lastSync = await db.getFirstAsync<{ t: string | null }>(
    "SELECT MAX(updated_at) as t FROM sync_queue WHERE status = 'synced'",
  );

  return {
    objectCount: objects?.c ?? 0,
    mediaCount: media?.c ?? 0,
    collectionCount: collections?.c ?? 0,
    pendingSyncCount: pendingSync?.c ?? 0,
    lastSyncAt: lastSync?.t ?? null,
  };
}
