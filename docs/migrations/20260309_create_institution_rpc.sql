-- Migration: create_institution_for_user RPC
-- Fixes sign-up RLS bootstrapping deadlock:
--   Bug A: After signUp() with email confirmation, session is null so
--          auth.uid() = NULL and institutions_insert policy blocks.
--   Bug B: institution_members_insert requires has_institution_role() which
--          queries institution_members — but we're creating the first row.
--
-- Solution: SECURITY DEFINER function runs as postgres, bypassing RLS.
-- All three inserts (institution, user profile, membership) happen atomically.

CREATE OR REPLACE FUNCTION public.create_institution_for_user(
  _auth_user_id uuid,
  _email text,
  _display_name text,
  _institution_name text,
  _institution_type text DEFAULT NULL,
  _settings jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _institution_id uuid;
  _user_id uuid;
BEGIN
  -- Safety: if caller has a session, enforce it matches _auth_user_id
  IF auth.uid() IS NOT NULL AND auth.uid() != _auth_user_id THEN
    RAISE EXCEPTION 'Cannot create institution for another user';
  END IF;

  -- 1. Create institution
  INSERT INTO institutions (name, institution_type, settings)
  VALUES (_institution_name, _institution_type, _settings)
  RETURNING id INTO _institution_id;

  -- 2. Create user profile
  INSERT INTO users (auth_user_id, email, display_name, role, institution_id)
  VALUES (_auth_user_id, _email, _display_name, 'owner', _institution_id)
  RETURNING id INTO _user_id;

  -- 3. Create owner membership
  INSERT INTO institution_members (institution_id, user_id, role)
  VALUES (_institution_id, _auth_user_id, 'owner');

  RETURN _institution_id;
END;
$$;

-- Grant to both authenticated and anon roles.
-- anon is needed because post-signUp with email confirmation the client
-- has no authenticated session yet.
GRANT EXECUTE ON FUNCTION public.create_institution_for_user TO authenticated, anon;
