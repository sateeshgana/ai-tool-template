const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type Provider = {
  baseUrl: string
  apiKey: string
  model: string
}

function detectProvider(): Provider | null {
  if (process.env.GROQ_API_KEY) {
    return {
      baseUrl: 'https://api.groq.com/openai/v1',
      apiKey:  process.env.GROQ_API_KEY,
      model:   'llama-3.3-70b-versatile',
    }
  }
  if (process.env.DEEPSEEK_API_KEY) {
    return {
      baseUrl: 'https://api.deepseek.com/v1',
      apiKey:  process.env.DEEPSEEK_API_KEY,
      model:   'deepseek-chat',
    }
  }
  if (process.env.OPENAI_API_KEY) {
    return {
      baseUrl: 'https://api.openai.com/v1',
      apiKey:  process.env.OPENAI_API_KEY,
      model:   'gpt-4o-mini',
    }
  }
  if (process.env.OPENROUTER_API_KEY) {
    return {
      baseUrl: 'https://openrouter.ai/api/v1',
      apiKey:  process.env.OPENROUTER_API_KEY,
      model:   'meta-llama/llama-3.3-70b-instruct:free',
    }
  }
  return null
}

export default async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS })
  }

  const provider = detectProvider()
  if (!provider) {
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

  const systemPrompt = process.env.SYSTEM_PROMPT
  const userMessages = (body.messages as Array<{ role: string; content: string }>)
    .filter(m => m.role !== 'system')
  const messages = systemPrompt
    ? [{ role: 'system', content: systemPrompt }, ...userMessages]
    : userMessages

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20_000)

  let upstream: Response
  try {
    upstream = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: provider.model, messages, stream: true }),
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
    } catch { /* ignore */ }
    return new Response(
      JSON.stringify({ error: message }),
      { status: upstream.status, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  }

  // Pipe the provider SSE stream to the client as SSE
  const encoder = new TextEncoder()
  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()

  ;(async () => {
    const reader = upstream.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || trimmed === 'data: [DONE]') continue
          if (!trimmed.startsWith('data: ')) continue

          try {
            const json = JSON.parse(trimmed.slice(6)) as {
              choices?: Array<{ delta?: { content?: string } }>
            }
            const token = json.choices?.[0]?.delta?.content
            if (token) {
              await writer.write(encoder.encode(`data: ${token}\n\n`))
            }
          } catch { /* malformed chunk — skip */ }
        }
      }
    } finally {
      await writer.write(encoder.encode('data: [DONE]\n\n'))
      await writer.close()
    }
  })()

  return new Response(readable, {
    status: 200,
    headers: {
      ...CORS,
      'Content-Type':      'text/event-stream',
      'Cache-Control':     'no-cache',
      'X-Accel-Buffering': 'no',
    },
  })
}
