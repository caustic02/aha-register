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

// ── Service ──────────────────────────────────────────────────────────────────

export async function analyzeObject(
  image_base64: string,
  mime_type: string = 'image/jpeg',
): Promise<AIAnalysisResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      return { success: false, error: 'Authentication required. Please sign in again.' };
    }

    const response = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ image_base64, mime_type }),
      signal: controller.signal,
    });

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
