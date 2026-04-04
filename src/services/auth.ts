import type { SQLiteDatabase } from 'expo-sqlite';
import type { Session, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { getSetting, setSetting, SETTING_KEYS } from './settingsService';

// ── Types ────────────────────────────────────────────────────────────────────

export interface AuthResult {
  success: boolean;
  error?: string;
}

// ── Service ──────────────────────────────────────────────────────────────────

export async function signUp(
  db: SQLiteDatabase,
  email: string,
  password: string,
  displayName: string,
): Promise<AuthResult> {
  // 1. Create auth user
  const { data, error: authError } = await supabase.auth.signUp({ email, password });
  if (authError) return { success: false, error: authError.message };
  if (!data.user) return { success: false, error: 'Sign up failed' };

  const authUserId = data.user.id;

  try {
    // 2. Read institution info from onboarding settings
    const institutionName =
      (await getSetting(db, SETTING_KEYS.INSTITUTION_NAME)) || 'My Institution';
    const institutionType =
      (await getSetting(db, SETTING_KEYS.INSTITUTION_TYPE)) || 'other';

    // 3. Create institution + user profile + membership via SECURITY DEFINER RPC
    //    This bypasses RLS, solving both the null-session (email confirmation)
    //    and the chicken-and-egg membership bootstrapping problems.
    const { data: institutionId, error: rpcError } = await supabase.rpc(
      'create_institution_for_user',
      {
        _auth_user_id: authUserId,
        _email: email,
        _display_name: displayName,
        _institution_name: institutionName,
        _institution_type: institutionType,
      },
    );
    if (rpcError) throw new Error(rpcError.message);

    // 4. Save to local settings
    await setSetting(db, SETTING_KEYS.SYNC_INSTITUTION_ID, institutionId);
    await setSetting(db, SETTING_KEYS.SYNC_ENABLED, 'true');

    return { success: true };
  } catch (err) {
    // Cleanup: we can't delete the auth user from client side,
    // but we log the error so the user can retry
    if (__DEV__) console.warn('[auth] sign-up post-auth setup failed:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Setup failed after account creation',
    };
  }
}

export async function signIn(
  db: SQLiteDatabase,
  email: string,
  password: string,
): Promise<AuthResult> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) return { success: false, error: error.message };
  if (!data.user) return { success: false, error: 'Sign in failed' };

  // Enable sync regardless of institution lookup outcome
  await setSetting(db, SETTING_KEYS.SYNC_ENABLED, 'true');

  // Load user's institution from cloud (best-effort)
  try {
    const { data: membership } = await supabase
      .from('institution_members')
      .select('institution_id')
      .eq('user_id', data.user.id)
      .limit(1)
      .single();

    if (membership?.institution_id) {
      await setSetting(db, SETTING_KEYS.SYNC_INSTITUTION_ID, membership.institution_id);
    }
  } catch (err) {
    console.error('[auth] could not load institution:', err);
  }

  return { success: true };
}

export async function signOut(db: SQLiteDatabase): Promise<void> {
  await supabase.auth.signOut();
  await setSetting(db, SETTING_KEYS.SYNC_ENABLED, 'false');
}

export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void,
) {
  const { data } = supabase.auth.onAuthStateChange(callback);
  return data.subscription;
}

export async function refreshSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.refreshSession();
  if (error) {
    if (__DEV__) console.warn('[auth] refresh failed:', error.message);
    return null;
  }
  return data.session;
}
