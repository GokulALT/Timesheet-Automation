import { useState } from 'react'

export default function LoginPage({ onLogin }) {
  const [checking, setChecking] = useState(false)
  const [error,    setError]    = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    const f = e.currentTarget
    const creds = { kimaiUser: f.username.value.trim(), kimaiToken: f.token.value.trim() }

    // Verify against the myTime API now, so a wrong password surfaces here
    // instead of as every entry failing at the final step.
    setChecking(true)
    setError('')
    try {
      const r    = await fetch('/api/auth/verify', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(creds),
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok || !data.success) {
        setError(data.error || `Verification failed (${r.status}).`)
        return
      }
      onLogin(creds)
    } catch {
      setError('Could not reach the backend. Is it running on port 3001?')
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-indigo-600 mb-4 shadow-lg">
            <svg className="h-7 w-7 text-white" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">AI Task Scheduler</h1>
          <p className="mt-1 text-slate-400 text-sm">Sign in with your myTime API credentials</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-slate-700 mb-1.5">
                Username
              </label>
              <input
                id="username" name="username" type="email" required autoComplete="username"
                placeholder="you@example.com"
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-slate-900 text-sm
                           placeholder:text-slate-400 shadow-sm
                           focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
              />
            </div>

            <div>
              <label htmlFor="token" className="block text-sm font-medium text-slate-700 mb-1.5">
                API Password
              </label>
              <input
                id="token" name="token" type="password" required autoComplete="current-password"
                placeholder="Your myTime API password"
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-slate-900 text-sm
                           placeholder:text-slate-400 shadow-sm
                           focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
              />
              <div className="mt-2.5 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2.5 text-xs text-slate-500 leading-relaxed">
                <p className="font-semibold text-slate-600 mb-1.5">How to set your API password</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Log in to <span className="font-medium text-slate-700">myTime</span> at timesheet.lntedutech.com</li>
                  <li>Click your name in the top-right → <span className="font-medium text-slate-700">My profile</span></li>
                  <li>Scroll to the <span className="font-medium text-slate-700">API access</span> section</li>
                  <li>Enter and confirm a new <span className="font-medium text-slate-700">API password</span>, then save</li>
                  <li>Use that same password here</li>
                </ol>
                <p className="mt-1.5 text-slate-400">API endpoint: timesheet.lntedutech.com/api</p>
              </div>
            </div>

            {error && (
              <div role="alert" className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={checking}
              className="w-full rounded-xl bg-indigo-600 px-6 py-3 text-white font-semibold text-sm shadow-sm
                         hover:bg-indigo-700 active:bg-indigo-800 transition mt-2
                         disabled:opacity-60 disabled:cursor-wait"
            >
              {checking ? 'Verifying with myTime…' : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center mt-6 text-xs text-slate-500">
          Credentials are stored locally in your browser only.
        </p>
      </div>
    </div>
  )
}
