/**
 * aha! Register — SQLite schema v1.3
 *
 * 16 tables supporting universal heritage documentation.
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
  -- Review workflow
  review_status         TEXT NOT NULL DEFAULT 'complete', -- needs_review | in_review | complete
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
  sha256_hash   TEXT NOT NULL,
  caption       TEXT,
  privacy_tier  TEXT NOT NULL DEFAULT 'public',
  is_primary    INTEGER NOT NULL DEFAULT 0, -- 1 = primary display image
  sort_order    INTEGER NOT NULL DEFAULT 0,
  -- Derivative tracking (B1 object isolation)
  parent_media_id TEXT REFERENCES media(id),
  media_type      TEXT NOT NULL DEFAULT 'original', -- original | derivative_isolated | document_scan | document_deskewed
  -- OCR (C1 document scanning)
  ocr_text        TEXT,
  ocr_confidence  REAL,
  ocr_source      TEXT NOT NULL DEFAULT 'none', -- none | on_device | cloud
  -- View inventory (D1)
  view_type       TEXT, -- front | back | top | bottom | left_side | right_side | detail | detail_signature | detail_damage | detail_label | overall | interior | document_scan | NULL=uncategorized
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

-- 9. object_collections (many-to-many join: objects <-> collections)
CREATE TABLE IF NOT EXISTS object_collections (
  id              TEXT PRIMARY KEY,
  object_id       TEXT NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
  collection_id   TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  added_at        TEXT NOT NULL,
  added_by        TEXT REFERENCES users(id) ON DELETE SET NULL,
  notes           TEXT,
  display_order   INTEGER DEFAULT 0,
  UNIQUE(object_id, collection_id)
);

-- 10. locations
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

-- 11. documents
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

-- 12. app_settings
CREATE TABLE IF NOT EXISTS app_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

-- 13. audit_trail
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

-- 14. sync_queue
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

-- 15. persons (artists, conservators, donors, etc.)
CREATE TABLE IF NOT EXISTS persons (
  id              TEXT PRIMARY KEY NOT NULL,
  institution_id  TEXT REFERENCES institutions(id),
  name            TEXT NOT NULL,
  sort_name       TEXT,
  birth_year      INTEGER,
  death_year      INTEGER,
  nationality     TEXT,
  ulan_uri        TEXT,
  gnd_uri         TEXT,
  biography       TEXT,
  person_type     TEXT NOT NULL DEFAULT 'individual' CHECK(person_type IN ('individual', 'collective', 'unknown')),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  sync_status     TEXT NOT NULL DEFAULT 'pending' CHECK(sync_status IN ('pending', 'synced', 'error', 'conflict'))
);
CREATE INDEX IF NOT EXISTS idx_persons_institution ON persons(institution_id);
CREATE INDEX IF NOT EXISTS idx_persons_name ON persons(name);
CREATE INDEX IF NOT EXISTS idx_persons_sort_name ON persons(sort_name);
CREATE INDEX IF NOT EXISTS idx_persons_sync ON persons(sync_status);

-- 16. object_persons (junction: objects <-> persons with roles)
CREATE TABLE IF NOT EXISTS object_persons (
  id            TEXT PRIMARY KEY NOT NULL,
  object_id     TEXT NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
  person_id     TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  role          TEXT NOT NULL DEFAULT 'artist' CHECK(role IN ('artist', 'collaborator', 'fabricator', 'programmer', 'curator', 'donor', 'restorer', 'photographer', 'publisher', 'commissioner', 'unknown')),
  display_order INTEGER NOT NULL DEFAULT 0,
  notes         TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_object_persons_object ON object_persons(object_id);
CREATE INDEX IF NOT EXISTS idx_object_persons_person ON object_persons(person_id);
CREATE INDEX IF NOT EXISTS idx_object_persons_role ON object_persons(role);

-- 17. capture_protocols
CREATE TABLE IF NOT EXISTS capture_protocols (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  name_de           TEXT,
  description       TEXT,
  description_de    TEXT,
  version           TEXT NOT NULL DEFAULT '1.0',
  domain            TEXT NOT NULL,
  object_types      TEXT NOT NULL DEFAULT '[]', -- JSON array
  shots             TEXT NOT NULL DEFAULT '[]', -- JSON array
  completion_rules  TEXT NOT NULL DEFAULT '{}', -- JSON
  is_active         INTEGER NOT NULL DEFAULT 1,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_capture_protocols_domain ON capture_protocols(domain);
CREATE INDEX IF NOT EXISTS idx_capture_protocols_active ON capture_protocols(is_active);
`;

/**
 * Additive ALTER TABLE migrations.
 *
 * Each statement is run individually with try/catch because SQLite
 * throws "duplicate column name" on re-launch when the column
 * already exists. There is no ALTER TABLE ADD COLUMN IF NOT EXISTS.
 */
const MIGRATION_STATEMENTS = [
  // objects: review workflow status for quick capture (B2)
  `ALTER TABLE objects ADD COLUMN review_status TEXT NOT NULL DEFAULT 'complete'`,
  // media: copyright / licensing fields
  `ALTER TABLE media ADD COLUMN rights_holder TEXT`,
  `ALTER TABLE media ADD COLUMN license_type TEXT CHECK(license_type IN ('CC-BY', 'CC-BY-NC', 'CC-BY-SA', 'CC0', 'all-rights-reserved', 'institution-specific', 'TK-label'))`,
  `ALTER TABLE media ADD COLUMN license_uri TEXT`,
  `ALTER TABLE media ADD COLUMN usage_restrictions TEXT`,
  // media: derivative tracking for object isolation (B1)
  `ALTER TABLE media ADD COLUMN parent_media_id TEXT REFERENCES media(id)`,
  `ALTER TABLE media ADD COLUMN media_type TEXT NOT NULL DEFAULT 'original'`,
  // documents: transcription fields
  `ALTER TABLE documents ADD COLUMN transcription TEXT`,
  `ALTER TABLE documents ADD COLUMN transcription_status TEXT NOT NULL DEFAULT 'none' CHECK(transcription_status IN ('none', 'draft', 'ai_generated', 'verified'))`,
  // media: OCR columns for document scanning (C1)
  `ALTER TABLE media ADD COLUMN ocr_text TEXT`,
  `ALTER TABLE media ADD COLUMN ocr_confidence REAL`,
  `ALTER TABLE media ADD COLUMN ocr_source TEXT NOT NULL DEFAULT 'none'`,
  // media: view inventory for guided capture (D1)
  `ALTER TABLE media ADD COLUMN view_type TEXT`,
  // media: per-view dimensions and notes for Registerbogen multi-view capture
  `ALTER TABLE media ADD COLUMN view_dimensions TEXT`,
  `ALTER TABLE media ADD COLUMN view_notes TEXT`,
  // media: Supabase Storage path for cloud-synced photos
  `ALTER TABLE media ADD COLUMN storage_path TEXT`,
  // media: capture protocol shot tracking
  `ALTER TABLE media ADD COLUMN shot_type TEXT`,
  `ALTER TABLE media ADD COLUMN protocol_id TEXT`,
  `ALTER TABLE media ADD COLUMN shot_order INTEGER`,
  // objects: capture protocol tracking
  `ALTER TABLE objects ADD COLUMN protocol_id TEXT`,
  `ALTER TABLE objects ADD COLUMN protocol_complete INTEGER DEFAULT 0`,
  `ALTER TABLE objects ADD COLUMN shots_completed TEXT DEFAULT '[]'`,
  `ALTER TABLE objects ADD COLUMN shots_remaining TEXT DEFAULT '[]'`,
  // objects: location tagging
  `ALTER TABLE objects ADD COLUMN location_building TEXT`,
  `ALTER TABLE objects ADD COLUMN location_floor TEXT`,
  `ALTER TABLE objects ADD COLUMN location_room TEXT`,
  `ALTER TABLE objects ADD COLUMN location_shelf TEXT`,
  `ALTER TABLE objects ADD COLUMN location_notes TEXT`,
  // objects: Registerbogen fields (companion app parity)
  `ALTER TABLE objects ADD COLUMN "mediaId" TEXT`,
  `ALTER TABLE objects ADD COLUMN alte_inventarnummer TEXT`,
  `ALTER TABLE objects ADD COLUMN klassifikation TEXT`,
  `ALTER TABLE objects ADD COLUMN material TEXT`,
  `ALTER TABLE objects ADD COLUMN technik TEXT`,
  `ALTER TABLE objects ADD COLUMN masse_hoehe TEXT`,
  `ALTER TABLE objects ADD COLUMN masse_breite TEXT`,
  `ALTER TABLE objects ADD COLUMN masse_tiefe TEXT`,
  `ALTER TABLE objects ADD COLUMN masse_einheit TEXT`,
  `ALTER TABLE objects ADD COLUMN gewicht TEXT`,
  `ALTER TABLE objects ADD COLUMN gewicht_einheit TEXT`,
  `ALTER TABLE objects ADD COLUMN inschriften TEXT`,
  `ALTER TABLE objects ADD COLUMN markierungen TEXT`,
  `ALTER TABLE objects ADD COLUMN schlagworte TEXT`,
  `ALTER TABLE objects ADD COLUMN erhaltungszustand TEXT`,
  `ALTER TABLE objects ADD COLUMN zustandsbeschreibung TEXT`,
  `ALTER TABLE objects ADD COLUMN letzter_zustandsbericht TEXT`,
  `ALTER TABLE objects ADD COLUMN restaurierungsbedarf TEXT`,
  `ALTER TABLE objects ADD COLUMN erwerbungsart TEXT`,
  `ALTER TABLE objects ADD COLUMN erwerbungsdatum TEXT`,
  `ALTER TABLE objects ADD COLUMN veraeusserer TEXT`,
  `ALTER TABLE objects ADD COLUMN provenienzangaben TEXT`,
  `ALTER TABLE objects ADD COLUMN belastete_provenienz INTEGER DEFAULT 0`,
  `ALTER TABLE objects ADD COLUMN belastete_provenienz_notizen TEXT`,
  `ALTER TABLE objects ADD COLUMN erwerbungspreis TEXT`,
  `ALTER TABLE objects ADD COLUMN erwerbungspreis_waehrung TEXT`,
  `ALTER TABLE objects ADD COLUMN standort_gebaeude TEXT`,
  `ALTER TABLE objects ADD COLUMN standort_etage TEXT`,
  `ALTER TABLE objects ADD COLUMN standort_raum TEXT`,
  `ALTER TABLE objects ADD COLUMN standort_regal TEXT`,
  `ALTER TABLE objects ADD COLUMN standort_hinweise TEXT`,
  `ALTER TABLE objects ADD COLUMN aktueller_status TEXT`,
  `ALTER TABLE objects ADD COLUMN versicherungswert TEXT`,
  `ALTER TABLE objects ADD COLUMN versicherungswert_waehrung TEXT`,
  `ALTER TABLE objects ADD COLUMN versicherungspolice TEXT`,
  `ALTER TABLE objects ADD COLUMN leihgabe INTEGER DEFAULT 0`,
  `ALTER TABLE objects ADD COLUMN leihgabe_nehmer TEXT`,
  `ALTER TABLE objects ADD COLUMN leihgabe_von TEXT`,
  `ALTER TABLE objects ADD COLUMN leihgabe_bis TEXT`,
  `ALTER TABLE objects ADD COLUMN ausfuhrgenehmigung INTEGER DEFAULT 0`,
  `ALTER TABLE objects ADD COLUMN ausfuhrgenehmigung_referenz TEXT`,
  `ALTER TABLE objects ADD COLUMN datensatz_sprache TEXT`,
  `ALTER TABLE objects ADD COLUMN verwahrende_einrichtung TEXT`,
  `ALTER TABLE objects ADD COLUMN nutzungsrechte_metadaten TEXT`,
  // media: alt_text (companion app parity)
  `ALTER TABLE media ADD COLUMN alt_text TEXT`,
  // object_collections: updated_at (companion app parity)
  `ALTER TABLE object_collections ADD COLUMN updated_at TEXT`,
];

/**
 * Tables created via runMigrations (not in SCHEMA_SQL).
 * Uses CREATE TABLE IF NOT EXISTS so safe on re-launch.
 */
const MIGRATION_TABLES = [
  `CREATE TABLE IF NOT EXISTS object_tasks (
    id          TEXT PRIMARY KEY,
    object_id   TEXT NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    completed   INTEGER DEFAULT 0,
    sort_order  INTEGER DEFAULT 0,
    created_at  TEXT DEFAULT (datetime('now')),
    completed_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS floor_maps (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    building      TEXT,
    floor         TEXT,
    image_uri     TEXT NOT NULL,
    image_width   INTEGER,
    image_height  INTEGER,
    created_at    TEXT DEFAULT (datetime('now')),
    updated_at    TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS map_pins (
    id            TEXT PRIMARY KEY,
    floor_map_id  TEXT NOT NULL REFERENCES floor_maps(id) ON DELETE CASCADE,
    object_id     TEXT REFERENCES objects(id) ON DELETE SET NULL,
    x_percent     REAL NOT NULL,
    y_percent     REAL NOT NULL,
    label         TEXT,
    created_at    TEXT DEFAULT (datetime('now'))
  )`,
];

/**
 * Run all additive migrations. Safe to call on every launch —
 * already-existing columns are silently skipped.
 */
export async function runMigrations(
  db: { execAsync: (sql: string) => Promise<void> },
): Promise<void> {
  for (const sql of MIGRATION_STATEMENTS) {
    try {
      await db.execAsync(sql);
    } catch {
      // Column already exists — expected on re-launch, safe to ignore
    }
  }
  // Create new tables (IF NOT EXISTS is safe)
  for (const sql of MIGRATION_TABLES) {
    try {
      await db.execAsync(sql);
    } catch {
      // Table already exists — safe to ignore
    }
  }
}
