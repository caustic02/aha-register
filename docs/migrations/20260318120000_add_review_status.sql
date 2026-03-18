-- Migration: Add review_status column to objects table
-- Purpose: Support non-blocking quick capture (B2). Objects captured via quick
--          capture start as 'needs_review' and transition to 'complete' after
--          the user fills in metadata. Existing objects default to 'complete'.
-- Non-destructive: ADD COLUMN with DEFAULT does not rewrite existing rows.

ALTER TABLE objects ADD COLUMN review_status TEXT NOT NULL DEFAULT 'complete';
-- Values: 'needs_review' | 'in_review' | 'complete'
