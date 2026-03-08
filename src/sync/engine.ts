import type { SQLiteDatabase } from 'expo-sqlite';
import * as Crypto from 'expo-crypto';

export type SyncAction = 'insert' | 'update' | 'delete';
export type SyncStatus = 'pending' | 'syncing' | 'failed';

export interface SyncQueueRow {
  id: string;
  table_name: string;
  record_id: string;
  action: SyncAction;
  payload: string; // JSON
  status: SyncStatus;
  retry_count: number;
  created_at: string;
  updated_at: string;
}

const MAX_RETRIES = 5;

export class SyncEngine {
  constructor(private db: SQLiteDatabase) {}

  async queueChange(
    tableName: string,
    recordId: string,
    action: SyncAction,
    payload: unknown,
  ): Promise<void> {
    const id = Crypto.randomUUID();
    const now = new Date().toISOString();
    await this.db.runAsync(
      `INSERT INTO sync_queue (id, table_name, record_id, action, payload, status, retry_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'pending', 0, ?, ?)`,
      [id, tableName, recordId, action, JSON.stringify(payload), now, now],
    );
  }

  async processPendingSync(): Promise<{ synced: number; failed: number }> {
    let synced = 0;
    let failed = 0;

    const rows = await this.db.getAllAsync<SyncQueueRow>(
      `SELECT * FROM sync_queue WHERE status = 'pending' ORDER BY created_at ASC`,
    );

    for (const row of rows) {
      const now = new Date().toISOString();

      // Mark as syncing
      await this.db.runAsync(
        `UPDATE sync_queue SET status = 'syncing', updated_at = ? WHERE id = ?`,
        [now, row.id],
      );

      try {
        await this.pushToRemote(row);

        await this.db.runAsync(
          `DELETE FROM sync_queue WHERE id = ?`,
          [row.id],
        );
        synced++;
      } catch {
        const newRetryCount = row.retry_count + 1;
        const newStatus: SyncStatus =
          newRetryCount >= MAX_RETRIES ? 'failed' : 'pending';

        await this.db.runAsync(
          `UPDATE sync_queue SET status = ?, retry_count = ?, updated_at = ? WHERE id = ?`,
          [newStatus, newRetryCount, new Date().toISOString(), row.id],
        );

        if (newStatus === 'failed') {
          failed++;
        }
      }
    }

    return { synced, failed };
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

  // Placeholder — throws until a real transport is wired in
  private async pushToRemote(_row: SyncQueueRow): Promise<void> {
    throw new Error('Not connected');
  }
}
