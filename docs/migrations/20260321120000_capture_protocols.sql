-- Capture protocol system: protocol storage + media/object metadata
-- Migration: 20260321120000_capture_protocols

CREATE TABLE IF NOT EXISTS capture_protocols (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_de TEXT,
  description TEXT,
  description_de TEXT,
  version TEXT NOT NULL DEFAULT '1.0',
  domain TEXT NOT NULL,
  object_types TEXT NOT NULL DEFAULT '[]',
  shots TEXT NOT NULL DEFAULT '[]',
  completion_rules TEXT NOT NULL DEFAULT '{}',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_capture_protocols_domain ON capture_protocols(domain);
CREATE INDEX IF NOT EXISTS idx_capture_protocols_active ON capture_protocols(is_active);

-- New columns on media table
ALTER TABLE media ADD COLUMN shot_type TEXT;
ALTER TABLE media ADD COLUMN protocol_id TEXT;
ALTER TABLE media ADD COLUMN shot_order INTEGER;

-- New columns on objects table
ALTER TABLE objects ADD COLUMN protocol_id TEXT;
ALTER TABLE objects ADD COLUMN protocol_complete INTEGER DEFAULT 0;
ALTER TABLE objects ADD COLUMN shots_completed TEXT DEFAULT '[]';
ALTER TABLE objects ADD COLUMN shots_remaining TEXT DEFAULT '[]';
