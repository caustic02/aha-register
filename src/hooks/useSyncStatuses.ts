/**
 * Batched per-object sync status hook.
 *
 * Takes a list of object IDs, queries sync_queue once per poll, and returns
 * a Map<id, ObjectSyncStatus>. Polls every 30 seconds and refreshes when
 * the app returns to the foreground.
 */
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import * as Network from 'expo-network';
import { useDatabase } from '../contexts/DatabaseContext';

export type ObjectSyncStatus = 'synced' | 'pending' | 'failed' | 'offline';

const POLL_MS = 30_000;

export function useSyncStatuses(
  objectIds: string[],
): Map<string, ObjectSyncStatus> {
  const db = useDatabase();
  const [statusMap, setStatusMap] = useState<Map<string, ObjectSyncStatus>>(
    new Map(),
  );

  // Primitive string dep so the effect only re-runs when the actual IDs change,
  // not on every render due to a new array reference.
  const idsKey = objectIds.join(',');

  useEffect(() => {
    // objectIds captured at effect-setup time; safe because idsKey ensures
    // the effect re-runs whenever the IDs change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const ids = objectIds;
    let cancelled = false;

    async function refresh() {
      if (ids.length === 0) {
        if (!cancelled) setStatusMap(new Map());
        return;
      }
      try {
        const networkState = await Network.getNetworkStateAsync();
        const isOnline =
          (networkState.isConnected ?? false) &&
          (networkState.isInternetReachable ?? false);

        const placeholders = ids.map(() => '?').join(', ');
        const rows = await db.getAllAsync<{
          record_id: string;
          status: string;
        }>(
          `SELECT record_id, status FROM sync_queue
           WHERE table_name = 'objects' AND record_id IN (${placeholders})`,
          ids,
        );

        if (cancelled) return;

        const map = new Map<string, ObjectSyncStatus>();
        for (const id of ids) {
          if (!isOnline) {
            map.set(id, 'offline');
          } else {
            const itemRows = rows.filter((r) => r.record_id === id);
            if (itemRows.some((r) => r.status === 'failed')) {
              map.set(id, 'failed');
            } else if (
              itemRows.some(
                (r) => r.status === 'pending' || r.status === 'syncing',
              )
            ) {
              map.set(id, 'pending');
            } else {
              map.set(id, 'synced');
            }
          }
        }
        setStatusMap(map);
      } catch {
        // Keep previous state on error
      }
    }

    refresh();
    const interval = setInterval(refresh, POLL_MS);
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') refresh();
    });
    return () => {
      cancelled = true;
      clearInterval(interval);
      sub.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, idsKey]);

  return statusMap;
}
