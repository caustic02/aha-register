/**
 * aha! Register — Index definitions for SQLite schema v1.1
 *
 * 17 indexes covering the primary query patterns.
 */
export const INDEXES_SQL = `
-- objects
CREATE INDEX IF NOT EXISTS idx_objects_institution_id   ON objects(institution_id);
CREATE INDEX IF NOT EXISTS idx_objects_site_id          ON objects(site_id);
CREATE INDEX IF NOT EXISTS idx_objects_object_type      ON objects(object_type);
CREATE INDEX IF NOT EXISTS idx_objects_coords           ON objects(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_objects_privacy_tier     ON objects(privacy_tier);
CREATE INDEX IF NOT EXISTS idx_objects_legal_hold       ON objects(legal_hold);

-- media
CREATE INDEX IF NOT EXISTS idx_media_object_id          ON media(object_id);
CREATE INDEX IF NOT EXISTS idx_media_sha256_hash        ON media(sha256_hash);

-- annotations
CREATE INDEX IF NOT EXISTS idx_annotations_object_id    ON annotations(object_id);

-- collections
CREATE INDEX IF NOT EXISTS idx_collections_institution_id ON collections(institution_id);

-- locations
CREATE INDEX IF NOT EXISTS idx_locations_site_id        ON locations(site_id);

-- documents
CREATE INDEX IF NOT EXISTS idx_documents_object_id      ON documents(object_id);

-- audit_trail
CREATE INDEX IF NOT EXISTS idx_audit_trail_record_id    ON audit_trail(record_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_user_id      ON audit_trail(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_created_at   ON audit_trail(created_at);

-- sync_queue
CREATE INDEX IF NOT EXISTS idx_sync_queue_status        ON sync_queue(status);

-- vocabulary_terms
CREATE INDEX IF NOT EXISTS idx_vocab_authority_term     ON vocabulary_terms(authority, term_id);
`;
