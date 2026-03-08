-- Migration: 20260308180000_object_collections_join_table
-- Adds many-to-many relationship between objects and collections.

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

CREATE INDEX IF NOT EXISTS idx_object_collections_object ON object_collections(object_id);
CREATE INDEX IF NOT EXISTS idx_object_collections_collection ON object_collections(collection_id);
