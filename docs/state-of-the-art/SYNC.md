# State of the Art: Sync Engine

> Last updated: 2026-03-15
> Status: PARTIAL — queue and transport layers implemented; Supabase write path is skeleton

## What This Is
Offline-first sync architecture. Local SQLite is source of truth. `sync_queue` is populated at every capture. The sync engine and transport layer are substantially implemented but the Supabase write path (lines 235–248 of sync-transport.ts) is still a skeleton.

## Architecture

### Queue Layer (`src/sync/engine.ts`)
- `SyncEngine.queueChange(table, recordId, action, payload)` — FIFO insert into `sync_queue`
- Status state machine: `pending → syncing → synced | failed`
- Retry tracking: `retry_count` column, max 5 retries
- **Already called at every capture** — queue is being populated in production

### Transport Layer (`src/services/sync-transport.ts`)
- `pushChanges()` — batch push (50 items per run), network-gated via `expo-network`
- `pullChanges()` — pull all syncable tables from Supabase
- Conflict resolution: last-write-wins by `updated_at` timestamp
- `institution_id` injected into all institution-scoped table payloads from `SETTING_KEYS.SYNC_INSTITUTION_ID`
- **Skeleton:** Supabase `.upsert()` call block (lines 235–248) is not yet wired — actual DB write is a no-op stub

### Supabase Backend (Infrastructure Ready)
- Cloud schema: `docs/migrations/20260309100000_cloud_schema_v1.sql`
- RLS policies: `docs/migrations/20260309110000_rls_policies_v1.sql`
- Migrations written but not yet applied to production project

### Sequence to Complete
1. Apply migrations to Supabase project
2. Wire lines 235–248 in sync-transport.ts (`.upsert()` the payload)
3. Add Supabase auth token to transport request headers
4. Add sync UI feedback (progress, last-sync timestamp, conflict indicators)

## Key Files

| File | Purpose |
|------|---------|
| `src/sync/engine.ts` | SyncEngine class — `queueChange()` and `sync()` orchestration |
| `src/services/sync-transport.ts` | Transport layer — push/pull logic, network gating, institution scoping |
| `src/db/schema.ts` | `sync_queue` table definition |
| `docs/migrations/` | Cloud schema and RLS policies ready to apply |

## Known Gaps

- Supabase write path is skeleton (lines 235–248 of sync-transport.ts)
- Migrations not yet applied to production Supabase project
- Auth token not yet passed in transport headers
- No sync UI beyond settings screen status indicator
- CRDT / manual conflict resolution not implemented (last-write-wins only)
