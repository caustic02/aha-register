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
    const { imageBase64, mimeType } = await req.json() as {
      imageBase64?: string
      mimeType?: string
    }

    if (!imageBase64 || !mimeType) {
      return new Response(JSON.stringify({ error: 'Missing imageBase64 or mimeType' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Call remove.bg API
    const formData = new FormData()
    formData.append('image_file_b64', imageBase64)
    formData.append('size', 'auto')
    formData.append('format', 'png')

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
      JSON.stringify({ error: 'Internal server error' }),
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
