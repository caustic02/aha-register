# State of the Art: Data Model

> Last updated: 2026-03-16
> Status: ACTIVE

## What This Is
The SQLite schema is Register's foundation. 16 tables, 19 indexes. The TypeScript interfaces in `db/types.ts` must always match. They are a contract with partners (Vera, Florian, institutions).

## Architecture

- SQLite with WAL mode, foreign keys ON
- 16 tables including `object_collections` and `object_persons` join tables
- 19 indexes
- 7 JSONB object type templates in `type_specific_data` column
- Schema version: v1.3
- All primary keys: `TEXT` (UUID v4, generated client-side via `src/utils/uuid.ts`)
- JSONB columns stored as `TEXT` in SQLite (serialized/deserialized in application layer)
- Foreign keys use `ON DELETE CASCADE` (for child records) or `ON DELETE SET NULL` (for soft references)

### TypeScript Contract
`db/types.ts` exports:
- 16 row interfaces (one per table)
- Union types: `ObjectType`, `ObjectStatus`, `MediaFileType`, `PrivacyTier`, `EvidenceClass`, `SyncAction`, `SyncStatus`, `PersonType`, `PersonRole`, `LicenseType`, `TranscriptionStatus`
- 7 JSONB data interfaces: `MuseumObjectData`, `SiteData`, `IncidentData`, `SpecimenData`, `ArchitecturalElementData`, `EnvironmentalSampleData`, `ConservationRecordData`
- `TypeSpecificData` union of the 7 JSONB interfaces

**SACRED rule**: any column added to `schema.ts` requires a matching field in `types.ts`. No exceptions.

## Key Tables

| # | Table | Description |
|---|-------|-------------|
| 1 | `institutions` | Organisation/museum record. Referenced by objects, sites, users, collections. |
| 2 | `sites` | Geographic or archaeological site. Has lat/lng/altitude and address. Referenced by objects and locations. |
| 3 | `users` | User accounts with role and institution link. Referenced by annotations, audit_trail, object_collections. |
| 4 | `objects` | Core record. Holds object_type, status (draft/active/archived/under_review), GPS fields, evidence_class, legal_hold, privacy_tier, and `type_specific_data` JSONB. |
| 5 | `media` | Photos/video/audio/documents. Each has SHA-256 hash, file_path to app storage, is_primary flag. Linked to one object via CASCADE. Four copyright fields added v1.3: `rights_holder`, `license_type` (LicenseType), `license_uri`, `usage_restrictions`. |
| 6 | `annotations` | Free-text notes linked to an object and optionally a user. |
| 7 | `vocabulary_terms` | Authority-backed controlled vocabulary (e.g. AAT, TGN). Self-referencing parent_id for hierarchy. |
| 8 | `collections` | Named collection with type (general/department/exhibition/project/research/conservation). |
| 9 | `object_collections` | M:M join table between objects and collections. Has UNIQUE(object_id, collection_id), display_order, added_by. |
| 10 | `locations` | Physical location within a site. Self-referencing parent_id for nested hierarchy (room → shelf → drawer). |
| 11 | `documents` | Document files linked to an object (distinct from media — for PDFs, spreadsheets, etc.). Has SHA-256 hash. Two transcription fields added v1.3: `transcription` (TEXT), `transcription_status` (TranscriptionStatus: none/draft/ai_generated/verified). |
| 12 | `app_settings` | Key/value store for device-local settings (no id, `key` is PK). |
| 13 | `audit_trail` | Immutable change log. Stores old/new values as JSON, device_info and evidence_context as JSONB. No updated_at (append-only). |
| 14 | `sync_queue` | Offline sync queue. Tracks table_name, record_id, action (insert/update/delete), payload, status (pending/syncing/failed), retry_count. |
| 15 | `persons` | Authority-linked person/collective record. Columns: id, institution_id, name, sort_name, birth_year, death_year, nationality, ulan_uri (ULAN authority link), gnd_uri (GND authority link), biography, person_type (individual/collective/unknown), sync_status, created_at, updated_at. |
| 16 | `object_persons` | M:M join table linking objects to persons with a typed role. Columns: id, object_id (CASCADE), person_id (CASCADE), role (PersonRole union), display_order, notes, created_at. UNIQUE(object_id, person_id, role). |

## Indexes (19 total)

| Table | Indexed Columns |
|-------|----------------|
| `objects` | institution_id, site_id, object_type, (latitude, longitude), privacy_tier, legal_hold |
| `media` | object_id, sha256_hash |
| `annotations` | object_id |
| `collections` | institution_id |
| `object_collections` | object_id, collection_id |
| `locations` | site_id |
| `documents` | object_id |
| `audit_trail` | record_id, user_id, created_at |
| `sync_queue` | status |
| `vocabulary_terms` | (authority, term_id) |

## Key Files

| File | Purpose |
|------|---------|
| `src/db/schema.ts` | SQLite CREATE TABLE statements (SACRED — match types.ts) |
| `src/db/types.ts` | TypeScript row interfaces and union types (SACRED — match schema.ts) |
| `src/db/indexes.ts` | CREATE INDEX statements (19 indexes) |
| `src/db/database.ts` | Database initialisation, WAL mode, foreign keys |
| `src/db/audit.ts` | `logAuditEntry` / `getAuditHistory` helpers |
| `docs/aha-register-data-model-v1.1.docx` | Partner-facing data model |

## Decision History

| Date | Decision | Reference |
|------|----------|-----------|
| 2026-03-08 | 7 object types with JSONB `type_specific_data` field | Schema v1.2 |
| 2026-03-09 | `object_collections` join table added (13 → 14 tables) | Collections feature |
| 2026-03-08 | All PKs are client-side UUID v4 TEXT (not AUTOINCREMENT) | Schema v1.1 design |
| 2026-03-08 | JSONB stored as TEXT in SQLite | SQLite portability decision |
| 2026-03-17 | `persons` + `object_persons` tables added (14 → 16 tables) | Persons feature, schema v1.3 |
| 2026-03-17 | 4 copyright fields added to `media` (rights_holder, license_type, license_uri, usage_restrictions) | Schema v1.3 |
| 2026-03-17 | 2 transcription fields added to `documents` (transcription, transcription_status) | Schema v1.3 |

## Known Gaps

- No schema versioning/migration system for existing local databases (ALTER TABLE not handled)
- No data export format (CSV, JSON) beyond PDF
- `users` table not yet populated from Supabase auth — `userId` in audit trail is hardcoded `'local'`
- `vocabulary_terms` table exists but no seed data or UI for authority-backed lookup
- `locations` table exists but no UI for location assignment to objects
