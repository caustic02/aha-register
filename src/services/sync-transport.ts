import type { SQLiteDatabase } from 'expo-sqlite';
import * as Network from 'expo-network';
import { supabase } from './supabase';
import { getSetting, setSetting } from './settingsService';
import { generateId } from '../utils/uuid';
import type { SyncQueueItem } from '../db/types';
import { uploadMediaToStorage } from './storage-upload';

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
  'collections',
  'objects',
  'media',
  'annotations',
  'vocabulary_terms',
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
  private columnCache = new Map<string, Set<string>>();

  constructor(private db: SQLiteDatabase) {}

  /** Get the set of column names for a local SQLite table (cached). */
  private async getLocalColumns(table: string): Promise<Set<string>> {
    if (this.columnCache.has(table)) return this.columnCache.get(table)!;
    const rows = await this.db.getAllAsync<{ name: string }>(
      `PRAGMA table_info(${table})`,
    );
    const cols = new Set(rows.map((r) => r.name));
    this.columnCache.set(table, cols);
    return cols;
  }

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
    // getUser() forces a server check and triggers token refresh if needed.
    // getSession() only returns the cached session which may have an expired JWT.
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (user) {
      if (__DEV__) console.log(`[sync] session verified: user=${user.id.slice(0, 8)}`);
      return user.id;
    }

    if (__DEV__) console.warn(`[sync] getUser failed: ${userError?.message ?? 'no user'}, trying refresh`);

    // Explicit refresh as fallback
    const { data, error } = await supabase.auth.refreshSession();
    if (error || !data.session) {
      if (__DEV__) console.warn('[sync] session expired, cannot refresh');
      return null;
    }
    if (__DEV__) console.log(`[sync] session refreshed: user=${data.session.user.id.slice(0, 8)}`);
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
    let payload = item.payload ? JSON.parse(item.payload) : {};

    // For media rows, read the FULL local record so all columns
    // (view_type, view_dimensions, view_notes, storage_path) get pushed
    if (table === 'media') {
      const fullRow = await this.db.getFirstAsync<Record<string, unknown>>(
        `SELECT * FROM media WHERE id = ?`,
        [item.record_id],
      );
      if (fullRow) {
        payload = { ...fullRow, ...payload };
        // Strip local-only file_path (device path, not useful in cloud)
        // but keep storage_path which is the cloud reference
      }
    }

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
    if ('protocol_complete' in payload) payload.protocol_complete = Boolean(payload.protocol_complete);
    if ('belastete_provenienz' in payload) payload.belastete_provenienz = Boolean(payload.belastete_provenienz);
    if ('leihgabe' in payload) payload.leihgabe = Boolean(payload.leihgabe);
    if ('ausfuhrgenehmigung' in payload) payload.ausfuhrgenehmigung = Boolean(payload.ausfuhrgenehmigung);

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

    // For media rows: upload the actual file to Supabase Storage if not yet uploaded
    if (table === 'media' && (item.action === 'insert' || item.action === 'update')) {
      const localPath = payload.file_path as string | undefined;
      const existingStoragePath = payload.storage_path as string | undefined;
      const objectId = payload.object_id as string | undefined;

      if (localPath && !existingStoragePath && objectId && userId) {
        const ext = (payload.mime_type as string)?.split('/')[1] ?? 'jpg';
        const storagePath = await uploadMediaToStorage(
          localPath,
          userId,
          objectId,
          item.record_id,
          ext,
        );
        if (storagePath) {
          const now = new Date().toISOString();
          // Update local SQLite
          await this.db.runAsync(
            `UPDATE media SET storage_path = ?, updated_at = ? WHERE id = ?`,
            [storagePath, now, item.record_id],
          );
          // Update cloud record
          await supabase
            .from('media')
            .update({ storage_path: storagePath, updated_at: now })
            .eq('id', item.record_id);
        }
      }
    }
  }

  // ── Pull ─────────────────────────────────────────────────────────────────

  async pullChanges(since: string): Promise<PullResult> {
    const result: PullResult = { inserted: 0, updated: 0, skipped: 0, conflicts: 0 };

    // Ensure we have a valid session — RLS returns 0 rows without auth
    const userId = await this.ensureSession();
    if (!userId) {
      if (__DEV__) console.warn('[sync] pull: no valid session, aborting');
      return result;
    }
    if (__DEV__) console.log(`[sync] pull: session OK (user=${userId.slice(0, 8)}), since=${since}`);

    for (const table of SYNCABLE_TABLES) {
      if (table === 'audit_trail') {
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

    const { data: rows, error, status, statusText } = await query;
    if (error) {
      if (__DEV__) console.warn(`[sync] pull ${table} error: ${error.message} (HTTP ${status})`);
      return;
    }
    if (__DEV__) console.log(`[sync] pull ${table}: ${rows?.length ?? 0} rows (HTTP ${status} ${statusText ?? ''}, since=${since})`);
    if (!rows || rows.length === 0) return;

    for (let ri = 0; ri < rows.length; ri++) {
      const remoteRow = rows[ri];
      try {
        if (__DEV__ && ri < 3) console.log(`[sync] merging ${table}/${(remoteRow.id as string).slice(0, 8)} title=${(remoteRow as Record<string, unknown>).title ?? '—'}`);
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
    if ('protocol_complete' in localRow) localRow.protocol_complete = localRow.protocol_complete ? 1 : 0;
    if ('belastete_provenienz' in localRow) localRow.belastete_provenienz = localRow.belastete_provenienz ? 1 : 0;
    if ('leihgabe' in localRow) localRow.leihgabe = localRow.leihgabe ? 1 : 0;
    if ('ausfuhrgenehmigung' in localRow) localRow.ausfuhrgenehmigung = localRow.ausfuhrgenehmigung ? 1 : 0;

    // Provide defaults for NOT NULL columns that might be null in remote data
    if (table === 'media') {
      if (!localRow.sha256_hash) localRow.sha256_hash = 'remote';
      if (!localRow.file_name) localRow.file_name = 'unknown';
      if (!localRow.file_type) localRow.file_type = 'image';
      if (!localRow.mime_type) localRow.mime_type = 'image/jpeg';
      if (!localRow.privacy_tier) localRow.privacy_tier = 'public';
      if (!localRow.ocr_source) localRow.ocr_source = 'none';
      if (!localRow.media_type) localRow.media_type = 'original';
    }
    if (table === 'objects') {
      if (!localRow.object_type) localRow.object_type = 'museum_object';
      if (!localRow.status) localRow.status = 'draft';
      if (!localRow.title) localRow.title = 'Untitled';
      if (!localRow.privacy_tier) localRow.privacy_tier = 'public';
      if (!localRow.review_status) localRow.review_status = 'complete';
    }

    // Stringify jsonb columns for SQLite TEXT storage
    for (const col of ['type_specific_data', 'contact_info', 'device_info', 'evidence_context', 'old_values', 'new_values', 'settings', 'shots_completed', 'shots_remaining']) {
      if (col in localRow && localRow[col] !== null && typeof localRow[col] === 'object') {
        localRow[col] = JSON.stringify(localRow[col]);
      }
    }

    // Filter to only columns that exist in the local SQLite table
    const localCols = await this.getLocalColumns(table);
    if (localCols.size > 0) {
      for (const key of Object.keys(localRow)) {
        if (!localCols.has(key)) {
          if (__DEV__ && key !== 'institution_id' && key !== 'user_id') {
            console.log(`[sync] skipping unknown column ${table}.${key}`);
          }
          delete localRow[key];
        }
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

      // For media: ensure file_path is displayable
      if (table === 'media') {
        await this.ensureMediaDisplayPath(id, localRow);
      }
      return;
    }

    if (appendOnly) {
      result.skipped++;
      return;
    }

    // Conflict resolution: if local record has a pending push, skip remote
    const pendingLocal = await this.db.getFirstAsync<{ id: string }>(
      `SELECT id FROM sync_queue WHERE table_name = ? AND record_id = ? AND status IN ('pending', 'syncing')`,
      [table, id],
    );
    if (pendingLocal) {
      result.skipped++;
      result.conflicts++;
      if (__DEV__) console.log(`[sync] skipping ${table}/${id}: pending local push`);
      return;
    }

    // No pending local changes — remote wins if newer
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

      // For media: ensure file_path is displayable
      if (table === 'media') {
        await this.ensureMediaDisplayPath(id, localRow);
      }

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

  /**
   * After pulling a media record, ensure file_path is displayable.
   * - If file_path is already an http(s) URL (e.g. Met CDN), keep it
   * - If file_path is a local device path from another device, replace
   *   with Supabase Storage URL from storage_path
   * - If storage_path exists but file_path is a dead local path, fix it
   */
  private async ensureMediaDisplayPath(
    mediaId: string,
    row: Record<string, unknown>,
  ): Promise<void> {
    const filePath = row.file_path as string | null;
    const storagePath = row.storage_path as string | null;

    // Already a remote URL — nothing to do
    if (filePath?.startsWith('http://') || filePath?.startsWith('https://')) {
      return;
    }

    // Has a Supabase Storage path — construct the authenticated URL
    if (storagePath) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data } = supabase.storage.from('media').getPublicUrl(storagePath);
        if (data?.publicUrl) {
          await this.db.runAsync(
            `UPDATE media SET file_path = ? WHERE id = ?`,
            [data.publicUrl, mediaId],
          );
          return;
        }
      }
    }

    // file_path is a dead local path from another device — clear it
    if (filePath && (filePath.startsWith('/data/') || filePath.startsWith('file://'))) {
      // Leave as-is; the app handles missing files with placeholders
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
