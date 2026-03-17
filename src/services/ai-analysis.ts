import { supabase } from './supabase';

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

/** Get a valid access token, refreshing if the cached session is expired. */
async function getAccessToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();

  if (session?.access_token) {
    // Check if token expires within the next 30 s (the request timeout).
    // exp is in seconds; Date.now() is in ms.
    const expiresAt = session.expires_at ?? 0;
    if (expiresAt > Date.now() / 1000 + 30) {
      return session.access_token;
    }
  }

  // Cached token missing or about to expire — force a refresh.
  const { data: { session: refreshed } } = await supabase.auth.refreshSession();
  return refreshed?.access_token ?? null;
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
): Promise<AIAnalysisResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    let token = await getAccessToken();
    if (!token) {
      return { success: false, error: 'Authentication required. Please sign in again.' };
    }

    const payload = JSON.stringify({ image_base64, mime_type });
    let response = await callEdgeFunction(token, payload, controller.signal);

    // On 401, try ONE token refresh and retry.
    if (response.status === 401) {
      const { data: { session: refreshed } } = await supabase.auth.refreshSession();
      token = refreshed?.access_token ?? null;
      if (!token) {
        return { success: false, error: 'Authentication required. Please sign in again.' };
      }
      response = await callEdgeFunction(token, payload, controller.signal);
    }

    const data = await response.json();

    if (response.status === 401) {
      return { success: false, error: 'Authentication required. Please sign in again.' };
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
