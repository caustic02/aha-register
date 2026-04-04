// Deploy after changes:
//   npx supabase functions deploy remove-background --project-ref fdwmfijtpknwaesyvzbg

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const REMOVE_BG_API_KEY = Deno.env.get('REMOVE_BG_API_KEY')
const REMOVE_BG_URL = 'https://api.remove.bg/v1.0/removebg'

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
    // Verify JWT
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

    // Validate API key is configured
    if (!REMOVE_BG_API_KEY) {
      return new Response(JSON.stringify({ error: 'REMOVE_BG_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Parse request body
    const { imageBase64, mimeType, type, semitransparency } = await req.json() as {
      imageBase64?: string
      mimeType?: string
      type?: string
      semitransparency?: boolean
    }

    if (!imageBase64 || !mimeType) {
      return new Response(JSON.stringify({ error: 'Missing imageBase64 or mimeType' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Decode base64 → binary Blob so we send via `image_file` (binary upload).
    // The `image_file_b64` FormData text field is unreliable in Deno edge
    // runtime for large payloads — remove.bg returns "failed_to_read_image".
    const binaryStr = atob(imageBase64)
    const bytes = new Uint8Array(binaryStr.length)
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i)
    }
    const imageBlob = new Blob([bytes], { type: mimeType })

    console.log('[remove-background] Image blob size:', imageBlob.size, 'bytes, first 50 base64 chars:', imageBase64.slice(0, 50))

    // Call remove.bg API with binary file upload
    const formData = new FormData()
    formData.append('image_file', imageBlob, 'image.jpg')
    formData.append('size', 'auto')
    formData.append('format', 'png')

    // Pass object type hint — "product" gives much better results for non-human objects
    if (type) {
      formData.append('type', type)
    }
    if (semitransparency != null) {
      formData.append('semitransparency', String(semitransparency))
    }

    console.log('[remove-background] Calling remove.bg, blob size:', imageBlob.size, 'type:', type ?? 'auto')

    const bgResponse = await fetch(REMOVE_BG_URL, {
      method: 'POST',
      headers: {
        'X-Api-Key': REMOVE_BG_API_KEY,
      },
      body: formData,
    })

    if (!bgResponse.ok) {
      const errorText = await bgResponse.text()
      console.error('[remove-background] API error:', bgResponse.status, errorText)
      return new Response(
        JSON.stringify({
          error: `remove.bg API error: ${bgResponse.status}`,
          detail: errorText,
        }),
        {
          status: bgResponse.status >= 500 ? 502 : bgResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // Convert response to base64
    const resultBuffer = await bgResponse.arrayBuffer()
    const resultBytes = new Uint8Array(resultBuffer)
    let binaryString = ''
    for (let i = 0; i < resultBytes.length; i++) {
      binaryString += String.fromCharCode(resultBytes[i])
    }
    const resultBase64 = btoa(binaryString)

    console.log('[remove-background] Success, result size:', resultBase64.length)

    return new Response(
      JSON.stringify({
        resultBase64,
        mimeType: 'image/png',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (err) {
    console.error('[remove-background] Unhandled error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal server error', detail: String(err) }),
      {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
      },
    )
  }
})
