# State of the Art: AI Integration

> Last updated: 2026-03-16
> Status: ACTIVE

## What This Is

Register uses Google Gemini 2.5 Pro to analyze photographs and pre-fill museum cataloging metadata. The analysis runs on a Supabase Edge Function so the API key never touches the client. The client calls the Edge Function; the Edge Function calls Gemini; the structured JSON result flows back into `ReviewCardScreen` as editable, confidence-annotated fields.

---

## Architecture

```
CaptureScreen → AIProcessingScreen
  → analyzeObject() [src/services/ai-analysis.ts]
    → POST /functions/v1/analyze-object [Supabase Edge Function]
      → Gemini 2.5 Pro [generativelanguage.googleapis.com]
        ← { success, metadata, model, analyzed_at }
  ← AIAnalysisResult
→ ReviewCardScreen (editable form, AI badges per field)
```

---

## Edge Function

**File:** `supabase/functions/analyze-object/index.ts`

**URL:** `https://fdwmfijtpknwaesyvzbg.supabase.co/functions/v1/analyze-object`

**Runtime:** Deno (Supabase Edge Runtime)

**Model:** `gemini-2.5-pro` via `generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent`

**Environment variable required:** `GEMINI_API_KEY`

### Request

```http
POST /functions/v1/analyze-object
Content-Type: application/json

{
  "image_base64": "<base64-encoded image bytes>",
  "mime_type": "image/jpeg"   // optional, defaults to "image/jpeg"
}
```

### Response (success)

```json
{
  "success": true,
  "model": "gemini-2.5-pro",
  "analyzed_at": "2026-03-16T14:23:00.000Z",
  "metadata": { /* AIAnalysisResult — see schema below */ }
}
```

### Response (error)

```json
{
  "success": false,
  "error": "human-readable error message"
}
```

### CORS

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Headers: authorization, x-client-info, apikey, content-type
Access-Control-Allow-Methods: POST, OPTIONS
```

---

## Gemini Generation Config

| Parameter | Value | Reason |
|-----------|-------|--------|
| `temperature` | `0.2` | Low — deterministic cataloging, not creative |
| `topP` | `0.8` | Tightens token sampling |
| `maxOutputTokens` | `2048` | Sufficient for full JSON response |
| `responseMimeType` | `application/json` | Instructs Gemini to return clean JSON |

---

## Prompt Template

The Edge Function sends a `systemInstruction` that defines the role and the required JSON schema. Key constraints in the prompt:

- Role: "museum registrar and art historian AI assistant"
- Vocabulary standard: AAT (Art & Architecture Thesaurus), ULAN conventions
- Do not invent provenance or ownership history
- Dimensions: only estimate when visual cues exist (human hand, standard frame)
- Condition: only report what is clearly visible in the photograph

---

## Analysis Result Schema (`AIAnalysisResult`)

Defined in `src/services/ai-analysis.ts`. Each field (except `suggested_artists`) follows `{ value, confidence }`:

| Field | Type | Description |
|-------|------|-------------|
| `title` | `AIFieldResult` | Descriptive title for the object |
| `object_type` | `AIFieldResult` | One of ~20 museum object type strings |
| `date_created` | `AIFieldResult` | Date or range, e.g. `"ca. 1650"`, `"1920-1925"` |
| `medium` | `AIFieldResult` | Materials and technique, e.g. `"Oil on canvas"` |
| `dimensions_description` | `AIFieldResult` | Estimated dimensions if cues visible |
| `description` | `AIFieldResult` | 2–3 sentence objective description |
| `style_period` | `AIFieldResult` | Art-historical period, e.g. `"Baroque"` |
| `culture_origin` | `AIFieldResult` | Cultural/geographic origin if identifiable |
| `condition_summary` | `AIFieldResult` | Visible condition, e.g. `"Good, minor wear"` |
| `suggested_artists` | `{ value: AISuggestedArtist[] }` | Array of identified persons |
| `keywords` | `AIFieldResult` | 3–8 catalog keywords (value is `string[]`) |

### `AIFieldResult`

```ts
interface AIFieldResult {
  value: string | string[] | null;  // null when field cannot be determined
  confidence: number;               // 0–100 (see confidence scale below)
}
```

### `AISuggestedArtist`

```ts
interface AISuggestedArtist {
  name: string | null;
  role: 'artist' | 'collaborator' | 'fabricator' | 'photographer' | 'publisher' | 'unknown';
  confidence: number;
}
```

---

## Confidence Scale

| Range | Meaning |
|-------|---------|
| 90–100 | Highly confident — clear visual evidence |
| 70–89 | Probable — strong indicators present |
| 40–69 | Possible — ambiguous evidence |
| 1–39 | Speculative — minimal visual cues |
| 0 | Cannot determine — `value` will be `null` |

---

## Client-Side Service

**File:** `src/services/ai-analysis.ts`

```ts
analyzeObject(image_base64: string, mime_type?: string): Promise<AIAnalysisResponse>
```

- **Timeout:** 30 seconds (`AbortController`)
- **Error handling:** Returns `{ success: false, error: '...' }` — never throws. Callers check `response.success`.

---

## UI: AI Accent Color Pattern

AI-generated fields are visually distinguished from manually entered fields using the gold AI accent.

| Token | Value | Usage |
|-------|-------|-------|
| `colors.ai` | `#A16207` | Badge text, confidence percentage label |
| `colors.aiLight` | `#FEF9C3` | Badge background, field highlight |
| `colors.aiSurface` | `#FFFBEB` | AI section card background |

**Rule:** Gold (`colors.ai`) = AI-generated, potentially unverified. Never use for non-AI content.

**Implementation:**
1. Wrap each AI-prefilled field with `<AIField label="..." confidence={n}>` — renders gold `Badge variant="ai" label="AI"` + confidence `%` when `confidence > 0`.
2. Render `<ConfidenceBar confidence={n} />` for numerical indication.
3. When `confidence === 0`, wrapper renders nothing extra — field looks normal.

**Usage sites:** `ReviewCardScreen` — all fields prefilled from `AIAnalysisResult`.

---

## Error Handling

| Error | Behaviour |
|-------|-----------|
| `GEMINI_API_KEY` not set | Edge Function returns 500 |
| Gemini API non-200 | Logged server-side; client receives `{ success: false, error: 'Gemini API returned N' }` |
| JSON parse failure | Edge Function strips markdown code fences and retries parse once |
| Client timeout (30 s) | `AbortError` caught; returns `{ success: false, error: 'Request timed out after 30 seconds' }` |
| Network error | Caught; returns `{ success: false, error: <message> }` |

When `success: false`, `AIProcessingScreen` shows an error state and the user can fall back to manual entry (Skip AI path → `ReviewCard` with `EMPTY_ANALYSIS`).

---

## Key Files

| File | Purpose |
|------|---------|
| `supabase/functions/analyze-object/index.ts` | Deno Edge Function — receives image, calls Gemini, returns `AIAnalysisResult` |
| `src/services/ai-analysis.ts` | Client fetch wrapper with 30 s timeout and typed response |
| `src/screens/AIProcessingScreen.tsx` | Animated 5-step progress UI during analysis |
| `src/screens/ReviewCardScreen.tsx` | Editable form with AI badges and confidence bars |
| `src/theme/index.ts` | `colors.ai`, `colors.aiLight`, `colors.aiSurface` tokens |

---

## Decision History

| Date | Decision | Reference |
|------|----------|-----------|
| 2026-03-15 | Gemini 2.5 Pro selected over 1.5 Flash for accuracy on difficult objects | Model evaluation |
| 2026-03-15 | Edge Function pattern chosen — keeps API key server-side | Security design |
| 2026-03-15 | 30 s client timeout — balances large image processing vs UX | UX testing |
| 2026-03-15 | `responseMimeType: 'application/json'` + fallback fence-strip | Gemini reliability |
