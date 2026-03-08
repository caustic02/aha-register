/**
 * aha! Register — SQLite schema v1.1
 *
 * 12 tables supporting universal heritage documentation.
 * All primary keys are TEXT (UUID v4, generated client-side).
 * JSONB columns stored as TEXT in SQLite.
 */
export const SCHEMA_SQL = `
-- 1. institutions
CREATE TABLE IF NOT EXISTS institutions (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  institution_type  TEXT,
  address           TEXT,
  contact_info      TEXT, -- JSON
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);

-- 2. sites
CREATE TABLE IF NOT EXISTS sites (
  id              TEXT PRIMARY KEY,
  institution_id  TEXT REFERENCES institutions(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  site_type       TEXT,
  description     TEXT,
  latitude        REAL,
  longitude       REAL,
  altitude        REAL,
  address         TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

-- 3. users (defined before tables that reference it)
CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY,
  email           TEXT,
  display_name    TEXT NOT NULL,
  role            TEXT NOT NULL,
  institution_id  TEXT REFERENCES institutions(id) ON DELETE SET NULL,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

-- 4. objects
CREATE TABLE IF NOT EXISTS objects (
  id                    TEXT PRIMARY KEY,
  institution_id        TEXT REFERENCES institutions(id) ON DELETE SET NULL,
  site_id               TEXT REFERENCES sites(id) ON DELETE SET NULL,
  object_type           TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'draft', -- draft | active | archived | under_review
  title                 TEXT NOT NULL,
  description           TEXT,
  inventory_number      TEXT,
  -- Geospatial
  latitude              REAL,
  longitude             REAL,
  altitude              REAL,
  coordinate_accuracy   REAL,
  coordinate_source     TEXT,
  -- Evidence
  evidence_class        TEXT,
  legal_hold            INTEGER NOT NULL DEFAULT 0,
  privacy_tier          TEXT NOT NULL DEFAULT 'public',
  -- Temporal
  event_start           TEXT,
  event_end             TEXT,
  -- Type-specific
  type_specific_data    TEXT, -- JSONB
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL
);

-- 5. media
CREATE TABLE IF NOT EXISTS media (
  id            TEXT PRIMARY KEY,
  object_id     TEXT REFERENCES objects(id) ON DELETE CASCADE,
  file_path     TEXT NOT NULL,
  file_name     TEXT NOT NULL,
  file_type     TEXT NOT NULL DEFAULT 'image', -- image | video | audio | document | 3d_scan
  mime_type     TEXT NOT NULL,
  file_size     INTEGER,
  sha256_hash   TEXT,
  caption       TEXT,
  privacy_tier  TEXT NOT NULL DEFAULT 'public',
  is_primary    INTEGER NOT NULL DEFAULT 0, -- 1 = primary display image
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

-- 6. annotations
CREATE TABLE IF NOT EXISTS annotations (
  id              TEXT PRIMARY KEY,
  object_id       TEXT REFERENCES objects(id) ON DELETE CASCADE,
  user_id         TEXT REFERENCES users(id) ON DELETE SET NULL,
  annotation_type TEXT NOT NULL,
  content         TEXT NOT NULL,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

-- 7. vocabulary_terms
CREATE TABLE IF NOT EXISTS vocabulary_terms (
  id          TEXT PRIMARY KEY,
  authority   TEXT NOT NULL,
  term_id     TEXT NOT NULL,
  label       TEXT NOT NULL,
  description TEXT,
  parent_id   TEXT REFERENCES vocabulary_terms(id) ON DELETE SET NULL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

-- 8. collections
CREATE TABLE IF NOT EXISTS collections (
  id              TEXT PRIMARY KEY,
  institution_id  TEXT REFERENCES institutions(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  collection_type TEXT NOT NULL,
  description     TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

-- 9. locations
CREATE TABLE IF NOT EXISTS locations (
  id            TEXT PRIMARY KEY,
  site_id       TEXT REFERENCES sites(id) ON DELETE SET NULL,
  name          TEXT NOT NULL,
  location_type TEXT,
  parent_id     TEXT REFERENCES locations(id) ON DELETE SET NULL,
  description   TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

-- 10. documents
CREATE TABLE IF NOT EXISTS documents (
  id            TEXT PRIMARY KEY,
  object_id     TEXT REFERENCES objects(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  file_path     TEXT,
  mime_type     TEXT,
  file_size     INTEGER,
  sha256_hash   TEXT,
  document_type TEXT,
  description   TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

-- 11. audit_trail
CREATE TABLE IF NOT EXISTS audit_trail (
  id               TEXT PRIMARY KEY,
  table_name       TEXT NOT NULL,
  record_id        TEXT NOT NULL,
  action           TEXT NOT NULL,
  user_id          TEXT REFERENCES users(id) ON DELETE SET NULL,
  old_values       TEXT, -- JSON
  new_values       TEXT, -- JSON
  device_info      TEXT, -- JSONB
  evidence_context TEXT, -- JSONB
  created_at       TEXT NOT NULL
);

-- 12. sync_queue
CREATE TABLE IF NOT EXISTS sync_queue (
  id          TEXT PRIMARY KEY,
  table_name  TEXT NOT NULL,
  record_id   TEXT NOT NULL,
  action      TEXT NOT NULL,
  payload     TEXT, -- JSON
  status      TEXT NOT NULL DEFAULT 'pending',
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
`;
