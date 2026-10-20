import { useState, useEffect, useCallback, useRef } from 'react'
import LoginPage from './components/LoginPage.jsx'
import Header from './components/Header.jsx'
import StepConfigure from './components/StepConfigure.jsx'
import StepSchedule from './components/StepSchedule.jsx'
import StepReview from './components/StepReview.jsx'

const CREDS_KEY  = 'kimai_creds'
const AI_CFG_KEY = 'ai_provider_config'
const AI_DEFAULT = { provider: 'nvidia', apiKey: '', model: '', baseUrl: '' }

const STEPS = [
  { id: 'configure', label: 'Configure AI' },
  { id: 'schedule',  label: 'Plan Schedule' },
  { id: 'review',    label: 'Review & Fill' },
]

const POLL_ACTIVE_MS = 2000
const POLL_IDLE_MS   = 6000

const AI_PHASES = [
  { from:   0, msg: 'Sending request to AI…' },
  { from:  15, msg: 'AI is reading your task description…' },
  { from:  40, msg: 'AI is planning the schedule…' },
  { from:  80, msg: 'Still working — large models can take 2–3 min…' },
  { from: 150, msg: 'Almost there, waiting for the final response…' },
]

export default function App() {
  // ── Auth & config ──────────────────────────────────────────────────────────
  const [credentials, setCredentials] = useState(() => {
    try { return JSON.parse(localStorage.getItem(CREDS_KEY)) || null } catch { return null }
  })
  const [aiConfig, setAiConfig] = useState(() => {
    try { return JSON.parse(localStorage.getItem(AI_CFG_KEY)) || AI_DEFAULT } catch { return AI_DEFAULT }
  })

  // ── Step flow ──────────────────────────────────────────────────────────────
  const [step, setStep] = useState('configure')

  // ── Schedule generation ────────────────────────────────────────────────────
  const [loading, setLoading]             = useState(false)
  const [loadingSeconds, setLoadingSeconds] = useState(0)
  const loadingTimerRef                   = useRef(null)
  const [genError, setGenError]           = useState(null)
  const [schedule, setSchedule]           = useState(null)

  // ── Automation ─────────────────────────────────────────────────────────────
  const [status, setStatus]         = useState(null)
  const [startingMode, setStartingMode] = useState(null)
  const [stopping, setStopping]     = useState(false)
  const [saving, setSaving]         = useState(false)
  const [savedInfo, setSavedInfo]   = useState(null)
  const [fillError, setFillError]   = useState(null)

  // ── Status polling ─────────────────────────────────────────────────────────
  const fetchStatus = useCallback(async () => {
    try {
      const r = await fetch('/api/automation/status')
      const d = await r.json()
      setStatus(d)
      return d
    } catch { return null }
  }, [])

  useEffect(() => { fetchStatus() }, [fetchStatus])

  const isActive = !!status && (status.state === 'running' || status.state === 'starting')

  useEffect(() => {
    const id = setInterval(fetchStatus, isActive ? POLL_ACTIVE_MS : POLL_IDLE_MS)
    return () => clearInterval(id)
  }, [isActive, fetchStatus])

  // ── Handlers ───────────────────────────────────────────────────────────────
  function handleLogin(creds) {
    localStorage.setItem(CREDS_KEY, JSON.stringify(creds))
    setCredentials(creds)
    setStep('configure')
  }

  function handleLogout() {
    localStorage.removeItem(CREDS_KEY)
    setCredentials(null)
  }

  function handleSaveAIConfig(cfg) {
    localStorage.setItem(AI_CFG_KEY, JSON.stringify(cfg))
    setAiConfig(cfg)
  }

  async function handleGenerate({ startDate, daysRequired, tasks, holidays }) {
    setLoading(true)
    setLoadingSeconds(0)
    setGenError(null)
    setSchedule(null)
    setSavedInfo(null)

    loadingTimerRef.current = setInterval(() => setLoadingSeconds(s => s + 1), 1000)

    try {
      const r = await fetch('/api/schedule', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ startDate, daysRequired, taskSummary: tasks, holidays, aiProvider: aiConfig }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || d.message || `Server error: ${r.status}`)
      setSchedule(d.schedule ?? d)
      setStep('review')
    } catch (err) {
      setGenError(err.message || 'Something went wrong. Please try again.')
    } finally {
      clearInterval(loadingTimerRef.current)
      setLoading(false)
    }
  }

  async function handleSaveSchedule() {
    setSaving(true)
    setFillError(null)
    setSavedInfo(null)
    try {
      const r = await fetch('/api/schedule/save', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ schedule }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Could not save.')
      setSavedInfo({ days: d.days, entries: d.entries })
    } catch (err) {
      setFillError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleFill() {
    setStartingMode('api')
    setFillError(null)
    setSavedInfo(null)
    try {
      const r = await fetch('/api/automate-kimai', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ schedule, ...credentials }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Automation failed to start.')
      setStatus({ state: 'starting', startedAt: new Date().toISOString(), total: d.entries ?? 0, created: 0, failed: 0, failures: [] })
      fetchStatus()
    } catch (err) {
      setFillError(err.message)
    } finally {
      setStartingMode(null)
    }
  }

  async function handleStop() {
    setStopping(true)
    try {
      const r = await fetch('/api/automation/stop', { method: 'POST' })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Could not stop.')
      await fetchStatus()
    } catch (err) {
      setFillError(err.message)
    } finally {
      setStopping(false)
    }
  }

  // ── AI loading phase message ───────────────────────────────────────────────
  const aiPhase = [...AI_PHASES].reverse().find(p => loadingSeconds >= p.from)
  const loadingMM = String(Math.floor(loadingSeconds / 60)).padStart(2, '0')
  const loadingSS = String(loadingSeconds % 60).padStart(2, '0')

  // ── Render ─────────────────────────────────────────────────────────────────
  if (!credentials) return <LoginPage onLogin={handleLogin} />

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header
        user={credentials.kimaiUser}
        aiProvider={aiConfig.provider || 'nvidia'}
        onLogout={handleLogout}
      />

      {/* Step tabs */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4">
          <nav className="flex gap-1" aria-label="Steps">
            {STEPS.map((s, i) => {
              const isActive = step === s.id
              const isReachable = s.id !== 'review' || !!schedule
              return (
                <button
                  key={s.id}
                  onClick={() => isReachable && setStep(s.id)}
                  disabled={!isReachable}
                  className={`relative flex items-center gap-2 px-5 py-4 text-sm font-medium transition
                    ${isActive
                      ? 'text-indigo-600 after:absolute after:bottom-0 after:inset-x-0 after:h-0.5 after:bg-indigo-600'
                      : isReachable
                        ? 'text-slate-500 hover:text-slate-700'
                        : 'text-slate-300 cursor-not-allowed'}`}
                >
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold
                    ${isActive ? 'bg-indigo-600 text-white' : isReachable ? 'bg-slate-200 text-slate-600' : 'bg-slate-100 text-slate-400'}`}>
                    {i + 1}
                  </span>
                  {s.label}
                </button>
              )
            })}
          </nav>
        </div>
      </div>

      {/* Step content */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
        {step === 'configure' && (
          <StepConfigure
            config={aiConfig}
            onSave={cfg => { handleSaveAIConfig(cfg); setStep('schedule') }}
          />
        )}

        {step === 'schedule' && (
          <StepSchedule
            loading={loading}
            loadingMsg={loading ? `${aiPhase?.msg} (${loadingMM}:${loadingSS})` : null}
            error={genError}
            onSubmit={handleGenerate}
            onBack={() => setStep('configure')}
          />
        )}

        {step === 'review' && schedule && (
          <StepReview
            schedule={schedule}
            status={status}
            isActive={isActive}
            startingMode={startingMode}
            stopping={stopping}
            saving={saving}
            savedInfo={savedInfo}
            error={fillError}
            onFill={handleFill}
            onSave={handleSaveSchedule}
            onStop={handleStop}
            onRegenerate={() => setStep('schedule')}
          />
        )}
      </main>
    </div>
  )
}
