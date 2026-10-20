import { useState } from 'react'

const PROVIDERS = [
  {
    id: 'nvidia', label: 'NVIDIA NIM', icon: '⚡',
    description: 'Fast cloud inference via NVIDIA API',
    defaultModel: 'z-ai/glm-5.3-flash', needsKey: true, baseUrlEditable: false,
  },
  {
    id: 'openai', label: 'OpenAI', icon: '🤖',
    description: 'GPT-4o, GPT-4o-mini and other OpenAI models',
    defaultModel: 'gpt-4o-mini', needsKey: true, baseUrlEditable: false,
  },
  {
    id: 'anthropic', label: 'Anthropic', icon: '🧠',
    description: 'Claude models — fast and highly capable',
    defaultModel: 'claude-haiku-5-5', needsKey: true, baseUrlEditable: false,
  },
  {
    id: 'groq', label: 'Groq', icon: '🚀',
    description: 'Ultra-fast inference with open models',
    defaultModel: 'llama-3.1-8b-instant', needsKey: true, baseUrlEditable: false,
  },
  {
    id: 'lmstudio', label: 'LM Studio', icon: '🖥',
    description: 'Local model via LM Studio (localhost:1234)',
    defaultModel: '', needsKey: false, baseUrlEditable: true,
  },
  {
    id: 'ollama', label: 'Ollama', icon: '🦙',
    description: 'Local model via Ollama (localhost:11434)',
    defaultModel: 'llama3', needsKey: false, baseUrlEditable: true,
  },
]

export default function StepConfigure({ config, onSave }) {
  const [provider, setProvider] = useState(config.provider || 'nvidia')
  const [apiKey,   setApiKey]   = useState(config.apiKey   || '')
  const [model,    setModel]    = useState(config.model    || '')
  const [baseUrl,  setBaseUrl]  = useState(config.baseUrl  || '')

  const meta = PROVIDERS.find(p => p.id === provider) || PROVIDERS[0]

  function handleProviderChange(id) {
    const next = PROVIDERS.find(p => p.id === id)
    setProvider(id)
    setModel('')
    setBaseUrl('')
    if (!next.needsKey) setApiKey('')
  }

  function handleSubmit(e) {
    e.preventDefault()
    onSave({ provider, apiKey: apiKey.trim(), model: model.trim(), baseUrl: baseUrl.trim() })
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-900">Choose your AI provider</h2>
        <p className="mt-1 text-sm text-slate-500">
          Select the model that will plan your schedule. Credentials are stored locally.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Provider grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {PROVIDERS.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => handleProviderChange(p.id)}
              className={`rounded-xl border-2 p-4 text-left transition
                ${provider === p.id
                  ? 'border-indigo-500 bg-indigo-50 shadow-sm'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}`}
            >
              <div className="text-2xl mb-2">{p.icon}</div>
              <div className={`text-sm font-semibold ${provider === p.id ? 'text-indigo-700' : 'text-slate-800'}`}>
                {p.label}
              </div>
              <div className="text-xs text-slate-400 mt-0.5 leading-snug">{p.description}</div>
            </button>
          ))}
        </div>

        {/* Config fields */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h3 className="text-sm font-semibold text-slate-700">{meta.label} settings</h3>

          {meta.needsKey && (
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                required
                placeholder={`Your ${meta.label} API key`}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-slate-900 text-sm
                           placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">
              Model
              <span className="ml-1 font-normal text-slate-400">
                {meta.defaultModel ? `(default: ${meta.defaultModel})` : '(uses loaded model)'}
              </span>
            </label>
            <input
              type="text"
              value={model}
              onChange={e => setModel(e.target.value)}
              placeholder={meta.defaultModel || 'e.g. mistral-7b'}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-slate-900 text-sm
                         placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
            />
          </div>

          {meta.baseUrlEditable && (
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">
                Base URL
                <span className="ml-1 font-normal text-slate-400">
                  {provider === 'lmstudio' ? '(default: http://localhost:1234/v1)' : '(default: http://localhost:11434/v1)'}
                </span>
              </label>
              <input
                type="text"
                value={baseUrl}
                onChange={e => setBaseUrl(e.target.value)}
                placeholder={provider === 'lmstudio' ? 'http://localhost:1234/v1' : 'http://localhost:11434/v1'}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-slate-900 text-sm
                           placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
              />
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white
                       shadow-sm hover:bg-indigo-700 active:bg-indigo-800 transition"
          >
            Save & Continue
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  )
}
