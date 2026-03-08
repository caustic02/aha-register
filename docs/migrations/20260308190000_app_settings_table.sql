-- Migration: Add app_settings key-value table
-- Date: 2026-03-08
-- Schema version: 1.2

CREATE TABLE IF NOT EXISTS app_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
