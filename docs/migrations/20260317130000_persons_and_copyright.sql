-- Migration: 20260317130000_persons_and_copyright
-- Description: Add persons/object_persons tables; media copyright and document transcription fields
-- Date: 2026-03-17
-- Schema version: v1.2 → v1.3
--
-- This file is for documentation/reference only.
-- The actual migration runs via src/db/schema.ts (CREATE TABLE)
-- and src/db/schema.ts runMigrations() (ALTER TABLE).

-- ============================================================================
-- 1. NEW TABLE: persons
-- ============================================================================
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

-- ============================================================================
-- 2. NEW TABLE: object_persons (junction: objects <-> persons with roles)
-- ============================================================================
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

-- ============================================================================
-- 3. ADD COLUMNS to media (copyright / licensing)
-- ============================================================================
-- NOTE: SQLite has no ADD COLUMN IF NOT EXISTS. In the app, each statement
-- is wrapped in try/catch to handle "duplicate column name" on re-launch.
ALTER TABLE media ADD COLUMN rights_holder TEXT;
ALTER TABLE media ADD COLUMN license_type TEXT CHECK(license_type IN ('CC-BY', 'CC-BY-NC', 'CC-BY-SA', 'CC0', 'all-rights-reserved', 'institution-specific', 'TK-label'));
ALTER TABLE media ADD COLUMN license_uri TEXT;
ALTER TABLE media ADD COLUMN usage_restrictions TEXT;

-- ============================================================================
-- 4. ADD COLUMNS to documents (transcription)
-- ============================================================================
ALTER TABLE documents ADD COLUMN transcription TEXT;
ALTER TABLE documents ADD COLUMN transcription_status TEXT NOT NULL DEFAULT 'none' CHECK(transcription_status IN ('none', 'draft', 'ai_generated', 'verified'));
