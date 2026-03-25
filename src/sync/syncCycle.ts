/**
 * True while at least one SyncEngine.sync() is running (push + pull network work).
 * Ref-counted so overlapping sync calls from different engine instances stay correct.
 */
let activeDepth = 0;
const listeners = new Set<() => void>();

export function beginSyncCycle(): void {
  activeDepth += 1;
  if (activeDepth === 1) {
    for (const l of listeners) l();
  }
}

export function endSyncCycle(): void {
  activeDepth = Math.max(0, activeDepth - 1);
  if (activeDepth === 0) {
    for (const l of listeners) l();
  }
}

export function getSyncCycleActive(): boolean {
  return activeDepth > 0;
}

export function subscribeSyncCycle(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
