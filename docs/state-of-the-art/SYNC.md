# State of the Art: Sync Engine

> Last updated: 2026-03-15
> Status: STUB

## What This Is
Offline-first sync architecture. Local SQLite is source of truth. Sync engine skeleton exists with `sync_queue` table and `SyncEngine` class, but transport layer is not wired to Supabase yet.

## Architecture (Planned)
- `sync_queue` table: FIFO queue of local changes (table_name, record_id, action, payload, status, retry_count)
- `SyncEngine` class in `src/sync/engine.ts` (SACRED FILE — do not break the queue interface)
- `src/services/sync-transport.ts` — placeholder transport (not connected to Supabase)
- `SyncEngine.queueChange()` is already called at capture time — queue is being populated
- Sequence to complete: mirror 14 SQLite tables in Supabase → wire transport → add auth → conflict resolution

## Key Files

| File | Purpose |
|------|---------|
| `src/sync/engine.ts` | SyncEngine class — `queueChange()` and future `push()`/`pull()` methods |
| `src/services/sync-transport.ts` | Transport layer stub — not yet connected to Supabase |
| `src/db/schema.ts` | `sync_queue` table definition |

## Known Gaps

- Transport layer not implemented
- Supabase tables not yet mirrored from SQLite schema
- Conflict resolution strategy not defined (last-write-wins vs. CRDT vs. manual)
- Multiple sessions of work to complete
- No sync UI feedback beyond settings screen status indicator
