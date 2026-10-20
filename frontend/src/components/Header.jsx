export default function Header({ user, aiProvider, onLogout }) {
  return (
    <header className="bg-slate-900 px-4 py-3 shadow-md">
      <div className="max-w-5xl mx-auto flex items-center justify-between">

        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
            <svg className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
            </svg>
          </div>
          <span className="text-white font-semibold text-sm tracking-tight">AI Task Scheduler</span>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <span className="hidden sm:flex items-center gap-1.5 rounded-full bg-slate-800 border border-slate-700 px-3 py-1 text-xs font-medium text-slate-300">
            <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
            {aiProvider}
          </span>
          <span className="hidden md:block text-sm text-slate-400 truncate max-w-[180px]">{user}</span>
          <button
            onClick={onLogout}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300
                       hover:bg-slate-800 hover:text-white transition"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  )
}
