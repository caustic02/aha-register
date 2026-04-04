/**
 * Serialises all withTransactionAsync calls on a SQLiteDatabase handle
 * through a single promise queue, preventing the
 * NativeDatabase.execAsync NullPointerException on Android.
 *
 * Root cause: expo-sqlite v15 (SDK 55) on Android does not handle two
 * concurrent withTransactionAsync calls on the same connection. When the
 * quick-capture fire-and-forget pattern (rapid tapping) or a sync-cycle
 * startup races with a capture transaction, both call execAsync('BEGIN')
 * in the native layer at the same time, and the underlying
 * android.database.sqlite.SQLiteDatabase object throws NPE.
 *
 * Fix: queue every withTransactionAsync so only one is in flight at a
 * time. Reads (getFirstAsync, getAllAsync) are not queued — they run
 * concurrently under WAL mode without conflict.
 *
 * runAsync calls outside transactions are also not queued; they
 * auto-commit individually and do not open a BEGIN/COMMIT block, so
 * they do not conflict with the serialised write transactions.
 */
import type { SQLiteDatabase } from 'expo-sqlite';

let writeQueue: Promise<unknown> = Promise.resolve();

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const result: Promise<T> = writeQueue.then(fn);
  // Absorb errors so a failed transaction never poisons the queue.
  writeQueue = result.then(
    () => {},
    () => {},
  );
  return result;
}

/**
 * Returns a proxy around `db` that serialises `withTransactionAsync`
 * (and `withExclusiveTransactionAsync` if called) through a single queue.
 * All other methods delegate directly to the underlying handle.
 */
export function createSerializedDb(db: SQLiteDatabase): SQLiteDatabase {
  return new Proxy(db, {
    get(target, prop) {
      if (
        prop === 'withTransactionAsync' ||
        prop === 'withExclusiveTransactionAsync'
      ) {
        return (task: () => Promise<void>) =>
          enqueue(() =>
            (target[prop as 'withTransactionAsync'] as typeof target.withTransactionAsync)(task),
          );
      }
      const value = Reflect.get(target, prop, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}
