import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent'

// ── Domain-specific system prompts ──────────────────────────────────────────

const JSON_SCHEMA = `
{
  "title": { "value": "string - descriptive title", "confidence": number 0-100 },
  "object_type": { "value": "string - object classification", "confidence": number 0-100 },
  "date_created": { "value": "string - date or range, e.g. 'ca. 1650', '1920-1925'", "confidence": number 0-100 },
  "medium": { "value": "string - materials and techniques", "confidence": number 0-100 },
  "dimensions_description": { "value": "string - estimated dimensions if discernible", "confidence": number 0-100 },
  "description": { "value": "string - 2-3 sentence objective description", "confidence": number 0-100 },
  "style_period": { "value": "string - period or style classification", "confidence": number 0-100 },
  "culture_origin": { "value": "string - cultural or geographic origin", "confidence": number 0-100 },
  "condition_summary": { "value": "string - visible condition assessment", "confidence": number 0-100 },
  "suggested_artists": { "value": [{ "name": "string or null", "role": "string", "confidence": number 0-100 }] },
  "keywords": { "value": ["string - 3-8 relevant keywords"], "confidence": number 0-100 }
}`

const SHARED_RULES = `
Rules:
- FIRST look carefully at the photograph and identify what the object actually is
- Return plain, human-readable descriptions — do NOT return taxonomy codes, classification hierarchies, or vocabulary identifiers
- If you cannot determine a field, set value to null and confidence to 0
- Confidence: 90+ = highly confident, 70-89 = probable, 40-69 = possible, below 40 = speculative
- For dimensions, only estimate if there are visual cues (hand for scale, standard frame sizes)
- Do NOT guess historical art periods for modern manufactured objects — use "contemporary" or "modern"
- For object_type, use a single clear term describing what the object IS (e.g., "calculator", "ceramic vase", "oil painting") — not a taxonomy category
- For medium/materials, list the actual materials visible (e.g., "plastic, metal, glass LCD screen") — not abstract material categories
- For condition, describe what you can see (e.g., "good condition, minor scratches on casing") — not a single-word rating
- If uncertain about a field, say so honestly and give a low confidence score
- Respond ONLY with valid JSON matching the schema above`

const DOMAIN_PROMPTS: Record<string, string> = {
  museum_collection: `You are a museum registrar with expertise in art history, decorative arts, and material culture. You analyze photographs for a professional collection management system.

IMPORTANT: First LOOK at the photograph carefully and identify what the object actually is. Then provide structured metadata.

Prioritize:
- Object type as a clear, specific term describing the object (e.g., "porcelain teacup", "bronze sculpture", "watercolor painting", "scientific calculator")
- Material and technique identification with specificity (e.g., "oil on canvas", "glazed porcelain", "injection-molded plastic")
- Accurate dating with reasoning based on visual style cues. For modern manufactured objects, use "contemporary" or the approximate decade
- Style/period classification only when genuinely applicable. Do NOT assign historical art periods to modern manufactured objects
- Condition assessment: describe what you see (e.g., "good condition, minor wear to gilding on rim", "intact, no visible damage")
- Artist attribution only if genuinely identifiable from the image
- Cultural and geographic origin based on visual evidence

Do NOT return Getty AAT taxonomy codes or classification hierarchy terms. Return plain, descriptive language that a non-specialist can understand. Do not invent provenance or ownership history.

Respond ONLY with valid JSON matching this schema:
${JSON_SCHEMA}
${SHARED_RULES}`,

  conservation_lab: `You are a conservation specialist documenting objects for condition assessment and treatment planning. You analyze photographs to support conservation workflows.

Prioritize:
- Detailed material identification: substrate, media layers, surface coatings, adhesives, varnishes
- Comprehensive condition observations: cracking patterns (network, drying, age), flaking, delamination, discoloration, losses, previous repairs, fills, inpainting, structural deformation
- Environmental damage indicators: light damage (fading, yellowing), moisture (tidelines, foxing, mold), biological (insect damage, frass), air pollutant effects
- Technique analysis relevant to conservation treatment decisions
- Accurate dimensions when visual cues are present
- Surface analysis: gloss, texture, patina, corrosion products

Use conservation-standard vocabulary. For condition_summary, be as detailed as possible about all observable damage and previous interventions. The description should focus on physical structure and material layers.

Respond ONLY with valid JSON matching this schema:
${JSON_SCHEMA}
${SHARED_RULES}`,

  human_rights: `You are a field investigator documenting physical evidence under the Berkeley Protocol for digital open source investigations. You analyze photographs to create objective evidence records.

Prioritize:
- Objective physical description without interpretation or speculation
- Precise dimensional observations using any available scale references
- Material identification based on observable properties
- Visible markings: text, numbers, symbols, labels, stamps, serial numbers, barcodes
- Signs of damage, alteration, or tampering
- Contextual details visible in the photograph (background, surface, lighting conditions)
- Observable state of the object (new, used, damaged, modified)

CRITICAL: Do NOT speculate about provenance, attribution, ownership, or narrative context. Describe ONLY what is visually observable. Do NOT assign artistic or cultural interpretation. This documentation may be used as evidence in legal proceedings.

For keywords, use descriptive physical terms, not interpretive ones.

Respond ONLY with valid JSON matching this schema:
${JSON_SCHEMA}
${SHARED_RULES}`,

  archaeological_site: `You are an archaeologist and field documentation specialist. You analyze photographs of finds, features, and contexts for a professional field recording system.

Prioritize:
- Object classification using archaeological typology (vessel form, tool type, architectural element)
- Material identification: fabric, ware, stone type, metal composition indicators
- Technique and manufacture indicators: wheel-thrown, hand-built, cast, forged, knapped
- Surface treatment: slip, glaze, paint, burnishing, incision, stamping
- Dating indicators: typological parallels, diagnostic features, technology markers
- Condition: completeness (percentage, joining fragments), surface preservation, erosion, encrustation
- Contextual observations visible in photograph (soil matrix, stratigraphy, associated materials)

Use standard archaeological recording vocabulary. For dating, indicate the basis of your estimate (typological parallel, technology, stylistic).

Respond ONLY with valid JSON matching this schema:
${JSON_SCHEMA}
${SHARED_RULES}`,

  natural_history: `You are a natural history collections specialist. You analyze photographs of biological, geological, and paleontological specimens for a professional specimen management system.

Prioritize:
- Taxonomic identification to the most specific level possible (phylum/class/order/family/genus/species)
- Specimen type classification (study skin, mounted specimen, wet specimen, thin section, mineral, fossil)
- Preservation state and method (dried, pinned, fluid-preserved, freeze-dried, cast/mold)
- Observable morphological features relevant to identification
- Specimen condition: completeness, damage, degradation, label condition
- Estimated dimensions using available scale references
- Collection-relevant details: labels, tags, preparation quality

Use scientific nomenclature where possible. For keywords, include both common and scientific names.

Respond ONLY with valid JSON matching this schema:
${JSON_SCHEMA}
${SHARED_RULES}`,

  general: `You are an AI assistant for the aha! Register collection management system. You analyze photographs of objects and extract structured metadata.

IMPORTANT: First LOOK at the photograph carefully and describe what you actually see. Then provide structured metadata based on your observations.

Given a photograph, provide:
- A descriptive title for the object (what it IS, in plain language)
- Object type: a single clear term (e.g., "calculator", "ceramic vase", "oil painting", "wristwatch", "wooden chair")
- Materials: list actual visible materials (e.g., "plastic, metal, glass", "oil paint on stretched canvas", "glazed stoneware")
- Estimated date or period — for modern manufactured objects, say "contemporary" or the approximate decade. Do NOT guess historical periods for obviously modern items
- Style classification ONLY if genuinely applicable. Leave null for everyday modern objects
- Dimensions if visual cues are present
- Condition: describe what you see (e.g., "good condition, minor scratches", "intact, some yellowing")
- Objective 2-3 sentence physical description
- Relevant keywords describing the object

Do NOT return taxonomy codes or classification hierarchies. Return plain, human-readable descriptions. If you are uncertain, say so and give a low confidence score. Do not invent provenance or ownership history.

Respond ONLY with valid JSON matching this schema:
${JSON_SCHEMA}
${SHARED_RULES}`,
}

// ── User prompt per domain ──────────────────────────────────────────────────

const DOMAIN_USER_PROMPTS: Record<string, string> = {
  museum_collection: 'Look at this photograph carefully. Identify what the object is, then extract structured metadata using plain descriptive language (not taxonomy codes). Return ONLY the JSON object.',
  conservation_lab: 'Analyze this object photograph for conservation documentation. Focus on materials, condition, and damage assessment. Return ONLY the JSON object.',
  human_rights: 'Document this object photograph as evidence following the Berkeley Protocol. Describe only what is visually observable. Return ONLY the JSON object.',
  archaeological_site: 'Analyze this archaeological find photograph. Classify and describe using standard field recording conventions. Return ONLY the JSON object.',
  natural_history: 'Analyze this specimen photograph for natural history documentation. Identify taxonomy and preservation state. Return ONLY the JSON object.',
  general: 'Look at this photograph carefully. Describe what you see, then extract structured metadata using plain descriptive language (not taxonomy codes or classification terms). Return ONLY the JSON object, no markdown formatting, no code fences.',
}

// ── Edge Function handler ───────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // CORS headers for mobile app
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    // Verify JWT and extract authenticated user
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not configured')
    }

    const body = await req.json()
    const { image_base64, mime_type = 'image/jpeg', domain = 'general' } = body

    if (!image_base64) {
      return new Response(JSON.stringify({ error: 'image_base64 is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Select domain-specific prompt (fall back to general if unknown domain)
    const systemPrompt = DOMAIN_PROMPTS[domain] ?? DOMAIN_PROMPTS.general
    const userPrompt = DOMAIN_USER_PROMPTS[domain] ?? DOMAIN_USER_PROMPTS.general

    console.log(`analyze-object: user=${user.id} domain=${domain}`)

    // Call Gemini API
    const geminiResponse = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: mime_type,
                  data: image_base64,
                },
              },
              {
                text: userPrompt,
              },
            ],
          },
        ],
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        generationConfig: {
          temperature: 0.2,
          topP: 0.8,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',
        },
      }),
    })

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text()
      console.error('Gemini API error:', geminiResponse.status, errorText)
      throw new Error(`Gemini API returned ${geminiResponse.status}`)
    }

    const geminiData = await geminiResponse.json()

    // Extract the text content from Gemini's response
    const textContent = geminiData.candidates?.[0]?.content?.parts?.[0]?.text
    if (!textContent) {
      throw new Error('No content in Gemini response')
    }

    // Parse the JSON response (Gemini with responseMimeType should return clean JSON)
    let metadata
    try {
      metadata = JSON.parse(textContent)
    } catch {
      // If JSON parse fails, try stripping markdown code fences
      const cleaned = textContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      metadata = JSON.parse(cleaned)
    }

    return new Response(JSON.stringify({
      success: true,
      metadata,
      model: 'gemini-2.5-pro',
      domain,
      analyzed_at: new Date().toISOString(),
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('analyze-object error:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
