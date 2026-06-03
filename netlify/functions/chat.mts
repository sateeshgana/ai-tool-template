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

  let body: { messages?: unknown }
  try {
    body = await req.json()
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  }

  if (!Array.isArray(body.messages)) {
    return new Response(
      JSON.stringify({ error: 'messages must be an array' }),
      { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  }

  // Strip any system messages from client — system prompt is server-side only
  const userMessages = body.messages.filter(
    (m): m is { role: string; content: string } =>
      typeof m === 'object' && m !== null &&
      'role' in m && 'content' in m &&
      (m as { role: string }).role !== 'system'
  )

  // Prepend system prompt from env if set
  const systemPrompt = process.env.SYSTEM_PROMPT
  const messages = systemPrompt
    ? [{ role: 'system', content: systemPrompt }, ...userMessages]
    : userMessages

  const isGroq     = !!process.env.GROQ_API_KEY
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

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20_000)

  let upstream: Response
  try {
    upstream = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, messages, stream: false }),
      signal: controller.signal,
    })
  } catch (err) {
    clearTimeout(timeout)
    const message = err instanceof Error && err.name === 'AbortError'
      ? 'Request timed out'
      : 'Failed to reach AI provider'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 502, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  }
  clearTimeout(timeout)

  if (!upstream.ok) {
    let message = `AI provider error (${upstream.status})`
    try {
      const errData = await upstream.json() as { error?: { message?: string } }
      if (errData.error?.message) message = errData.error.message
    } catch { /* ignore parse errors */ }
    return new Response(
      JSON.stringify({ error: message }),
      { status: upstream.status, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  }

  const data = await upstream.json() as { choices?: Array<{ message?: { content?: string } }> }
  const content = data.choices?.[0]?.message?.content ?? ''

  return new Response(
    JSON.stringify({ content }),
    { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } }
  )
}
