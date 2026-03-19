import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent'

// ── Domain-aware OCR prompts ────────────────────────────────────────────────

const DOMAIN_CONTEXT: Record<string, string> = {
  museum_collection: 'museum and cultural heritage documentation. Labels may include inventory numbers, artist names, dates, dimensions, and provenance notes.',
  conservation_lab: 'conservation and restoration documentation. Documents may include treatment reports, material analyses, condition assessments, and chemical formulae.',
  human_rights: 'human rights field documentation. Documents may include incident reports, witness statements, case numbers, and location identifiers. Transcribe exactly without interpretation.',
  archaeological_site: 'archaeological field documentation. Documents may include context sheets, finds registers, stratigraphic descriptions, and grid references.',
  natural_history: 'natural history specimen documentation. Documents may include taxonomic labels, collection data, locality information, and specimen measurements.',
  general: 'general collection documentation.',
}

function buildSystemPrompt(domain: string): string {
  const context = DOMAIN_CONTEXT[domain] ?? DOMAIN_CONTEXT.general
  return `You are an expert document reader specializing in ${context}
Extract ALL text from this document image. The document may contain:
- Printed text (labels, forms, reports)
- Handwritten notes (field notes, annotations, signatures)
- Mixed languages (especially English and German)
- Faded, damaged, or partially obscured text
- Technical terminology specific to the domain

Return a JSON object:
{
  "text": "the complete extracted text, preserving line breaks and structure",
  "confidence": 0.0-1.0,
  "language": "detected primary language (ISO 639-1)",
  "handwriting_detected": true/false,
  "notes": "any observations about document quality or ambiguous readings"
}
Respond with ONLY the JSON object, no markdown, no preamble.`
}

// ── Edge Function handler ───────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
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
    // Verify JWT
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ status: 'error', error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ status: 'error', error: 'GEMINI_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Parse request
    const body = await req.json() as {
      image_base64?: string
      mime_type?: string
      existing_text?: string
      existing_confidence?: number
      domain?: string
    }

    if (!body.image_base64) {
      return new Response(JSON.stringify({ status: 'error', error: 'image_base64 is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const domain = body.domain ?? 'general'
    const mimeType = body.mime_type ?? 'image/jpeg'
    const existingConfidence = body.existing_confidence ?? 0

    console.log(`ocr-enhance: user=${user.id} domain=${domain} existing_confidence=${existingConfidence}`)

    // Call Gemini
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
                  mimeType,
                  data: body.image_base64,
                },
              },
              {
                text: 'Extract all text from this document image. Return ONLY the JSON object.',
              },
            ],
          },
        ],
        systemInstruction: {
          parts: [{ text: buildSystemPrompt(domain) }],
        },
        generationConfig: {
          temperature: 0.1,
          topP: 0.8,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json',
        },
      }),
    })

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text()
      console.error('ocr-enhance: Gemini API error:', geminiResponse.status, errorText)
      return new Response(JSON.stringify({
        status: 'error',
        error: `Gemini API returned ${geminiResponse.status}`,
        detail: errorText,
      }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const geminiData = await geminiResponse.json()
    const textContent = geminiData.candidates?.[0]?.content?.parts?.[0]?.text
    if (!textContent) {
      return new Response(JSON.stringify({ status: 'error', error: 'No content in Gemini response' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Parse Gemini JSON response
    let ocrResult: {
      text?: string
      confidence?: number
      language?: string
      handwriting_detected?: boolean
      notes?: string
    }
    try {
      ocrResult = JSON.parse(textContent)
    } catch {
      const cleaned = textContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      ocrResult = JSON.parse(cleaned)
    }

    // Normalize confidence to 0-100 scale (Gemini returns 0.0-1.0)
    const cloudConfidence = Math.round((ocrResult.confidence ?? 0) * 100)

    // Compare: only upgrade if cloud is better
    if (cloudConfidence <= existingConfidence) {
      return new Response(JSON.stringify({
        status: 'no_upgrade',
        cloud_confidence: cloudConfidence,
        existing_confidence: existingConfidence,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({
      status: 'upgraded',
      text: ocrResult.text ?? '',
      confidence: cloudConfidence,
      language: ocrResult.language ?? null,
      handwriting_detected: ocrResult.handwriting_detected ?? false,
      notes: ocrResult.notes ?? null,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('ocr-enhance: unhandled error:', err)
    return new Response(JSON.stringify({
      status: 'error',
      error: err instanceof Error ? err.message : 'Internal server error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
