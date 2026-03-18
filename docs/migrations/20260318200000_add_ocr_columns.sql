-- Migration: 20260318200000_add_ocr_columns.sql
-- Adds OCR columns to media table for document scanning (C1).
-- Non-destructive ADD COLUMN — safe on existing data.
-- Valid ocr_source values: 'none', 'on_device', 'cloud'

ALTER TABLE media ADD COLUMN ocr_text TEXT;
ALTER TABLE media ADD COLUMN ocr_confidence REAL;
ALTER TABLE media ADD COLUMN ocr_source TEXT NOT NULL DEFAULT 'none';
