-- Migration: add location_* columns to objects table
-- These columns exist in the phone app's SQLite schema (added via ALTER TABLE migrations)
-- but were missing from Supabase, causing sync to fail with "column not found in schema cache".

ALTER TABLE objects ADD COLUMN IF NOT EXISTS location_building TEXT;
ALTER TABLE objects ADD COLUMN IF NOT EXISTS location_floor     TEXT;
ALTER TABLE objects ADD COLUMN IF NOT EXISTS location_room      TEXT;
ALTER TABLE objects ADD COLUMN IF NOT EXISTS location_shelf     TEXT;
ALTER TABLE objects ADD COLUMN IF NOT EXISTS location_notes     TEXT;
