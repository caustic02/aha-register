# Changelog

All notable changes to aha! Register are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/).
This project uses [Semantic Versioning](https://semver.org/).

## [0.2.0] - 2026-03-15

### Added
- State of the Art documentation system (9 living docs)
- ESLint + Prettier with React Native rules
- Dependabot for weekly dependency monitoring
- CODEOWNERS protecting sacred files
- GitHub Actions CI (tsc, ESLint, Expo export, i18n parity)
- Scannable QR codes in PDF export (qrcode library)
- 66 new i18n keys for PDF export labels (EN + DE)
- Land Cruiser compliance audit (5/5 PASS)

### Fixed
- PDF export labels now respect app language setting (were hardcoded German)
- PDF template colors imported from theme (were hardcoded hex, drift risk)
- Audit trail userId now reads from auth session with 'local' fallback
- CAPTURE.md: removed stale known gap (object type selector was already built)
- SYNC.md: upgraded from STUB to PARTIAL status

### Security
- Husky pre-commit: tsc + secrets scan on every commit
- CC hooks: tsc after every .ts/.tsx edit

## [0.1.0] - 2026-03-09

### Added
- SQLite schema: 14 tables, 19 indexes (v1.2)
- TypeScript interfaces for all tables + 7 JSONB object type templates
- i18n: 398 keys, EN/DE parity
- SHA-256 capture hashing (raw bytes, not base64)
- Sync engine skeleton with sync_queue table
- 4-tab navigation: Objects, Capture, Collections, Settings
- Capture flow: camera, photo library, metadata extraction
- Object detail with type-specific forms (all 7 object types)
- Multi-image gallery with add, set primary, delete
- Collections: create, list, detail, add/remove objects
- Settings: institution config, language selector, storage stats
- PDF export with provenance chain and share sheet
- Search, type filter, delete on objects list
- Supabase auth with SECURITY DEFINER RPC for institution bootstrap

### Fixed
- Title nearly invisible (cream on cream) on auth screen
- Android keyboard covers Confirm Password field
- Raw RLS error shown to users (now friendly error mapping)
- RLS bootstrapping deadlock (SECURITY DEFINER function)
