-- D1: View inventory — photographic view type tracking on media
-- NULL = uncategorized (legacy captures, quick-mode photos)
ALTER TABLE media ADD COLUMN view_type TEXT;
