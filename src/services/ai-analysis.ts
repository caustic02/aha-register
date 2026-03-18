import { supabase, ensureMigrated } from './supabase';

const EDGE_FUNCTION_URL =
  'https://fdwmfijtpknwaesyvzbg.supabase.co/functions/v1/analyze-object';

const TIMEOUT_MS = 30_000;

// ── Types ────────────────────────────────────────────────────────────────────

export interface AIFieldResult {
  value: string | string[] | null;
  confidence: number;
}

export interface AISuggestedArtist {
  name: string | null;
  role: string;
  confidence: number;
}

export interface AIAnalysisResult {
  title: AIFieldResult;
  object_type: AIFieldResult;
  date_created: AIFieldResult;
  medium: AIFieldResult;
  dimensions_description: AIFieldResult;
  description: AIFieldResult;
  style_period: AIFieldResult;
  culture_origin: AIFieldResult;
  condition_summary: AIFieldResult;
  suggested_artists: { value: AISuggestedArtist[] };
  keywords: AIFieldResult;
}

export interface AIAnalysisResponse {
  success: boolean;
  metadata?: AIAnalysisResult;
  model?: string;
  analyzed_at?: string;
  error?: string;
}

// ── Auth helpers ─────────────────────────────────────────────────────────────

/**
 * Get a valid access token, using a three-tier fallback:
 *  1. Cached session (if token not expiring within 30 s)
 *  2. Refresh the existing session
 *  3. Anonymous sign-in (creates a temporary JWT without user interaction)
 */
async function getAccessToken(): Promise<string | null> {
  // Ensure auth tokens have been migrated from AsyncStorage → SecureStore
  // before any session read, otherwise getSession() may return null on
  // fresh installs even when the user signed in.
  await ensureMigrated();

  // 1. Try cached session
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    const expiresAt = session.expires_at ?? 0;
    if (expiresAt > Date.now() / 1000 + 30) {
      return session.access_token;
    }
  }

  // 2. Try refreshing (works when refresh token is still valid)
  const { data: { session: refreshed } } = await supabase.auth.refreshSession();
  if (refreshed?.access_token) {
    return refreshed.access_token;
  }

  // 3. No valid session at all — sign in anonymously so the capture flow
  //    is never blocked by auth. Anonymous users get a real JWT that the
  //    Edge Function accepts; RLS limits what they can access.
  const { data: { session: anonSession }, error } =
    await supabase.auth.signInAnonymously();
  if (error || !anonSession?.access_token) {
    return null;
  }
  return anonSession.access_token;
}

// ── Service ──────────────────────────────────────────────────────────────────

async function callEdgeFunction(
  accessToken: string,
  body: string,
  signal: AbortSignal,
): Promise<Response> {
  return fetch(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body,
    signal,
  });
}

export async function analyzeObject(
  image_base64: string,
  mime_type: string = 'image/jpeg',
  domain: string = 'general',
): Promise<AIAnalysisResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    let token = await getAccessToken();
    if (!token) {
      return { success: false, error: 'NO_AUTH_SESSION' };
    }

    const payload = JSON.stringify({ image_base64, mime_type, domain });
    let response = await callEdgeFunction(token, payload, controller.signal);

    // On 401, get a fresh token (refresh → anonymous fallback) and retry once.
    if (response.status === 401) {
      token = await getAccessToken();
      if (!token) {
        return { success: false, error: 'NO_AUTH_SESSION' };
      }
      response = await callEdgeFunction(token, payload, controller.signal);
    }

    const data = await response.json();

    if (response.status === 401) {
      return { success: false, error: 'NO_AUTH_SESSION' };
    }

    if (!response.ok) {
      return {
        success: false,
        error: data.error ?? `Server returned ${response.status}`,
      };
    }

    return data as AIAnalysisResponse;
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { success: false, error: 'Request timed out after 30 seconds' };
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Network error',
    };
  } finally {
    clearTimeout(timeout);
  }
}
