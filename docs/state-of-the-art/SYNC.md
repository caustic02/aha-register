# State of the Art: Sync Engine

> Last updated: 2026-03-29
> Status: Active — bidirectional sync (push + pull) fully implemented

## What This Is

Offline-first bidirectional sync architecture. Local SQLite is source of truth. `sync_queue` is populated at every capture event. The sync engine pushes local changes to Supabase and pulls remote changes into local SQLite. Conflict resolution uses sync_queue-aware local-wins: if a record has a pending local push, the remote version is skipped.

---

## Architecture

### Queue Layer (`src/sync/engine.ts`)

- `SyncEngine.queueChange(table, recordId, action, payload)` — FIFO insert into `sync_queue`
- Status state machine: `pending → syncing → synced | failed`
- Retry tracking: `retry_count` column, max 5 retries
- `sync()` orchestrates: push → pull → post-sync hooks → update timestamp
- Auto-sync on foreground via `AppState.addEventListener`
- Manual trigger via `triggerSync()`

### Transport Layer (`src/services/sync-transport.ts`)

#### Push (local → Supabase)

- `pushChanges()` — batch push (50 items per run), network-gated via `expo-network`
- For media rows: reads FULL local record (all columns including view_type, view_dimensions, view_notes, storage_path)
- `institution_id` and `user_id` injected from settings/session
- After upserting media metadata: uploads actual file to Supabase Storage bucket `media` if not already uploaded
- Boolean conversion (SQLite integers → Postgres booleans)
- JSON text → JSONB parsing for complex columns

#### Pull (Supabase → local)

- `pullChanges(since)` — fetches all rows where `updated_at > since` from all syncable tables
- Order follows FK dependencies: institutions → sites → users → objects → media → ...
- For each remote row:
  1. Strip cloud-only columns (`institution_id`, `user_id` where not in local schema)
  2. Convert Postgres booleans back to SQLite integers
  3. Stringify JSONB columns for SQLite TEXT storage
  4. If no local record exists: `INSERT OR IGNORE`
  5. If local record exists: check conflict resolution (below)
- **Media URL handling**: after insert/update, `ensureMediaDisplayPath()` checks if `file_path` is displayable:
  - HTTP/HTTPS URLs (e.g. Met CDN) → keep as-is
  - Supabase Storage `storage_path` → construct public URL and set as `file_path`
  - Dead local device paths from other devices → left for app to show placeholder

#### Conflict Resolution

Two-phase check:
1. **Sync queue check**: if the local record has a pending entry in `sync_queue` (status = 'pending' or 'syncing'), **skip the remote version entirely**. The local change will push in the next cycle.
2. **Timestamp check** (if no pending local push): remote wins if `remote.updated_at > local.updated_at`; otherwise skip.

All conflicts are logged to `audit_trail` with `action = 'sync_conflict'` and resolution metadata.

### Syncable Tables

Order matters for foreign key dependencies:
```
institutions → sites → users → objects → media → annotations →
vocabulary_terms → collections → object_collections → locations →
documents → audit_trail
```

### Android Network Security

`android/app/src/main/res/xml/network_security_config.xml` allows cleartext HTTP for `images.metmuseum.org` (Met museum CC0 image CDN). All other traffic remains HTTPS-only.

---

## Sync Status UI Layer

### `useSyncStatus` — Global hook (`src/hooks/useSyncStatus.ts`)

Provides a single aggregate sync state for the whole queue.

```
export type SyncStatusValue = 'idle' | 'syncing' | 'offline' | 'error';
export interface SyncStatusState {
  status: SyncStatusValue;
  pendingCount: number;
  failedCount: number;
  lastSyncedAt: Date | null;
}
```

- Queries `sync_queue` for `pending/syncing` count and `failed` count
- Network state via `expo-network`
- `lastSyncedAt` from `getSetting(db, 'last_sync_timestamp')`
- Polls every 30 s; also refreshes on `AppState` `active` event

**Status priority:** offline > error (any failed) > syncing (any pending) > idle

### `useSyncStatuses` — Batched per-object hook (`src/hooks/useSyncStatuses.ts`)

Returns a `Map<objectId, ObjectSyncStatus>` for a given list of IDs.

```
export type ObjectSyncStatus = 'synced' | 'pending' | 'failed' | 'offline';
```

### `SyncStatusBar` — Global bar (`src/components/SyncStatusBar.tsx`)

Compact 30 dp bar mounted in `AppShell`. Hidden when idle.

| Status | Background | Content |
|--------|------------|---------|
| `syncing` | `colors.statusSyncing` (blue) | "Syncing N items..." |
| `offline` | `colors.statusOffline` (gray) | "Offline — changes saved locally" |
| `error` | `colors.statusError` (red) | "N items failed to sync" + Retry button |
| `idle` | — | Not rendered |

### `SyncBadge` — Per-object badge (`src/components/SyncBadge.tsx`)

Inline component showing an individual object's sync state (sm = 8dp dot, md = 12dp icon + label).

---

## Post-Sync Hooks

### Cloud OCR Enhancement

After each sync cycle completes (push + pull), the engine fires `runPostSyncCloudOcr()` as a **fire-and-forget** step.

```
sync() → push → pull → runPostSyncCloudOcr() → setLastSyncTimestamp
```

- Targets: `media WHERE media_type = 'document_scan' AND ocr_source = 'on_device'`
- Max 5 per cycle to limit API usage
- Failures never break the sync cycle

---

## Supabase Backend

- Cloud schema fully applied (all tables, columns, RLS policies)
- Storage bucket `media` created (private, 50MB limit, image/video MIME types)
- RLS policies: authenticated users can upload to own folder, read all media

---

## Key Files

| File | Purpose |
|------|---------|
| `src/sync/engine.ts` | SyncEngine class — `queueChange()` and `sync()` orchestration |
| `src/services/sync-transport.ts` | Transport layer — push/pull logic, conflict resolution, media URL handling |
| `src/services/storage-upload.ts` | Supabase Storage upload for media files |
| `src/hooks/useSyncStatus.ts` | Global sync state hook |
| `src/hooks/useSyncStatuses.ts` | Batched per-object sync state hook |
| `src/components/SyncStatusBar.tsx` | Global status bar in AppShell |
| `src/components/SyncBadge.tsx` | Per-object badge component |
| `android/app/src/main/res/xml/network_security_config.xml` | Cleartext HTTP for Met CDN |
| `src/db/schema.ts` | `sync_queue` and `app_settings` tables |

---

## Known Gaps

- CRDT / manual conflict resolution not implemented (sync-queue-aware last-write-wins only)
- `useSyncStatuses` polls independently of `useSyncStatus`; no shared subscription layer yet
- Media file download from Supabase Storage to local filesystem not yet implemented (URLs displayed directly)
- Pull-sync progress callback not yet wired to UI (currently fire-and-forget)
