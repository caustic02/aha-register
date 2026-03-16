# Secure Storage

> Last updated: 2026-03-15
> Status: Active

## What This Is

Hardware-backed encrypted credential storage for aha! Register. Auth tokens
are stored in the iOS Keychain / Android Keystore via `expo-secure-store`
instead of plaintext `AsyncStorage`. This prevents credential theft from
a lost or stolen device.

## Architecture

```
┌────────────────────────────┐
│ Supabase GoTrueClient      │
│   auth.storage = ?         │
└─────────┬──────────────────┘
          │
  ┌───────▼──────────┐
  │ SecureStorage     │  ← src/utils/secure-storage.ts
  │  getItem()       │     wraps expo-secure-store
  │  setItem()       │     (iOS Keychain / Android Keystore)
  │  removeItem()    │
  └──────────────────┘

On first launch after migration:
  migrateAuthTokens() copies tokens from AsyncStorage → SecureStore
  then deletes originals and sets a flag so it never runs again.
```

### What uses which storage

| Data | Storage | Why |
|------|---------|-----|
| Supabase auth tokens | **SecureStore** | Sensitive credentials |
| `capture_intro_dismissed` | AsyncStorage | Non-sensitive UI preference |
| SQLite settings table | expo-sqlite | App configuration |

## Key Files

| File | Role |
|------|------|
| `src/utils/secure-storage.ts` | `SecureStorage` adapter + `migrateAuthTokens()` |
| `src/services/supabase.ts` | Supabase client wired to `SecureStorage` |
| `src/app/AppShell.tsx` | Calls `ensureMigrated()` before first auth read |

## Decision History

- **2026-03-15** — Migrated Supabase auth from `AsyncStorage` (plaintext) to
  `expo-secure-store` (hardware-encrypted). Required for institutional deployment
  where device-loss risk is non-trivial.
- **2026-03-15** — Kept `AsyncStorage` in the project because `CaptureScreen`
  uses it for the non-sensitive `capture_intro_dismissed` flag.
- **2026-03-15** — Migration reads the Supabase v2 storage key
  (`sb-<ref>-auth-token`) and the legacy GoTrueClient key
  (`supabase.auth.token`) to cover both existing and edge-case installs.

## Known Gaps

- The migration runs at every cold start until the flag is set. This adds ~5 ms
  to first launch for existing users (one time).
- `expo-secure-store` is unavailable on web; if a web target is added later, a
  platform-conditional storage adapter will be needed.
- AsyncStorage could be removed entirely if `capture_intro_dismissed` is moved
  to the SQLite settings table. Not done now to keep scope narrow.
