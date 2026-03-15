# State of the Art: Authentication

> Last updated: 2026-03-15
> Status: STUB

## What This Is
Supabase Auth for user signup/signin. "Start Documenting" (Explore the App) is primary button — app is fully usable without an account. Sign-in/sign-up are below a divider. SECURITY DEFINER RPC function handles institution creation to bypass RLS bootstrapping deadlock.

## Architecture (Known)
- `expo-router` auth flow with `src/screens/AuthScreen.tsx`
- Supabase `signInWithPassword` / `signUp`
- "Continue without account" path — app works fully offline without auth
- Institution record created via `SECURITY DEFINER` Postgres function on first sign-up (bypasses RLS chicken-and-egg: user needs an institution row to satisfy RLS, but can't insert without being authenticated to an institution)

## Decision History

| Date | Decision | Reference |
|------|----------|-----------|
| 2026-03-09 | SECURITY DEFINER RPC for institution bootstrap | Migration 20260309_create_institution_rpc.sql |
| 2026-03-09 | Friendly error mapping for RLS errors | Device test bug fix |
| 2026-03-09 | "Explore the App" as primary CTA, auth below divider | Auth UX commit |

## Known Gaps

- Full auth flow not documented here
- Password reset flow not verified
- Session refresh/token handling not documented
- `userId` in local audit trail hardcoded to `'local'` — not linked to Supabase auth UID
- No biometric/Face ID option
- No SSO / institutional login
