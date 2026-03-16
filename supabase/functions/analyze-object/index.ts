import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent'

const SYSTEM_PROMPT = `You are a museum registrar and art historian AI assistant for the aha! Register collection management system. You analyze photographs of museum objects, artworks, cultural heritage items, and specimens.

Given a photograph, extract structured metadata. Be specific and professional. Use standard museum cataloging conventions.

Respond ONLY with valid JSON matching this exact schema:

{
  "title": {
    "value": "string - descriptive title for the object",
    "confidence": number 0-100
  },
  "object_type": {
    "value": "string - one of: painting, sculpture, drawing, print, photograph, textile, ceramic, glass, metal, furniture, jewelry, manuscript, book, natural_specimen, archaeological, ethnographic, scientific_instrument, mixed_media, installation, other",
    "confidence": number 0-100
  },
  "date_created": {
    "value": "string - date or date range, e.g. 'ca. 1650', '3rd century BCE', '1920-1925'",
    "confidence": number 0-100
  },
  "medium": {
    "value": "string - materials and techniques, e.g. 'Oil on canvas', 'Bronze, patinated', 'Gelatin silver print'",
    "confidence": number 0-100
  },
  "dimensions_description": {
    "value": "string - estimated dimensions if discernible, e.g. 'approximately 30 x 40 cm'",
    "confidence": number 0-100
  },
  "description": {
    "value": "string - 2-3 sentence objective description of what is depicted/what the object is",
    "confidence": number 0-100
  },
  "style_period": {
    "value": "string - art historical period or style, e.g. 'Baroque', 'Art Nouveau', 'Minimalism'",
    "confidence": number 0-100
  },
  "culture_origin": {
    "value": "string - cultural or geographic origin if identifiable",
    "confidence": number 0-100
  },
  "condition_summary": {
    "value": "string - brief visible condition assessment, e.g. 'Good, minor surface wear', 'Fair, visible cracking in upper left'",
    "confidence": number 0-100
  },
  "suggested_artists": {
    "value": [
      {
        "name": "string - artist name if identifiable, otherwise null",
        "role": "string - one of: artist, collaborator, fabricator, photographer, publisher, unknown",
        "confidence": number 0-100
      }
    ]
  },
  "keywords": {
    "value": ["string - 3-8 relevant catalog keywords"],
    "confidence": number 0-100
  }
}

Rules:
- If you cannot determine a field, set value to null and confidence to 0
- Confidence reflects how certain you are: 90+ = highly confident, 70-89 = probable, 40-69 = possible, below 40 = speculative
- Use professional museum vocabulary (AAT, ULAN conventions)
- Do not invent provenance or ownership history
- For dimensions, only estimate if there are visual cues (human hand for scale, standard frame sizes)
- For condition, only note what is clearly visible in the photograph`

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

    console.log(`analyze-object called by user ${user.id}`)

    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not configured')
    }

    const body = await req.json()
    const { image_base64, mime_type = 'image/jpeg' } = body

    if (!image_base64) {
      return new Response(JSON.stringify({ error: 'image_base64 is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

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
                text: 'Analyze this museum object or artwork photograph and extract structured metadata. Return ONLY the JSON object, no markdown formatting, no code fences.',
              },
            ],
          },
        ],
        systemInstruction: {
          parts: [{ text: SYSTEM_PROMPT }],
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
