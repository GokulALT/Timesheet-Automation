import AutomationStatus from './AutomationStatus.jsx'

function formatDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  })
}

const ACTIVITY_COLORS = {
  delivery: 'bg-violet-100 text-violet-700',
  product:  'bg-indigo-100 text-indigo-700',
}

function DayCard({ date, type, entries, adjusted }) {
  const total = entries.reduce((s, e) => s + (e.duration || 0), 0)
  const isLeave = type === 'leave'

  return (
    <div className={`rounded-2xl border overflow-hidden flex flex-col
      ${isLeave ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white shadow-sm'}`}>

      {/* Card header */}
      <div className={`px-4 py-3 flex items-center justify-between
        ${isLeave ? 'bg-amber-100 border-b border-amber-200' : 'bg-slate-50 border-b border-slate-200'}`}>
        <div>
          <p className={`text-xs font-semibold uppercase tracking-wide ${isLeave ? 'text-amber-600' : 'text-slate-500'}`}>
            {isLeave ? 'Leave / Holiday' : formatDate(date)}
          </p>
          {!isLeave && <p className="text-xs text-slate-400 font-mono mt-0.5">{date}</p>}
        </div>
        <div className="flex items-center gap-2">
          {adjusted && (
            <span className="rounded-full bg-amber-400 text-amber-900 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5">
              Adjusted
            </span>
          )}
          <span className={`text-xs font-bold ${isLeave ? 'text-amber-600' : 'text-slate-600'}`}>
            {total}h
          </span>
        </div>
      </div>

      {adjusted && (
        <div className="flex items-start gap-1.5 bg-amber-50 border-b border-amber-100 px-4 py-2">
          <svg className="h-3 w-3 flex-shrink-0 text-amber-500 mt-px" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
          <span className="text-[10px] text-amber-700">
            {adjusted.action === 'trimmed' && `AI planned ${adjusted.from}h — trimmed to ${adjusted.to}h`}
            {adjusted.action === 'padded'  && `AI planned ${adjusted.from}h — padded to ${adjusted.to}h`}
            {adjusted.action === 'generated' && 'AI skipped this day — filled with a placeholder'}
          </span>
        </div>
      )}

      <ul className="flex-1 px-4 py-3 space-y-2">
        {entries.map((entry, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className={`mt-1 flex-shrink-0 rounded text-[9px] font-bold uppercase px-1.5 py-0.5
              ${isLeave ? 'bg-amber-200 text-amber-700' : (ACTIVITY_COLORS[entry.activity] || ACTIVITY_COLORS.product)}`}>
              {isLeave ? 'leave' : (entry.activity || 'product')}
            </span>
            <span className="flex-1 text-xs text-slate-700 leading-snug">{entry.task}</span>
            <span className="flex-shrink-0 text-xs font-semibold text-slate-400">{entry.duration}h</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function StepReview({
  schedule, status, isActive, startingMode, stopping, saving, savedInfo, error,
  onFill, onSave, onStop, onRegenerate,
}) {
  const workDays     = schedule.filter(d => d.type === 'work').length
  const leaveDays    = schedule.filter(d => d.type === 'leave').length
  const adjustedDays = schedule.filter(d => d.adjusted).length
  const totalEntries = schedule.reduce((n, d) => n + (d.entries?.length || 0), 0)

  return (
    <div>
      {/* Summary bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Your Generated Schedule</h2>
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="rounded-full bg-indigo-100 text-indigo-700 text-xs font-medium px-3 py-1">
              {workDays} work day{workDays !== 1 ? 's' : ''}
            </span>
            {leaveDays > 0 && (
              <span className="rounded-full bg-amber-100 text-amber-700 text-xs font-medium px-3 py-1">
                {leaveDays} leave day{leaveDays !== 1 ? 's' : ''}
              </span>
            )}
            <span className="rounded-full bg-slate-100 text-slate-600 text-xs font-medium px-3 py-1">
              {totalEntries} tasks
            </span>
            {adjustedDays > 0 && (
              <span className="rounded-full bg-amber-400 text-white text-xs font-medium px-3 py-1">
                {adjustedDays} day{adjustedDays !== 1 ? 's' : ''} adjusted
              </span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={onRegenerate}
              disabled={isActive}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-600
                         hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Regenerate
            </button>
            <button
              onClick={onSave}
              disabled={saving || isActive}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-600
                         hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {saving ? 'Saving…' : 'Save JSON'}
            </button>
            <button
              onClick={onFill}
              disabled={!!startingMode || isActive}
              className="flex items-center gap-2 rounded-xl bg-green-600 px-5 py-2.5 text-sm font-semibold text-white
                         shadow-sm hover:bg-green-700 active:bg-green-800
                         disabled:cursor-not-allowed disabled:opacity-60 transition"
            >
              {(startingMode === 'api' || isActive) ? (
                <>
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  {isActive ? 'Running…' : 'Starting…'}
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                  </svg>
                  Fill Timesheet
                </>
              )}
            </button>
          </div>
          {savedInfo && (
            <p className="text-xs text-slate-500">
              Saved — {savedInfo.days} days, {savedInfo.entries} entries
            </p>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-5 py-4">
          <svg className="h-5 w-5 flex-shrink-0 mt-0.5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-.75-4.75a.75.75 0 001.5 0v-4.5a.75.75 0 00-1.5 0v4.5zm.75-7a.75.75 0 100 1.5.75.75 0 000-1.5z" clipRule="evenodd" />
          </svg>
          <p className="text-sm font-medium text-red-700">{error}</p>
        </div>
      )}

      <AutomationStatus status={status} onStop={onStop} stopping={stopping} />

      {/* Day cards grid */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {schedule.map(day => (
          <DayCard
            key={day.date}
            date={day.date}
            type={day.type}
            entries={day.entries ?? []}
            adjusted={day.adjusted}
          />
        ))}
      </div>
    </div>
  )
}
