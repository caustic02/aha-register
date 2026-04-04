-- Add diameter unit column to objects table
-- Companion column to the existing `durchmesser` (diameter value) field.
ALTER TABLE objects ADD COLUMN IF NOT EXISTS durchmesser TEXT;
ALTER TABLE objects ADD COLUMN IF NOT EXISTS durchmesser_einheit TEXT;
