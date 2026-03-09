-- ============================================================================
-- aha! Register — Postgres cloud schema v1
-- Migration: 20260309100000_cloud_schema_v1.sql
--
-- Translated from SQLite schema v1.2 (14 tables).
-- Skipped local-only tables: app_settings, sync_queue.
-- Added cloud-only tables: institution_members.
-- Added institution_id / user_id columns for multi-tenancy & auth.
-- RLS enabled on every table; policies created separately.
-- ============================================================================

-- 1. institutions
CREATE TABLE institutions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text NOT NULL,
  institution_type  text,
  address           text,
  contact_info      jsonb,
  settings          jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;

-- 2. institution_members (cloud-only)
CREATE TABLE institution_members (
  institution_id  uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role            text NOT NULL DEFAULT 'member',
  joined_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (institution_id, user_id)
);
ALTER TABLE institution_members ENABLE ROW LEVEL SECURITY;

-- 3. sites
CREATE TABLE sites (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  name            text NOT NULL,
  site_type       text,
  description     text,
  latitude        numeric,
  longitude       numeric,
  altitude        numeric,
  address         text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;

-- 4. users (application-level profile, linked to auth.users)
CREATE TABLE users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id    uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email           text,
  display_name    text NOT NULL,
  role            text NOT NULL,
  institution_id  uuid REFERENCES institutions(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 5. objects
CREATE TABLE objects (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id        uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  user_id               uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  site_id               uuid REFERENCES sites(id) ON DELETE SET NULL,
  object_type           text NOT NULL,
  status                text NOT NULL DEFAULT 'draft',
  title                 text NOT NULL,
  description           text,
  inventory_number      text,
  -- Geospatial
  latitude              numeric,
  longitude             numeric,
  altitude              numeric,
  coordinate_accuracy   numeric,
  coordinate_source     text,
  -- Evidence
  evidence_class        text,
  legal_hold            boolean NOT NULL DEFAULT false,
  privacy_tier          text NOT NULL DEFAULT 'public',
  -- Temporal
  event_start           text,
  event_end             text,
  -- Type-specific
  type_specific_data    jsonb,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE objects ENABLE ROW LEVEL SECURITY;

-- 6. media
CREATE TABLE media (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  object_id     uuid REFERENCES objects(id) ON DELETE CASCADE,
  file_path     text NOT NULL,
  file_name     text NOT NULL,
  file_type     text NOT NULL DEFAULT 'image',
  mime_type     text NOT NULL,
  file_size     bigint,
  sha256_hash   text,
  caption       text,
  privacy_tier  text NOT NULL DEFAULT 'public',
  is_primary    boolean NOT NULL DEFAULT false,
  sort_order    integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE media ENABLE ROW LEVEL SECURITY;

-- 7. annotations
CREATE TABLE annotations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  object_id       uuid REFERENCES objects(id) ON DELETE CASCADE,
  user_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  annotation_type text NOT NULL,
  content         text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE annotations ENABLE ROW LEVEL SECURITY;

-- 8. vocabulary_terms
CREATE TABLE vocabulary_terms (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  authority   text NOT NULL,
  term_id     text NOT NULL,
  label       text NOT NULL,
  description text,
  parent_id   uuid REFERENCES vocabulary_terms(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE vocabulary_terms ENABLE ROW LEVEL SECURITY;

-- 9. collections
CREATE TABLE collections (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  user_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name            text NOT NULL,
  collection_type text NOT NULL,
  description     text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;

-- 10. object_collections (many-to-many join)
CREATE TABLE object_collections (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  object_id       uuid NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
  collection_id   uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  added_at        timestamptz NOT NULL DEFAULT now(),
  added_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes           text,
  display_order   integer DEFAULT 0,
  UNIQUE(object_id, collection_id)
);
ALTER TABLE object_collections ENABLE ROW LEVEL SECURITY;

-- 11. locations
CREATE TABLE locations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  site_id       uuid REFERENCES sites(id) ON DELETE SET NULL,
  name          text NOT NULL,
  location_type text,
  parent_id     uuid REFERENCES locations(id) ON DELETE SET NULL,
  description   text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

-- 12. documents
CREATE TABLE documents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  object_id     uuid REFERENCES objects(id) ON DELETE CASCADE,
  title         text NOT NULL,
  file_path     text,
  mime_type     text,
  file_size     bigint,
  sha256_hash   text,
  document_type text,
  description   text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- 13. audit_trail
CREATE TABLE audit_trail (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id   uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  user_id          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  table_name       text NOT NULL,
  record_id        text NOT NULL,
  action           text NOT NULL,
  old_values       jsonb,
  new_values       jsonb,
  device_info      jsonb,
  evidence_context jsonb,
  created_at       timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE audit_trail ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- INDEXES
-- ============================================================================

-- institutions
CREATE INDEX idx_institutions_name ON institutions(name);

-- institution_members
CREATE INDEX idx_institution_members_user_id ON institution_members(user_id);

-- sites
CREATE INDEX idx_sites_institution_id ON sites(institution_id);

-- users
CREATE INDEX idx_users_auth_user_id ON users(auth_user_id);
CREATE INDEX idx_users_institution_id ON users(institution_id);

-- objects
CREATE INDEX idx_objects_institution_id   ON objects(institution_id);
CREATE INDEX idx_objects_user_id          ON objects(user_id);
CREATE INDEX idx_objects_site_id          ON objects(site_id);
CREATE INDEX idx_objects_object_type      ON objects(object_type);
CREATE INDEX idx_objects_coords           ON objects(latitude, longitude);
CREATE INDEX idx_objects_privacy_tier     ON objects(privacy_tier);
CREATE INDEX idx_objects_legal_hold       ON objects(legal_hold);
CREATE INDEX idx_objects_status           ON objects(status);

-- media
CREATE INDEX idx_media_object_id          ON media(object_id);
CREATE INDEX idx_media_institution_id     ON media(institution_id);
CREATE INDEX idx_media_sha256_hash        ON media(sha256_hash);

-- annotations
CREATE INDEX idx_annotations_object_id    ON annotations(object_id);
CREATE INDEX idx_annotations_institution_id ON annotations(institution_id);

-- vocabulary_terms
CREATE INDEX idx_vocab_authority_term     ON vocabulary_terms(authority, term_id);

-- collections
CREATE INDEX idx_collections_institution_id ON collections(institution_id);

-- object_collections
CREATE INDEX idx_object_collections_object     ON object_collections(object_id);
CREATE INDEX idx_object_collections_collection ON object_collections(collection_id);
CREATE INDEX idx_object_collections_institution ON object_collections(institution_id);

-- locations
CREATE INDEX idx_locations_site_id        ON locations(site_id);
CREATE INDEX idx_locations_institution_id  ON locations(institution_id);

-- documents
CREATE INDEX idx_documents_object_id      ON documents(object_id);
CREATE INDEX idx_documents_institution_id  ON documents(institution_id);

-- audit_trail
CREATE INDEX idx_audit_trail_record_id    ON audit_trail(record_id);
CREATE INDEX idx_audit_trail_user_id      ON audit_trail(user_id);
CREATE INDEX idx_audit_trail_institution_id ON audit_trail(institution_id);
CREATE INDEX idx_audit_trail_created_at   ON audit_trail(created_at);


-- ============================================================================
-- updated_at trigger (auto-set updated_at on UPDATE)
-- ============================================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to every table with updated_at
CREATE TRIGGER trg_institutions_updated_at BEFORE UPDATE ON institutions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_sites_updated_at BEFORE UPDATE ON sites FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_objects_updated_at BEFORE UPDATE ON objects FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_media_updated_at BEFORE UPDATE ON media FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_annotations_updated_at BEFORE UPDATE ON annotations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_vocabulary_terms_updated_at BEFORE UPDATE ON vocabulary_terms FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_collections_updated_at BEFORE UPDATE ON collections FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_locations_updated_at BEFORE UPDATE ON locations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_documents_updated_at BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION set_updated_at();
