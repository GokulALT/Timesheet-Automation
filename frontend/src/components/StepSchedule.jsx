export default function StepSchedule({ loading, loadingMsg, error, onSubmit, onBack }) {
  function handleSubmit(e) {
    e.preventDefault()
    const f = e.currentTarget
    const holidays = f.holidays.value
      .split('\n').map(d => d.trim()).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
    onSubmit({
      startDate:    f.startDate.value,
      daysRequired: Number(f.daysRequired.value),
      tasks:        f.tasks.value,
      holidays,
    })
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-900">Plan your schedule</h2>
        <p className="mt-1 text-sm text-slate-500">
          Describe your sprint in plain language — AI will distribute tasks across working days.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">

          {/* Date + Days row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="startDate" className="block text-sm font-medium text-slate-700 mb-1.5">
                Start Date
              </label>
              <input
                id="startDate" name="startDate" type="date" required
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-slate-900 text-sm
                           focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
              />
            </div>
            <div>
              <label htmlFor="daysRequired" className="block text-sm font-medium text-slate-700 mb-1.5">
                Working Days
              </label>
              <input
                id="daysRequired" name="daysRequired" type="number" min="1" max="60" required
                placeholder="e.g. 10"
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-slate-900 text-sm
                           placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
              />
            </div>
          </div>

          {/* Task summary */}
          <div>
            <label htmlFor="tasks" className="block text-sm font-medium text-slate-700 mb-1.5">
              Task Description
            </label>
            <textarea
              id="tasks" name="tasks" rows={7} required
              placeholder="Describe your sprint or project work in plain language. For example: design the login page, set up the database schema, build the REST API, write unit tests, do a security review, and deploy to staging."
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-slate-900 text-sm
                         placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500
                         transition resize-y leading-relaxed"
            />
          </div>

          {/* Holidays */}
          <div>
            <label htmlFor="holidays" className="block text-sm font-medium text-slate-700 mb-1.5">
              Leave / Holiday Days
              <span className="ml-1 font-normal text-slate-400">— one YYYY-MM-DD per line, optional</span>
            </label>
            <textarea
              id="holidays" name="holidays" rows={3}
              placeholder={"2025-12-25\n2025-12-26"}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-slate-900 text-sm
                         placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400
                         transition resize-y font-mono"
            />
          </div>
        </div>

        {/* AI loading banner */}
        {loading && (
          <div className="flex items-center gap-4 rounded-xl border border-indigo-200 bg-indigo-50 px-5 py-4">
            <svg className="h-5 w-5 flex-shrink-0 animate-spin text-indigo-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            <p className="text-sm font-medium text-indigo-700">{loadingMsg}</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-5 py-4">
            <svg className="h-5 w-5 flex-shrink-0 mt-0.5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-.75-4.75a.75.75 0 001.5 0v-4.5a.75.75 0 00-1.5 0v4.5zm.75-7a.75.75 0 100 1.5.75.75 0 000-1.5z" clipRule="evenodd" />
            </svg>
            <p className="text-sm font-medium text-red-700">{error}</p>
          </div>
        )}

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 transition"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
            Change AI provider
          </button>

          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-7 py-3 text-sm font-semibold text-white
                       shadow-sm hover:bg-indigo-700 active:bg-indigo-800
                       disabled:cursor-not-allowed disabled:opacity-60 transition"
          >
            {loading ? (
              <>
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                Generating…
              </>
            ) : (
              <>
                Generate Schedule
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
