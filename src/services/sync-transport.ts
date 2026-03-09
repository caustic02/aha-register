import type { SQLiteDatabase } from 'expo-sqlite';
import * as Network from 'expo-network';
import { supabase } from './supabase';
import { getSetting, setSetting } from './settingsService';
import { generateId } from '../utils/uuid';
import type { SyncQueueItem } from '../db/types';

// ── Types ────────────────────────────────────────────────────────────────────

export interface PushResult {
  pushed: number;
  failed: number;
  skipped: number;
  errors: Array<{ id: string; error: string }>;
}

export interface PullResult {
  inserted: number;
  updated: number;
  skipped: number;
  conflicts: number;
}

// ── Constants ────────────────────────────────────────────────────────────────

const BATCH_SIZE = 50;
const MAX_RETRIES = 5;

/** Tables that sync between local and cloud. Order matters for FK deps. */
const SYNCABLE_TABLES = [
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
  'audit_trail',
] as const;

/** Columns that exist in the cloud but not in local SQLite. */
const CLOUD_ONLY_COLUMNS = ['institution_id', 'user_id'] as const;

/**
 * Tables that have an institution_id column in the cloud.
 * vocabulary_terms is global — no institution_id.
 */
const INSTITUTION_SCOPED_TABLES = new Set([
  'institutions', // uses `id` instead of `institution_id`
  'sites',
  'objects',
  'media',
  'annotations',
  'collections',
  'object_collections',
  'locations',
  'documents',
  'audit_trail',
]);

/** Tables that have a user_id column in the cloud. */
const USER_ID_TABLES = new Set([
  'objects',
  'annotations',
  'collections',
  'audit_trail',
]);

/** Tables where the local schema has institution_id already. */
const LOCAL_HAS_INSTITUTION_ID = new Set([
  'institutions',
  'sites',
  'users',
  'objects',
  'collections',
]);

/** Tables where the local schema has user_id already. */
const LOCAL_HAS_USER_ID = new Set([
  'annotations',
  'audit_trail',
]);

// ── Transport ────────────────────────────────────────────────────────────────

export class SyncTransport {
  constructor(private db: SQLiteDatabase) {}

  async isOnline(): Promise<boolean> {
    try {
      const state = await Network.getNetworkStateAsync();
      return (state.isConnected ?? false) && (state.isInternetReachable ?? false);
    } catch {
      return false;
    }
  }

  async getLastSyncTimestamp(): Promise<string | null> {
    return getSetting(this.db, 'last_sync_timestamp');
  }

  async setLastSyncTimestamp(timestamp: string): Promise<void> {
    await setSetting(this.db, 'last_sync_timestamp', timestamp);
  }

  /** Verify session is valid; refresh if expired. Returns user id or null. */
  async ensureSession(): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) return session.user.id;

    // Try refresh
    const { data, error } = await supabase.auth.refreshSession();
    if (error || !data.session) {
      if (__DEV__) console.warn('[sync] session expired, cannot refresh');
      return null;
    }
    return data.session.user.id;
  }

  // ── Push ─────────────────────────────────────────────────────────────────

  async pushChanges(queue: SyncQueueItem[]): Promise<PushResult> {
    const result: PushResult = { pushed: 0, failed: 0, skipped: 0, errors: [] };

    const institutionId = await getSetting(this.db, 'sync_institution_id');
    const userId = await this.ensureSession();
    if (!userId) {
      if (__DEV__) console.warn('[sync] no valid session, aborting push');
      return result;
    }

    for (let i = 0; i < queue.length; i += BATCH_SIZE) {
      const batch = queue.slice(i, i + BATCH_SIZE);

      for (const item of batch) {
        if (item.retry_count > MAX_RETRIES) {
          result.skipped++;
          if (__DEV__) console.log(`[sync] skipping permanently failed: ${item.id}`);
          continue;
        }

        const now = new Date().toISOString();
        await this.db.runAsync(
          `UPDATE sync_queue SET status = 'syncing', updated_at = ? WHERE id = ?`,
          [now, item.id],
        );

        try {
          await this.pushSingleItem(item, institutionId, userId);

          await this.db.runAsync(`DELETE FROM sync_queue WHERE id = ?`, [item.id]);
          result.pushed++;
          if (__DEV__) console.log(`[sync] pushed ${item.action} ${item.table_name}/${item.record_id}`);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          const newRetryCount = item.retry_count + 1;
          const newStatus = newRetryCount >= MAX_RETRIES ? 'failed' : 'pending';

          await this.db.runAsync(
            `UPDATE sync_queue SET status = ?, retry_count = ?, updated_at = ? WHERE id = ?`,
            [newStatus, newRetryCount, new Date().toISOString(), item.id],
          );

          result.failed++;
          result.errors.push({ id: item.id, error: errorMsg });
          if (__DEV__) console.warn(`[sync] push failed ${item.table_name}/${item.record_id}: ${errorMsg}`);
        }
      }
    }

    return result;
  }

  private async pushSingleItem(
    item: SyncQueueItem,
    institutionId: string | null,
    userId: string | null,
  ): Promise<void> {
    const table = item.table_name;

    if (item.action === 'delete') {
      const { error } = await supabase.from(table).delete().eq('id', item.record_id);
      if (error) throw new Error(error.message);
      return;
    }

    // INSERT or UPDATE — upsert for idempotency
    const payload = item.payload ? JSON.parse(item.payload) : {};

    // Add cloud-only columns
    if (table === 'institutions' && institutionId) {
      // For institutions, the local id IS the institution_id in cloud
      // No extra column needed
    } else if (INSTITUTION_SCOPED_TABLES.has(table) && institutionId) {
      if (!LOCAL_HAS_INSTITUTION_ID.has(table) || !payload.institution_id) {
        payload.institution_id = institutionId;
      }
    }

    if (USER_ID_TABLES.has(table) && userId) {
      if (!LOCAL_HAS_USER_ID.has(table) || !payload.user_id) {
        payload.user_id = userId;
      }
    }

    // object_collections: added_by maps to auth user
    if (table === 'object_collections' && userId && !payload.added_by) {
      payload.added_by = userId;
    }

    // Convert SQLite boolean integers to real booleans for Postgres
    if ('legal_hold' in payload) payload.legal_hold = Boolean(payload.legal_hold);
    if ('is_primary' in payload) payload.is_primary = Boolean(payload.is_primary);

    // Parse JSON text fields into objects for jsonb columns
    for (const col of ['type_specific_data', 'contact_info', 'device_info', 'evidence_context', 'old_values', 'new_values']) {
      if (col in payload && typeof payload[col] === 'string') {
        try { payload[col] = JSON.parse(payload[col]); } catch { /* keep as string */ }
      }
    }

    const { error } = await supabase
      .from(table)
      .upsert(payload, { onConflict: 'id' });

    if (error) throw new Error(error.message);
  }

  // ── Pull ─────────────────────────────────────────────────────────────────

  async pullChanges(since: string): Promise<PullResult> {
    const result: PullResult = { inserted: 0, updated: 0, skipped: 0, conflicts: 0 };

    for (const table of SYNCABLE_TABLES) {
      if (table === 'audit_trail') {
        // Audit trail is append-only, only pull new records
        await this.pullTable(table, since, result, true);
      } else {
        await this.pullTable(table, since, result, false);
      }
    }

    return result;
  }

  private async pullTable(
    table: string,
    since: string,
    result: PullResult,
    appendOnly: boolean,
  ): Promise<void> {
    let query = supabase.from(table).select('*');

    // For tables with updated_at, filter by timestamp
    if (table === 'audit_trail') {
      query = query.gt('created_at', since);
    } else {
      query = query.gt('updated_at', since);
    }

    const { data: rows, error } = await query;
    if (error) {
      if (__DEV__) console.warn(`[sync] pull ${table} error: ${error.message}`);
      return;
    }
    if (!rows || rows.length === 0) return;

    if (__DEV__) console.log(`[sync] pulled ${rows.length} rows from ${table}`);

    for (const remoteRow of rows) {
      try {
        await this.mergeRemoteRow(table, remoteRow, result, appendOnly);
      } catch (err) {
        if (__DEV__) console.warn(`[sync] merge error ${table}/${remoteRow.id}: ${err}`);
      }
    }
  }

  private async mergeRemoteRow(
    table: string,
    remoteRow: Record<string, unknown>,
    result: PullResult,
    appendOnly: boolean,
  ): Promise<void> {
    const id = remoteRow.id as string;

    // Strip cloud-only columns before local insert
    const localRow = { ...remoteRow };
    for (const col of CLOUD_ONLY_COLUMNS) {
      if (!this.localTableHasColumn(table, col)) {
        delete localRow[col];
      }
    }
    // Also strip auth_user_id from users table (cloud-only)
    if (table === 'users') delete localRow.auth_user_id;

    // Convert Postgres booleans back to SQLite integers
    if ('legal_hold' in localRow) localRow.legal_hold = localRow.legal_hold ? 1 : 0;
    if ('is_primary' in localRow) localRow.is_primary = localRow.is_primary ? 1 : 0;

    // Stringify jsonb columns for SQLite TEXT storage
    for (const col of ['type_specific_data', 'contact_info', 'device_info', 'evidence_context', 'old_values', 'new_values', 'settings']) {
      if (col in localRow && localRow[col] !== null && typeof localRow[col] === 'object') {
        localRow[col] = JSON.stringify(localRow[col]);
      }
    }

    // Check if local record exists
    const existing = await this.db.getFirstAsync<{ id: string; updated_at?: string; created_at?: string }>(
      `SELECT id, ${table === 'audit_trail' ? 'created_at' : 'updated_at'} as updated_at FROM ${table} WHERE id = ?`,
      [id],
    );

    if (!existing) {
      // No local record — insert
      const columns = Object.keys(localRow);
      const placeholders = columns.map(() => '?').join(', ');
      const values = columns.map((c) => localRow[c] as string | number | null);

      await this.db.runAsync(
        `INSERT OR IGNORE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
        values,
      );
      result.inserted++;
      return;
    }

    if (appendOnly) {
      result.skipped++;
      return;
    }

    // Conflict resolution: last-write-wins by updated_at
    const remoteUpdated = remoteRow.updated_at as string;
    const localUpdated = existing.updated_at ?? '';

    if (remoteUpdated > localUpdated) {
      // Remote wins — update local
      const columns = Object.keys(localRow).filter((c) => c !== 'id');
      const setClause = columns.map((c) => `${c} = ?`).join(', ');
      const values = columns.map((c) => localRow[c] as string | number | null);
      values.push(id);

      await this.db.runAsync(
        `UPDATE ${table} SET ${setClause} WHERE id = ?`,
        values,
      );
      result.updated++;

      // Log conflict if timestamps differ meaningfully
      if (localUpdated && localUpdated !== remoteUpdated) {
        result.conflicts++;
        await this.logConflict(table, id, 'remote_wins', localUpdated, remoteUpdated);
      }
    } else {
      // Local wins — skip (will push in next cycle)
      result.skipped++;
      if (localUpdated !== remoteUpdated) {
        result.conflicts++;
        await this.logConflict(table, id, 'local_wins', localUpdated, remoteUpdated);
      }
    }
  }

  private localTableHasColumn(table: string, column: string): boolean {
    if (column === 'institution_id') return LOCAL_HAS_INSTITUTION_ID.has(table);
    if (column === 'user_id') return LOCAL_HAS_USER_ID.has(table);
    return false;
  }

  private async logConflict(
    table: string,
    recordId: string,
    resolution: string,
    localTimestamp: string,
    remoteTimestamp: string,
  ): Promise<void> {
    const id = generateId();
    const now = new Date().toISOString();
    await this.db.runAsync(
      `INSERT INTO audit_trail (id, table_name, record_id, action, old_values, new_values, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        table,
        recordId,
        'sync_conflict',
        JSON.stringify({ resolution, local_updated_at: localTimestamp }),
        JSON.stringify({ remote_updated_at: remoteTimestamp }),
        now,
      ],
    );
  }
}
