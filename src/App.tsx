import { useState, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { config } from './config'
import type { AppConfig, InputField } from './types'

const ACCENT: Record<AppConfig['accentColor'], string> = {
  cyan:    'bg-cyan-500 hover:bg-cyan-400',
  emerald: 'bg-emerald-500 hover:bg-emerald-400',
  violet:  'bg-violet-500 hover:bg-violet-400',
  orange:  'bg-orange-500 hover:bg-orange-400',
  rose:    'bg-rose-500 hover:bg-rose-400',
  blue:    'bg-blue-500 hover:bg-blue-400',
}

const ACCENT_TEXT: Record<AppConfig['accentColor'], string> = {
  cyan:    'text-cyan-400',
  emerald: 'text-emerald-400',
  violet:  'text-violet-400',
  orange:  'text-orange-400',
  rose:    'text-rose-400',
  blue:    'text-blue-400',
}

const ACCENT_BORDER: Record<AppConfig['accentColor'], string> = {
  cyan:    'border-cyan-500 text-cyan-400 hover:bg-cyan-950',
  emerald: 'border-emerald-500 text-emerald-400 hover:bg-emerald-950',
  violet:  'border-violet-500 text-violet-400 hover:bg-violet-950',
  orange:  'border-orange-500 text-orange-400 hover:bg-orange-950',
  rose:    'border-rose-500 text-rose-400 hover:bg-rose-950',
  blue:    'border-blue-500 text-blue-400 hover:bg-blue-950',
}

function buildUserMessage(fields: InputField[], values: Record<string, string>): string {
  return fields
    .filter(f => (values[f.id] ?? '').trim().length > 0)
    .map(f => `${f.label}:\n${values[f.id]}`)
    .join('\n\n')
}

export default function App() {
  const [values,    setValues]    = useState<Record<string, string>>({})
  const [output,    setOutput]    = useState('')
  const [streaming, setStreaming] = useState(false)
  const [done,      setDone]      = useState(false)
  const [error,     setError]     = useState('')
  const [copied,    setCopied]    = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const accent       = ACCENT[config.accentColor]
  const accentText   = ACCENT_TEXT[config.accentColor]
  const accentBorder = ACCENT_BORDER[config.accentColor]
  const hasInput     = config.inputs.some(f => (values[f.id] ?? '').trim().length > 0)

  async function runStream() {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setStreaming(true)
    setDone(false)
    setOutput('')
    setError('')

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'user', content: buildUserMessage(config.inputs, values) },
          ],
        }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }

      if (!res.body) throw new Error('No response body received')
      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer    = ''

      while (true) {
        const { done: readerDone, value } = await reader.read()
        if (readerDone) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data: ')) continue
          const token = trimmed.slice(6)
          if (token === '[DONE]') {
            setDone(true)
            setStreaming(false)
            return
          }
          setOutput(prev => prev + token)
        }
      }

      setDone(true)
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setStreaming(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    runStream()
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(output)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const mdComponents = {
    h1: ({ children }: { children?: React.ReactNode }) => (
      <h1 className="text-xl font-bold mt-4 mb-2 text-gray-100">{children}</h1>
    ),
    h2: ({ children }: { children?: React.ReactNode }) => (
      <h2 className="text-lg font-bold mt-4 mb-2 text-gray-100">{children}</h2>
    ),
    h3: ({ children }: { children?: React.ReactNode }) => (
      <h3 className="text-base font-semibold mt-3 mb-1 text-gray-100">{children}</h3>
    ),
    p: ({ children }: { children?: React.ReactNode }) => (
      <p className="mb-3 last:mb-0 text-gray-100 leading-relaxed">{children}</p>
    ),
    ul: ({ children }: { children?: React.ReactNode }) => (
      <ul className="list-disc list-inside mb-3 space-y-1 text-gray-100">{children}</ul>
    ),
    ol: ({ children }: { children?: React.ReactNode }) => (
      <ol className="list-decimal list-inside mb-3 space-y-1 text-gray-100">{children}</ol>
    ),
    li: ({ children }: { children?: React.ReactNode }) => (
      <li className="text-gray-200">{children}</li>
    ),
    code: ({ inline, children }: { inline?: boolean; children?: React.ReactNode }) =>
      inline ? (
        <code className="bg-gray-800 text-gray-200 px-1.5 py-0.5 rounded text-xs font-mono">
          {children}
        </code>
      ) : (
        <code className="block bg-gray-800 text-gray-200 p-4 rounded-lg text-xs font-mono overflow-x-auto mb-3">
          {children}
        </code>
      ),
    pre: ({ children }: { children?: React.ReactNode }) => (
      <pre className="mb-3">{children}</pre>
    ),
    a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={`${accentText} hover:underline`}
      >
        {children}
      </a>
    ),
    hr: () => <hr className="border-gray-700 my-4" />,
    strong: ({ children }: { children?: React.ReactNode }) => (
      <strong className="font-semibold text-gray-100">{children}</strong>
    ),
    em: ({ children }: { children?: React.ReactNode }) => (
      <em className="italic text-gray-200">{children}</em>
    ),
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      <header className="border-b border-gray-800 px-6 py-8 text-center">
        <h1 className={`text-3xl font-bold mb-2 ${accentText}`}>{config.name}</h1>
        <p className="text-gray-400 text-sm max-w-md mx-auto">{config.tagline}</p>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-8">
        <form onSubmit={handleSubmit} className="space-y-5">
          {config.inputs.map(field => (
            <div key={field.id}>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                {field.label}
              </label>

              {field.type === 'textarea' && (
                <textarea
                  rows={4}
                  placeholder={field.placeholder}
                  value={values[field.id] ?? ''}
                  onChange={e => setValues(v => ({ ...v, [field.id]: e.target.value }))}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-0 resize-none"
                />
              )}

              {field.type === 'text' && (
                <input
                  type="text"
                  placeholder={field.placeholder}
                  value={values[field.id] ?? ''}
                  onChange={e => setValues(v => ({ ...v, [field.id]: e.target.value }))}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-0"
                />
              )}

              {field.type === 'select' && (
                <select
                  value={values[field.id] ?? ''}
                  onChange={e => setValues(v => ({ ...v, [field.id]: e.target.value }))}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-0"
                >
                  <option value="">Select…</option>
                  {field.options.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              )}
            </div>
          ))}

          <button
            type="submit"
            disabled={streaming || !hasInput}
            className={`w-full ${accent} disabled:opacity-50 text-white font-semibold py-3 rounded-lg text-sm transition-colors`}
          >
            {streaming ? 'Generating…' : 'Generate'}
          </button>
        </form>

        {error && (
          <div className="mt-6 p-4 bg-red-950 border border-red-800 rounded-lg text-red-300 text-sm">
            {error}
          </div>
        )}

        {(output || streaming) && (
          <div className="mt-6">
            <h2 className="text-sm font-medium text-gray-400 mb-3">{config.outputLabel}</h2>
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-5 text-sm min-h-[80px]">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={mdComponents}
              >
                {streaming ? output + '▍' : output}
              </ReactMarkdown>
            </div>

            {done && (
              <div className="flex gap-3 mt-3">
                <button
                  onClick={handleCopy}
                  className={`px-4 py-2 rounded-lg text-xs font-medium border transition-colors ${accentBorder}`}
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
                <button
                  onClick={runStream}
                  className="px-4 py-2 rounded-lg text-xs font-medium border border-gray-600 text-gray-400 hover:bg-gray-800 transition-colors"
                >
                  Regenerate
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="border-t border-gray-800 px-6 py-6 text-center">
        <p className="text-gray-600 text-xs">
          Built by{' '}
          <a
            href="https://sateesh-ganaparapu.netlify.app"
            target="_blank"
            rel="noopener noreferrer"
            className={`${accentText} hover:underline`}
          >
            Sateesh Gana
          </a>
          {' · '}
          <a
            href="https://sateesh-ganaparapu.netlify.app"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-500 hover:text-gray-300"
          >
            View Portfolio
          </a>
        </p>
      </footer>
    </div>
  )
}
