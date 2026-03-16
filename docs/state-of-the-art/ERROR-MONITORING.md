# Error Monitoring

> Last updated: 2026-03-15
> Status: Active

## What This Is

Sentry crash reporting for aha! Register. Captures unhandled React render errors
via an `ErrorBoundary` in `App.tsx` and exposes helper functions for instrumenting
async error paths throughout the app. Sentry is disabled locally when
`EXPO_PUBLIC_SENTRY_DSN` is unset (empty DSN = no-op).

## Architecture

```
App.tsx
  └─ Sentry.init()           ← module-scope, runs before any component mounts
  └─ AppErrorBoundary        ← class component; catches React render crashes
       └─ CrashFallback      ← user-facing fallback with localised strings
  └─ Sentry.wrap(App)        ← adds Sentry's own native crash handler
```

```
src/utils/sentry.ts          ← thin wrappers; rest of app imports only from here
  captureError(err, ctx?)    ← capture Error with optional extra context
  setUserContext(id, instId) ← attach user / institution to Sentry events
  clearUserContext()         ← call on sign-out
```

## Key Files

| File | Role |
|------|------|
| `App.tsx` | Sentry.init, AppErrorBoundary, CrashFallback, Sentry.wrap |
| `src/utils/sentry.ts` | captureError / setUserContext / clearUserContext helpers |
| `src/i18n/locales/en.json` | `errors.crash_*` strings |
| `src/i18n/locales/de.json` | `errors.crash_*` strings (DE) |
| `app.json` | `@sentry/react-native/expo` config plugin |

## Decision History

- **2026-03-15** — Initial integration. DSN sourced from `EXPO_PUBLIC_SENTRY_DSN`
  so the app runs without errors when the variable is absent (local dev, CI).
- **2026-03-15** — `tracesSampleRate: 0.2` (20 %) to limit performance-trace
  volume on free-tier Sentry.
- **2026-03-15** — Catch blocks in the codebase use `console.warn` (not
  `console.error`); per scope, only the render-level ErrorBoundary was wired at
  this stage. Async catch blocks can be wired incrementally via `captureError`.

## Known Gaps

- Async catch blocks (sync engine, export service, auth) are not yet wired to
  `captureError`; they log via `console.warn` or display an Alert.
- `setUserContext` / `clearUserContext` are not yet called from the auth flow;
  this means Sentry events have no user tag until wired in `AuthScreen` /
  `AppShell`.
- Source maps are not uploaded to Sentry (no `sentry-expo` upload step in CI
  yet); stack traces will show minified output.
