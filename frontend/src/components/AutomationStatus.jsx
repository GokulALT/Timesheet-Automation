function formatDuration(startedAt, finishedAt) {
  if (!startedAt) return null
  const end = finishedAt ? new Date(finishedAt) : new Date()
  const secs = Math.max(0, Math.round((end - new Date(startedAt)) / 1000))
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function ProgressBar({ created, failed, total }) {
  const done = created + failed
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  return (
    <div className="mt-3">
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
        <div
          className="h-full rounded-full bg-indigo-600 transition-all duration-500"
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={done}
          aria-valuemin={0}
          aria-valuemax={total}
        />
      </div>
      <p className="mt-1.5 text-xs text-gray-500">{done} of {total} entries &middot; {pct}%</p>
    </div>
  )
}

function Stat({ value, label, tone }) {
  const tones = {
    green: 'text-green-700',
    red: 'text-red-700',
    gray: 'text-gray-700',
  }
  return (
    <div>
      <p className={`text-2xl font-bold ${tones[tone] || tones.gray}`}>{value}</p>
      <p className="text-xs font-medium text-gray-500">{label}</p>
    </div>
  )
}

function FailureList({ failures }) {
  if (!failures || failures.length === 0) return null
  return (
    <div className="mt-4 border-t border-gray-200 pt-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-red-700">
        Failed entries
      </p>
      <ul className="space-y-2">
        {failures.map((f, i) => (
          <li key={i} className="rounded-lg bg-red-50 px-3 py-2">
            <p className="font-mono text-xs font-semibold text-red-800">
              {f.date} &nbsp; {f.beginTime}&ndash;{f.endTime}
            </p>
            <p className="mt-0.5 text-xs leading-snug text-red-700">{f.error}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function AutomationStatus({ status, onStop, stopping }) {
  if (!status || status.state === 'idle') return null

  const { state, created = 0, failed = 0, total = 0, current, failures, startedAt, finishedAt, error } = status
  const inFlight = state === 'starting' || state === 'running'

  const header = {
    starting:  { text: 'Starting automation\u2026', bg: 'bg-indigo-600' },
    running:   { text: 'Filling timesheet\u2026',    bg: 'bg-indigo-600' },
    completed: { text: failed > 0 ? 'Completed with errors' : 'Automation complete', bg: failed > 0 ? 'bg-amber-500' : 'bg-green-600' },
    stopped:   { text: 'Automation stopped',       bg: 'bg-gray-600' },
    crashed:   { text: 'Automation failed',        bg: 'bg-red-600' },
  }[state] || { text: state, bg: 'bg-gray-600' }

  return (
    <div className="mt-6 overflow-hidden rounded-2xl bg-white shadow-md">
      <div className={`flex items-center justify-between px-5 py-3 ${header.bg}`}>
        <div className="flex items-center gap-2">
          {inFlight && (
            <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
          )}
          <p className="text-sm font-semibold text-white">{header.text}</p>
        </div>

        <div className="flex items-center gap-3">
          {startedAt && (
            <span className="text-xs font-medium text-white/80">
              {formatDuration(startedAt, finishedAt)}
            </span>
          )}
          {inFlight && onStop && (
            <button
              onClick={onStop}
              disabled={stopping}
              className="rounded-md bg-white/15 px-2.5 py-1 text-xs font-semibold text-white
                         hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {stopping ? 'Stopping\u2026' : 'Stop'}
            </button>
          )}
        </div>
      </div>

      <div className="px-5 py-4">
        {inFlight ? (
          <>
            <p className="text-sm text-gray-600">
              {current
                ? <>Currently filling <span className="font-mono font-medium text-gray-800">{current.date} {current.beginTime}&ndash;{current.endTime}</span></>
                : 'Starting\u2026'}
            </p>
            {total > 0 && <ProgressBar created={created} failed={failed} total={total} />}
            {failed > 0 && (
              <p className="mt-2 text-xs font-medium text-red-700">{failed} failed so far</p>
            )}
          </>
        ) : (
          <>
            <div className="flex gap-8">
              <Stat value={created} label="created" tone="green" />
              <Stat value={failed} label="failed" tone={failed > 0 ? 'red' : 'gray'} />
              <Stat value={total} label="planned" tone="gray" />
            </div>
            {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
            {state === 'stopped' && (
              <p className="mt-3 text-sm text-gray-600">
                Stopped before finishing. Re-running will recreate every entry, including those already filed.
              </p>
            )}
            <FailureList failures={failures} />
          </>
        )}
      </div>
    </div>
  )
}
