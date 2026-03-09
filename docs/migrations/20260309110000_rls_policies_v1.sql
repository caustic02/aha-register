-- ============================================================================
-- aha! Register — RLS policies v1
-- Migration: 20260309110000_rls_policies_v1.sql
--
-- Strategy: institution_id scoping via institution_members lookup.
-- Every authenticated user can only see/modify data belonging to
-- the institution(s) they are a member of.
-- ============================================================================

-- ============================================================================
-- HELPER: get_user_institution_ids()
-- Returns all institution_ids the current user belongs to.
-- SECURITY DEFINER so it can read institution_members regardless of RLS.
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_institution_ids()
RETURNS SETOF uuid AS $$
  SELECT institution_id FROM institution_members WHERE user_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- ============================================================================
-- HELPER: has_institution_role(institution_id, roles)
-- Returns true if the current user has one of the specified roles
-- in the given institution.
-- ============================================================================

CREATE OR REPLACE FUNCTION has_institution_role(_institution_id uuid, _roles text[])
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM institution_members
    WHERE user_id = auth.uid()
      AND institution_id = _institution_id
      AND role = ANY(_roles)
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- ============================================================================
-- 1. institutions
-- ============================================================================

-- SELECT: only your institutions
CREATE POLICY institutions_select ON institutions
  FOR SELECT USING (id IN (SELECT get_user_institution_ids()));

-- INSERT: any authenticated user can create (they'll become owner via app logic)
CREATE POLICY institutions_insert ON institutions
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE: admins/owners only
CREATE POLICY institutions_update ON institutions
  FOR UPDATE USING (has_institution_role(id, ARRAY['admin', 'owner']));

-- DELETE: never via API
CREATE POLICY institutions_delete ON institutions
  FOR DELETE USING (false);


-- ============================================================================
-- 2. institution_members
-- ============================================================================

-- SELECT: see members of your institutions
CREATE POLICY institution_members_select ON institution_members
  FOR SELECT USING (institution_id IN (SELECT get_user_institution_ids()));

-- INSERT: only admins/owners can add members
CREATE POLICY institution_members_insert ON institution_members
  FOR INSERT WITH CHECK (has_institution_role(institution_id, ARRAY['admin', 'owner']));

-- UPDATE: only admins/owners can change roles
CREATE POLICY institution_members_update ON institution_members
  FOR UPDATE USING (has_institution_role(institution_id, ARRAY['admin', 'owner']));

-- DELETE: only owners can remove members, and cannot remove themselves
CREATE POLICY institution_members_delete ON institution_members
  FOR DELETE USING (
    has_institution_role(institution_id, ARRAY['owner'])
    AND user_id != auth.uid()
  );


-- ============================================================================
-- 3. sites (institution_id scoped, same pattern as objects)
-- ============================================================================

CREATE POLICY sites_select ON sites
  FOR SELECT USING (institution_id IN (SELECT get_user_institution_ids()));

CREATE POLICY sites_insert ON sites
  FOR INSERT WITH CHECK (institution_id IN (SELECT get_user_institution_ids()));

CREATE POLICY sites_update ON sites
  FOR UPDATE USING (institution_id IN (SELECT get_user_institution_ids()));

CREATE POLICY sites_delete ON sites
  FOR DELETE USING (has_institution_role(institution_id, ARRAY['admin', 'owner']));


-- ============================================================================
-- 4. users
-- ============================================================================

-- SELECT: users in the same institution(s) can see each other
CREATE POLICY users_select ON users
  FOR SELECT USING (
    institution_id IN (SELECT get_user_institution_ids())
    OR auth_user_id = auth.uid()
  );

-- INSERT: signup trigger handles creation (allow self-insert only)
CREATE POLICY users_insert ON users
  FOR INSERT WITH CHECK (auth_user_id = auth.uid());

-- UPDATE: only own record
CREATE POLICY users_update ON users
  FOR UPDATE USING (auth_user_id = auth.uid());

-- DELETE: never via API
CREATE POLICY users_delete ON users
  FOR DELETE USING (false);


-- ============================================================================
-- 5. objects (institution_id scoped)
-- ============================================================================

CREATE POLICY objects_select ON objects
  FOR SELECT USING (institution_id IN (SELECT get_user_institution_ids()));

CREATE POLICY objects_insert ON objects
  FOR INSERT WITH CHECK (institution_id IN (SELECT get_user_institution_ids()));

CREATE POLICY objects_update ON objects
  FOR UPDATE USING (institution_id IN (SELECT get_user_institution_ids()));

CREATE POLICY objects_delete ON objects
  FOR DELETE USING (has_institution_role(institution_id, ARRAY['admin', 'owner']));


-- ============================================================================
-- 6. media (institution_id scoped)
-- ============================================================================

CREATE POLICY media_select ON media
  FOR SELECT USING (institution_id IN (SELECT get_user_institution_ids()));

CREATE POLICY media_insert ON media
  FOR INSERT WITH CHECK (institution_id IN (SELECT get_user_institution_ids()));

CREATE POLICY media_update ON media
  FOR UPDATE USING (institution_id IN (SELECT get_user_institution_ids()));

CREATE POLICY media_delete ON media
  FOR DELETE USING (has_institution_role(institution_id, ARRAY['admin', 'owner']));


-- ============================================================================
-- 7. annotations (institution_id scoped)
-- ============================================================================

CREATE POLICY annotations_select ON annotations
  FOR SELECT USING (institution_id IN (SELECT get_user_institution_ids()));

CREATE POLICY annotations_insert ON annotations
  FOR INSERT WITH CHECK (institution_id IN (SELECT get_user_institution_ids()));

CREATE POLICY annotations_update ON annotations
  FOR UPDATE USING (institution_id IN (SELECT get_user_institution_ids()));

CREATE POLICY annotations_delete ON annotations
  FOR DELETE USING (has_institution_role(institution_id, ARRAY['admin', 'owner']));


-- ============================================================================
-- 8. vocabulary_terms (global, read-only via API)
-- ============================================================================

-- SELECT: everyone can read
CREATE POLICY vocabulary_terms_select ON vocabulary_terms
  FOR SELECT USING (true);

-- INSERT/UPDATE/DELETE: service role only (no policy = denied by RLS)
-- No policies created — only the service_role key bypasses RLS.


-- ============================================================================
-- 9. collections (institution_id scoped)
-- ============================================================================

CREATE POLICY collections_select ON collections
  FOR SELECT USING (institution_id IN (SELECT get_user_institution_ids()));

CREATE POLICY collections_insert ON collections
  FOR INSERT WITH CHECK (institution_id IN (SELECT get_user_institution_ids()));

CREATE POLICY collections_update ON collections
  FOR UPDATE USING (institution_id IN (SELECT get_user_institution_ids()));

CREATE POLICY collections_delete ON collections
  FOR DELETE USING (has_institution_role(institution_id, ARRAY['admin', 'owner']));


-- ============================================================================
-- 10. object_collections (institution_id scoped)
-- ============================================================================

CREATE POLICY object_collections_select ON object_collections
  FOR SELECT USING (institution_id IN (SELECT get_user_institution_ids()));

CREATE POLICY object_collections_insert ON object_collections
  FOR INSERT WITH CHECK (institution_id IN (SELECT get_user_institution_ids()));

CREATE POLICY object_collections_update ON object_collections
  FOR UPDATE USING (institution_id IN (SELECT get_user_institution_ids()));

CREATE POLICY object_collections_delete ON object_collections
  FOR DELETE USING (has_institution_role(institution_id, ARRAY['admin', 'owner']));


-- ============================================================================
-- 11. locations (institution_id scoped)
-- ============================================================================

CREATE POLICY locations_select ON locations
  FOR SELECT USING (institution_id IN (SELECT get_user_institution_ids()));

CREATE POLICY locations_insert ON locations
  FOR INSERT WITH CHECK (institution_id IN (SELECT get_user_institution_ids()));

CREATE POLICY locations_update ON locations
  FOR UPDATE USING (institution_id IN (SELECT get_user_institution_ids()));

CREATE POLICY locations_delete ON locations
  FOR DELETE USING (has_institution_role(institution_id, ARRAY['admin', 'owner']));


-- ============================================================================
-- 12. documents (institution_id scoped)
-- ============================================================================

CREATE POLICY documents_select ON documents
  FOR SELECT USING (institution_id IN (SELECT get_user_institution_ids()));

CREATE POLICY documents_insert ON documents
  FOR INSERT WITH CHECK (institution_id IN (SELECT get_user_institution_ids()));

CREATE POLICY documents_update ON documents
  FOR UPDATE USING (institution_id IN (SELECT get_user_institution_ids()));

CREATE POLICY documents_delete ON documents
  FOR DELETE USING (has_institution_role(institution_id, ARRAY['admin', 'owner']));


-- ============================================================================
-- 13. audit_trail (institution_id scoped, append-only)
-- ============================================================================

CREATE POLICY audit_trail_select ON audit_trail
  FOR SELECT USING (institution_id IN (SELECT get_user_institution_ids()));

CREATE POLICY audit_trail_insert ON audit_trail
  FOR INSERT WITH CHECK (institution_id IN (SELECT get_user_institution_ids()));

-- UPDATE: never (audit trail is immutable)
CREATE POLICY audit_trail_update ON audit_trail
  FOR UPDATE USING (false);

-- DELETE: never (audit trail is immutable)
CREATE POLICY audit_trail_delete ON audit_trail
  FOR DELETE USING (false);
