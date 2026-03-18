-- Migration: Add derivative media support (parent_media_id, media_type)
-- Purpose: Background removal (B1) creates derivative media linked to originals.
-- Non-destructive: ADD COLUMN with DEFAULT does not rewrite existing rows.

ALTER TABLE media ADD COLUMN parent_media_id TEXT REFERENCES media(id);
ALTER TABLE media ADD COLUMN media_type TEXT NOT NULL DEFAULT 'original';
-- Values: 'original', 'derivative_isolated'
