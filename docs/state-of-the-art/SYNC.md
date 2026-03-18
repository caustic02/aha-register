# State of the Art: Sync Engine

> Last updated: 2026-03-18
> Status: Active

## What This Is

Offline-first sync architecture. Local SQLite is source of truth. `sync_queue` is populated at every capture event. The sync engine and transport layer are substantially implemented; the Supabase write-path remains a skeleton pending cloud migration. B3 adds a full sync status UI layer: a global status bar and per-object badges, both backed by reactive hooks.

---

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

---

## Sync Status UI Layer (B3)

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

- Single `SELECT record_id, status FROM sync_queue WHERE table_name = 'objects' AND record_id IN (…)` per poll
- Uses a joined string key (`idsKey = objectIds.join(',')`) as the `useEffect` dep so the effect only re-runs when the set of IDs actually changes, not on every render due to array reference churn
- Same 30 s poll + AppState pattern as `useSyncStatus`

**Status priority per object:** offline (network down) > failed > pending/syncing > synced

### `SyncStatusBar` — Global bar (`src/components/SyncStatusBar.tsx`)

Compact 30 dp bar mounted in `AppShell` above `<MainTabs />`. Hidden when idle (no visual noise for the default state).

| Status | Background | Content |
|--------|------------|---------|
| `syncing` | `colors.statusSyncing` (blue) | "Syncing N items…" |
| `offline` | `colors.statusOffline` (gray) | "Offline — changes saved locally" |
| `error` | `colors.statusError` (red) | "N items failed to sync" + Retry button |
| `idle` | — | Not rendered |

- Animated `translateY` slide-down/up (200 ms, `useNativeDriver: true`)
- Retry button calls `new SyncEngine(db).triggerSync()`
- `accessibilityRole="summary"`, `accessibilityLiveRegion="polite"`, `accessibilityLabel={text}`

### `SyncBadge` — Per-object badge (`src/components/SyncBadge.tsx`)

Inline component showing an individual object's sync state.

| Prop | Values | Rendering |
|------|--------|-----------|
| `size="sm"` | All statuses | 8 dp colored dot; **returns null when synced** (avoids noise) |
| `size="md"` | All statuses | 12 dp icon + `typography.size.xs` label; always visible |

Color mapping:

| Status | Color token | Icon |
|--------|------------|------|
| `synced` | `statusSuccess` | `CheckIcon` |
| `pending` | `statusSyncing` | `SyncIcon` |
| `failed` | `statusError` | `ErrorIcon` |
| `offline` | `statusOffline` | `OfflineIcon` |

Both sizes carry `accessibilityLabel={t('syncBadge.<status>')}`.

### HomeScreen stat card integration

The middle stat card in the Quick Stats row is sync-status-aware:

- `status === 'idle'` + 0 pending → `CheckIcon` (green) + "All synced" + relative last-synced time
- Any pending → `ClockIcon` (amber) + count + "N pending"

---

## Mount Points

| Screen / Component | Hook | Badge size | Location |
|--------------------|------|------------|----------|
| `AppShell` | `useSyncStatus` | — | `SyncStatusBar` above `MainTabs` |
| `HomeScreen` stat card | `useSyncStatus` | — | Middle card in stats row |
| `HomeScreen` inbox thumbnails | `useSyncStatuses(inboxIds)` | `sm` | Overlay, bottom-left of each 52×52 thumb |
| `ObjectListScreen` list view | `useSyncStatuses(objectIds)` | `sm` | `rightElement` of `ListItem` (replaces chevron when non-synced) |
| `ObjectListScreen` grid view | `useSyncStatuses(objectIds)` | `sm` | Absolute overlay, top-right (mutually exclusive with select-mode checkbox) |
| `ObjectDetailScreen` | `useSyncStatuses([objectId])` | `md` | Row between gallery divider and review banner |

---

## Key Files

| File | Purpose |
|------|---------|
| `src/sync/engine.ts` | SyncEngine class — `queueChange()` and `sync()` orchestration |
| `src/services/sync-transport.ts` | Transport layer — push/pull logic, network gating, institution scoping |
| `src/hooks/useSyncStatus.ts` | Global sync state hook (aggregate queue counts + network) |
| `src/hooks/useSyncStatuses.ts` | Batched per-object sync state hook |
| `src/components/SyncStatusBar.tsx` | Global 30 dp status bar in AppShell |
| `src/components/SyncBadge.tsx` | Per-object sm/md badge component |
| `src/db/schema.ts` | `sync_queue` table definition |
| `src/i18n/locales/en.json` | `syncBar.*` and `syncBadge.*` keys |
| `src/i18n/locales/de.json` | German translations for same keys |
| `docs/migrations/` | Cloud schema and RLS policies ready to apply |

---

## Known Gaps

- Supabase write path is skeleton (lines 235–248 of sync-transport.ts)
- Migrations not yet applied to production Supabase project
- Auth token not yet passed in transport headers
- CRDT / manual conflict resolution not implemented (last-write-wins only)
- `useSyncStatuses` polls independently of `useSyncStatus`; no shared subscription layer yet
