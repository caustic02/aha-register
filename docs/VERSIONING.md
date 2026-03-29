# aha! Register Versioning

## Rules
- version and runtimeVersion in app.json MUST always match
- Increment on every meaningful build session (not every commit)
- Use semver: MAJOR.MINOR.PATCH
  - MAJOR: breaking schema change or architecture shift
  - MINOR: new feature or screen (e.g., pull-sync, QuickID, Registerbogen)
  - PATCH: bug fixes, polish, i18n additions

## History
| Version | Date       | Summary                                              |
|---------|------------|------------------------------------------------------|
| 0.1.0   | 2026-03    | Initial capture + SQLite + auth                      |
| 0.2.0   | 2026-03    | TestFlight Build 8, export pipeline, Getty AAT        |
| 0.3.0   | 2026-03-28 | QuickID screen, Sentry fixes, HomeScreen rebuild      |
| 0.4.0   | 2026-03-29 | Pull-sync (bidirectional), Met demo seed, cleartext config |
