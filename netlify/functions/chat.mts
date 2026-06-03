const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export default async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS })
  }

  const apiKey =
    process.env.GROQ_API_KEY ||
    process.env.DEEPSEEK_API_KEY ||
    process.env.OPENAI_API_KEY

  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'No API key configured' }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  }

  const { messages } = await req.json()

  const isGroq    = !!process.env.GROQ_API_KEY
  const isDeepSeek = !!process.env.DEEPSEEK_API_KEY

  const baseUrl = isGroq
    ? 'https://api.groq.com/openai/v1'
    : isDeepSeek
    ? 'https://api.deepseek.com/v1'
    : 'https://api.openai.com/v1'

  const model = isGroq
    ? 'llama-3.3-70b-versatile'
    : isDeepSeek
    ? 'deepseek-chat'
    : 'gpt-4o-mini'

  const upstream = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, messages, stream: false }),
  })

  if (!upstream.ok) {
    const err = await upstream.text()
    return new Response(
      JSON.stringify({ error: err }),
      { status: upstream.status, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  }

  const data = await upstream.json()
  const content = data.choices?.[0]?.message?.content ?? ''

  return new Response(
    JSON.stringify({ content }),
    { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } }
  )
}
