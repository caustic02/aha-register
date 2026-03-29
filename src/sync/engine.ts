import type { SQLiteDatabase } from 'expo-sqlite';
import { AppState } from 'react-native';
import type { SyncAction, SyncStatus, SyncQueueItem } from '../db/types';
import { SyncTransport } from '../services/sync-transport';
import { getSetting } from '../services/settingsService';
import { generateId } from '../utils/uuid';
import { beginSyncCycle, endSyncCycle } from './syncCycle';

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
    beginSyncCycle();
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

      // Pull — one-time reset to pick up seed data (v0.4.0b)
      const PULL_RESET_KEY = 'pull_reset_v040e';
      const resetDone = await getSetting(this.db, PULL_RESET_KEY);
      const rawTs = await this.transport.getLastSyncTimestamp();
      if (__DEV__) console.log(`[sync] raw last_sync_timestamp=${rawTs}, resetDone=${resetDone}`);

      if (resetDone !== 'true') {
        if (__DEV__) console.log('[sync] running one-time pull reset to 2026-03-28');
        await this.transport.setLastSyncTimestamp('2026-03-28T00:00:00.000Z');
        await this.db.runAsync(
          `INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, 'true', ?)`,
          [PULL_RESET_KEY, new Date().toISOString()],
        );
      }

      const lastSync = await this.transport.getLastSyncTimestamp();
      const since = lastSync ?? '1970-01-01T00:00:00.000Z';
      if (__DEV__) console.log(`[sync] after reset check, since=${since}`);
      const pullResult = await this.transport.pullChanges(since);
      if (__DEV__) console.log(`[sync] pull complete: ${pullResult.inserted} inserted, ${pullResult.updated} updated, ${pullResult.skipped} skipped, ${pullResult.conflicts} conflicts`);

      // Post-sync: cloud OCR for eligible document scans (fire-and-forget)
      this.runPostSyncCloudOcr().catch(() => {});

      // Update timestamp
      await this.transport.setLastSyncTimestamp(new Date().toISOString());
      if (__DEV__) console.log('[sync] cycle complete');
    } catch (err) {
      if (__DEV__) console.warn('[sync] cycle error:', err);
    } finally {
      endSyncCycle();
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

  // ── Post-sync cloud OCR ──────────────────────────────────────────────────

  /**
   * Fire-and-forget: find document scans with on-device OCR and attempt
   * cloud enhancement via Gemini. Only targets ocr_source='on_device';
   * never re-processes 'cloud' or 'none'. Failures are silent.
   */
  private async runPostSyncCloudOcr(): Promise<void> {
    try {
      const eligible = await this.db.getAllAsync<{ id: string }>(
        `SELECT id FROM media
         WHERE media_type = 'document_scan'
           AND ocr_source = 'on_device'
         ORDER BY created_at DESC
         LIMIT 5`,
      );

      if (eligible.length === 0) return;

      const { upgradeOcrFromCloud } = await import(
        '../services/documentScanService'
      );

      // Read domain setting (best-effort)
      const domain =
        (await getSetting(this.db, 'collection_domain')) ?? 'general';

      for (const row of eligible) {
        await upgradeOcrFromCloud(this.db, row.id, domain);
      }
    } catch {
      // Fire-and-forget: never break sync
    }
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
