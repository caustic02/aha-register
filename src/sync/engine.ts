import type { SQLiteDatabase } from 'expo-sqlite';
import { AppState } from 'react-native';
import * as Network from 'expo-network';
import type { SyncAction, SyncStatus, SyncQueueItem } from '../db/types';
import { SyncTransport } from '../services/sync-transport';
import { getSetting, setSetting } from '../services/settingsService';
import { generateId } from '../utils/uuid';
import { beginSyncCycle, endSyncCycle, getSyncCycleActive } from './syncCycle';

export type { SyncAction, SyncStatus, SyncQueueItem };

const MAX_RETRIES = 5;
/** How often (ms) to run a safety-net sync while the app is foregrounded. */
const AUTO_SYNC_INTERVAL_MS = 60_000;
/** How often (ms) to poll network state for offline→online transitions. */
const CONNECTIVITY_POLL_MS = 5_000;

export class SyncEngine {
  private transport: SyncTransport;
  private syncing = false;
  private appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;
  private syncIntervalId: ReturnType<typeof setInterval> | null = null;
  private connectivityIntervalId: ReturnType<typeof setInterval> | null = null;
  private lastOnlineState: boolean | null = null;

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
    // Kick off an immediate sync so captures push within seconds.
    // Guard: don't start a second cycle if one is already running.
    if (!getSyncCycleActive()) {
      this.sync().catch(() => {});
    }
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
   * Reset items that are permanently stuck (retry_count > MAX_RETRIES) back
   * to pending so they get another attempt. This rescues items that previously
   * failed due to now-fixed server/schema bugs (missing location columns,
   * missing institution_id, etc.). Called at the top of every sync cycle.
   */
  private async resetStalledFailures(): Promise<void> {
    try {
      await this.db.runAsync(
        `UPDATE sync_queue
         SET status = 'pending', retry_count = 0, updated_at = ?
         WHERE status = 'failed' AND retry_count > ?`,
        [new Date().toISOString(), MAX_RETRIES],
      );
    } catch {
      // Non-fatal — continue with sync
    }
  }

  /**
   * Run a full sync cycle: push local changes, then pull remote changes.
   * Requires: active Supabase session + network. No settings flag needed.
   */
  async sync(): Promise<void> {
    if (this.syncing) {
      if (__DEV__) console.log('[sync] already in progress, skipping');
      return;
    }

    const online = await this.transport.isOnline();
    if (!online) {
      console.warn('[sync] offline, skipping');
      await setSetting(this.db, 'last_sync_error', 'device offline');
      await setSetting(this.db, 'last_sync_attempt', new Date().toISOString());
      return;
    }

    // Session check — sync only if authenticated
    const userId = await this.transport.ensureSession();
    if (!userId) {
      console.warn('[sync] no active session, skipping');
      await setSetting(this.db, 'last_sync_error', 'no active session (not signed in)');
      await setSetting(this.db, 'last_sync_attempt', new Date().toISOString());
      return;
    }

    // Anonymous users (created via "Skip" → signInAnonymously) have no
    // institution / profile / membership, so every push hits RLS rejection.
    // Local-only mode: data lives in SQLite until the user signs up.
    if (await this.transport.isAnonymousSession()) {
      console.warn('[sync] anonymous session — sync disabled (sign up to enable)');
      await setSetting(this.db, 'last_sync_error', 'sync disabled for anonymous users');
      await setSetting(this.db, 'last_sync_attempt', new Date().toISOString());
      return;
    }

    this.syncing = true;
    beginSyncCycle();
    await setSetting(this.db, 'last_sync_attempt', new Date().toISOString());
    await setSetting(this.db, 'last_sync_error', '');
    await setSetting(this.db, 'last_sync_result', 'syncing...');
    try {
      if (__DEV__) console.log('[sync] starting sync cycle');

      // Rescue items that exceeded MAX_RETRIES due to now-fixed server bugs
      await this.resetStalledFailures();

      // Push
      const pending = await this.db.getAllAsync<SyncQueueItem>(
        `SELECT * FROM sync_queue WHERE status IN ('pending', 'failed') AND retry_count <= ? ORDER BY created_at ASC`,
        [MAX_RETRIES],
      );

      let pushSummary = 'push: 0 items';
      if (pending.length > 0) {
        const pushResult = await this.transport.pushChanges(pending);
        pushSummary = `push: ${pushResult.pushed} ok, ${pushResult.failed} failed, ${pushResult.skipped} skipped`;
        if (pushResult.errors.length > 0) {
          await setSetting(this.db, 'last_sync_error', pushResult.errors.map(e => `${e.id}: ${e.error}`).join('\n'));
        }
        if (__DEV__) console.log(`[sync] ${pushSummary}`);
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
      const pullSummary = `pull: ${pullResult.inserted} ins, ${pullResult.updated} upd, ${pullResult.skipped} skip, ${pullResult.conflicts} conflict`;
      if (__DEV__) console.log(`[sync] ${pullSummary}`);

      // Post-sync: cloud OCR for eligible document scans (fire-and-forget)
      this.runPostSyncCloudOcr().catch(() => {});

      // Update timestamp
      await this.transport.setLastSyncTimestamp(new Date().toISOString());
      await setSetting(this.db, 'last_sync_result', `${pushSummary} | ${pullSummary}`);
      if (__DEV__) console.log('[sync] cycle complete');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[sync] cycle error:', err);
      await setSetting(this.db, 'last_sync_error', msg).catch(() => {});
      await setSetting(this.db, 'last_sync_result', 'FAILED').catch(() => {});
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
    // ── 1. Sync when app comes to foreground ──────────────────────────────
    this.appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        this.sync().catch(() => {});
      }
    });

    // ── 2. Safety-net: sync every 60 s while foregrounded ─────────────────
    this.syncIntervalId = setInterval(() => {
      if (AppState.currentState === 'active') {
        this.sync().catch(() => {});
      }
    }, AUTO_SYNC_INTERVAL_MS);

    // ── 3. Connectivity watch: detect offline → online transitions ─────────
    // expo-network is poll-only; check every 5 s and trigger sync the moment
    // the device comes back online (handles "100 photos taken in airplane mode"
    // scenario without any extra user interaction).
    this.connectivityIntervalId = setInterval(async () => {
      if (AppState.currentState !== 'active') return;
      try {
        const state = await Network.getNetworkStateAsync();
        const isOnline = (state.isConnected ?? false) && (state.isInternetReachable ?? false);
        if (this.lastOnlineState === false && isOnline) {
          if (__DEV__) console.log('[sync] connectivity restored — triggering sync');
          this.sync().catch(() => {});
        }
        this.lastOnlineState = isOnline;
      } catch {
        // Network query failed — ignore
      }
    }, CONNECTIVITY_POLL_MS);

    if (__DEV__) console.log('[sync] auto-sync listeners started (foreground, 60s interval, connectivity watch)');
  }

  /**
   * Stop all auto-sync listeners. Call on cleanup.
   */
  stopAutoSync(): void {
    this.appStateSubscription?.remove();
    this.appStateSubscription = null;
    if (this.syncIntervalId !== null) {
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
    }
    if (this.connectivityIntervalId !== null) {
      clearInterval(this.connectivityIntervalId);
      this.connectivityIntervalId = null;
    }
    this.lastOnlineState = null;
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
