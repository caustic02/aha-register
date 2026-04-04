/**
 * Hook providing real-time sync status for UI indicators.
 * Polls sync_queue counts and network state every 30 seconds.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as Network from 'expo-network';
import { useDatabase } from '../contexts/DatabaseContext';
import { getSetting } from '../services/settingsService';
import {
  getSyncCycleActive,
  subscribeSyncCycle,
} from '../sync/syncCycle';

export type SyncStatusValue = 'idle' | 'syncing' | 'offline' | 'error';

export interface SyncStatusState {
  status: SyncStatusValue;
  pendingCount: number;
  failedCount: number;
  lastSyncedAt: Date | null;
}

const POLL_INTERVAL_MS = 30_000;

export function useSyncStatus(): SyncStatusState {
  const db = useDatabase();
  const [state, setState] = useState<SyncStatusState>({
    status: 'idle',
    pendingCount: 0,
    failedCount: 0,
    lastSyncedAt: null,
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const refreshRef = useRef<() => Promise<void>>(async () => {});

  const refresh = useCallback(async () => {
    try {
      // Query counts in parallel with network check
      const [pendingRow, failedRow, networkState, lastSyncTs] =
        await Promise.all([
          db.getFirstAsync<{ count: number }>(
            "SELECT COUNT(*) as count FROM sync_queue WHERE status IN ('pending', 'syncing')",
          ),
          db.getFirstAsync<{ count: number }>(
            "SELECT COUNT(*) as count FROM sync_queue WHERE status = 'failed'",
          ),
          Network.getNetworkStateAsync(),
          getSetting(db, 'last_sync_timestamp'),
        ]);

      const pendingCount = pendingRow?.count ?? 0;
      const failedCount = failedRow?.count ?? 0;
      const isOnline =
        (networkState.isConnected ?? false) &&
        (networkState.isInternetReachable ?? false);
      const lastSyncedAt = lastSyncTs ? new Date(lastSyncTs) : null;
      const syncCycleActive = getSyncCycleActive();

      let status: SyncStatusValue;
      if (syncCycleActive) {
        status = 'syncing';
      } else if (!isOnline) {
        status = 'offline';
      } else if (failedCount > 0) {
        status = 'error';
      } else {
        status = 'idle';
      }

      setState({ status, pendingCount, failedCount, lastSyncedAt });
    } catch {
      // Keep previous state on error
    }
  }, [db]);

  useEffect(() => {
    refreshRef.current = refresh;
  });

  useEffect(() => {
    // Initial load
    refresh();

    // Poll every 30 seconds
    intervalRef.current = setInterval(refresh, POLL_INTERVAL_MS);

    // Refresh when app comes to foreground
    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') refresh();
    });

    const unsubCycle = subscribeSyncCycle(() => {
      if (getSyncCycleActive()) {
        setState((prev) => ({ ...prev, status: 'syncing' }));
      }
      void refreshRef.current();
    });

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      appStateSub.remove();
      unsubCycle();
    };
  }, [refresh]);

  return state;
}
