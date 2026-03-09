import type { SQLiteDatabase } from 'expo-sqlite';
import { AppState } from 'react-native';
import type { SyncAction, SyncStatus, SyncQueueItem } from '../db/types';
import { SyncTransport } from '../services/sync-transport';
import { getSetting } from '../services/settingsService';
import { generateId } from '../utils/uuid';

export type { SyncAction, SyncStatus, SyncQueueItem };

const MAX_RETRIES = 5;

export class SyncEngine {
  private transport: SyncTransport;
  private syncing = false;
  private appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;

  constructor(private db: SQLiteDatabase) {
    this.transport = new SyncTransport(db);
  }

  // ── Queue management (unchanged public API) ──────────────────────────────

  async queueChange(
    tableName: string,
    recordId: string,
    action: SyncAction,
    payload: unknown,
  ): Promise<void> {
    const id = generateId();
    const now = new Date().toISOString();
    await this.db.runAsync(
      `INSERT INTO sync_queue (id, table_name, record_id, action, payload, status, retry_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'pending', 0, ?, ?)`,
      [id, tableName, recordId, action, JSON.stringify(payload), now, now],
    );
  }

  async getSyncStatus(): Promise<{
    pending: number;
    syncing: number;
    failed: number;
  }> {
    const rows = await this.db.getAllAsync<{ status: SyncStatus; count: number }>(
      `SELECT status, COUNT(*) as count FROM sync_queue GROUP BY status`,
    );

    const result = { pending: 0, syncing: 0, failed: 0 };
    for (const row of rows) {
      if (row.status in result) {
        result[row.status] = row.count;
      }
    }
    return result;
  }

  // ── Full sync cycle ──────────────────────────────────────────────────────

  /**
   * Run a full sync cycle: push local changes, then pull remote changes.
   * Returns silently if offline, sync is disabled, or already syncing.
   */
  async sync(): Promise<void> {
    if (this.syncing) {
      if (__DEV__) console.log('[sync] already in progress, skipping');
      return;
    }

    const enabled = await getSetting(this.db, 'sync_enabled');
    if (enabled !== 'true') {
      if (__DEV__) console.log('[sync] disabled, skipping');
      return;
    }

    const online = await this.transport.isOnline();
    if (!online) {
      if (__DEV__) console.log('[sync] offline, skipping');
      return;
    }

    this.syncing = true;
    try {
      if (__DEV__) console.log('[sync] starting sync cycle');

      // Push
      const pending = await this.db.getAllAsync<SyncQueueItem>(
        `SELECT * FROM sync_queue WHERE status IN ('pending', 'failed') AND retry_count <= ? ORDER BY created_at ASC`,
        [MAX_RETRIES],
      );

      if (pending.length > 0) {
        const pushResult = await this.transport.pushChanges(pending);
        if (__DEV__) console.log(`[sync] push complete: ${pushResult.pushed} pushed, ${pushResult.failed} failed, ${pushResult.skipped} skipped`);
      }

      // Pull
      const lastSync = await this.transport.getLastSyncTimestamp();
      const since = lastSync ?? '1970-01-01T00:00:00.000Z';
      const pullResult = await this.transport.pullChanges(since);
      if (__DEV__) console.log(`[sync] pull complete: ${pullResult.inserted} inserted, ${pullResult.updated} updated, ${pullResult.skipped} skipped, ${pullResult.conflicts} conflicts`);

      // Update timestamp
      await this.transport.setLastSyncTimestamp(new Date().toISOString());
      if (__DEV__) console.log('[sync] cycle complete');
    } catch (err) {
      if (__DEV__) console.warn('[sync] cycle error:', err);
    } finally {
      this.syncing = false;
    }
  }

  // ── Auto-sync listeners ──────────────────────────────────────────────────

  /**
   * Start listening for foreground and network-reconnect events.
   * Call once at app startup.
   */
  startAutoSync(): void {
    // Sync when app comes to foreground
    this.appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        this.sync();
      }
    });

    if (__DEV__) console.log('[sync] auto-sync listeners started');
  }

  /**
   * Stop all auto-sync listeners. Call on cleanup.
   */
  stopAutoSync(): void {
    this.appStateSubscription?.remove();
    this.appStateSubscription = null;
    if (__DEV__) console.log('[sync] auto-sync listeners stopped');
  }

  /** Manual trigger for "Sync Now" button. */
  triggerSync(): void {
    this.sync();
  }

  /** Legacy method — now delegates to the full sync cycle. */
  async processPendingSync(): Promise<{ synced: number; failed: number }> {
    const pending = await this.db.getAllAsync<SyncQueueItem>(
      `SELECT * FROM sync_queue WHERE status IN ('pending', 'failed') AND retry_count <= ? ORDER BY created_at ASC`,
      [MAX_RETRIES],
    );

    if (pending.length === 0) return { synced: 0, failed: 0 };

    const online = await this.transport.isOnline();
    if (!online) return { synced: 0, failed: 0 };

    const result = await this.transport.pushChanges(pending);
    return { synced: result.pushed, failed: result.failed };
  }
}
