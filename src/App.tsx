import { useState } from 'react'
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

function buildUserMessage(fields: InputField[], values: Record<string, string>): string {
  return fields
    .filter(f => (values[f.id] ?? '').trim().length > 0)
    .map(f => `${f.label}:\n${values[f.id]}`)
    .join('\n\n')
}

export default function App() {
  const [values, setValues] = useState<Record<string, string>>({})
  const [output, setOutput]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const accent     = ACCENT[config.accentColor]
  const accentText = ACCENT_TEXT[config.accentColor]

  const hasInput = config.inputs.some(f => (values[f.id] ?? '').trim().length > 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setOutput('')

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'user', content: buildUserMessage(config.inputs, values) },
          ],
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }

      const data = await res.json()
      setOutput(data.content)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
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
            disabled={loading || !hasInput}
            className={`w-full ${accent} disabled:opacity-50 text-white font-semibold py-3 rounded-lg text-sm transition-colors`}
          >
            {loading ? 'Generating…' : 'Generate'}
          </button>
        </form>

        {error && (
          <div className="mt-6 p-4 bg-red-950 border border-red-800 rounded-lg text-red-300 text-sm">
            {error}
          </div>
        )}

        {output && (
          <div className="mt-6">
            <h2 className="text-sm font-medium text-gray-400 mb-3">{config.outputLabel}</h2>
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-5 text-sm text-gray-100 whitespace-pre-wrap leading-relaxed">
              {output}
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-gray-800 px-6 py-6 text-center">
        <p className="text-gray-600 text-xs">
          Built by{' '}
          <a href="https://sateesh-ganaparapu.netlify.app" target="_blank" rel="noopener noreferrer" className={`${accentText} hover:underline`}>
            Sateesh Gana
          </a>
          {' · '}
          <a href="https://sateesh-ganaparapu.netlify.app" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-300">
            View Portfolio
          </a>
        </p>
      </footer>
    </div>
  )
}
