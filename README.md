# AI Task Scheduler & Timesheet Automation

Describe a sprint in plain English → get a day-by-day, hour-allocated plan → one click fills every entry into the myTime portal.

---

## How it works

```
InputForm → /api/schedule → Ollama (LLM) → ScheduleResults → /api/automate-kimai → myTime API
```

1. You describe a sprint (start date, days, tasks, holidays).
2. A local Ollama model turns it into a schedule: 8 hours/day, lunch-split entries included.
3. You review the plan in the browser UI.
4. **Fill Timesheet (API)** posts every entry directly to the myTime Kimai API (~0.5 s/entry).
5. **Browser** (fallback) launches a Playwright run that fills the portal visually (~14 s/entry).

---

## Prerequisites

| Dependency | Version | Notes |
|---|---|---|
| Node.js | 18 + | Each package has its own `node_modules` |
| Ollama | latest | Must be running locally for schedule generation |
| Chromium | via Playwright | Only needed for the browser-fill fallback |

---

## Setup

```bash
# 1. Install all dependencies
npm install && npm run install:all

# 2. Install Playwright's Chromium (fallback only)
cd playwright && npx playwright install chromium && cd ..

# 3. Pull an Ollama model
ollama pull llama3        # fast local model (may need normalisation)
# or
ollama pull nemotron-3-ultra:cloud  # higher quality, slower (~2–3 min)
```

### Environment file — `backend/.env`

Copy `backend/.env.example` and fill in the required values:

```
# ── Server ──────────────────────────────
PORT=3001                        # optional  (default: 3001)

# ── AI schedule generation ──────────────
NVIDIA_API_KEY=nvapi-...         # REQUIRED  — get from build.nvidia.com
AI_MODEL=z-ai/glm-5.3-flash     # optional  (default: z-ai/glm-5.3-flash)

# ── Kimai / myTime API ──────────────────
# These are fallbacks only; credentials entered in the UI take precedence.
# KIMAI_BASE_URL=https://timesheet.lntedutech.com/api   # optional
# KIMAI_USER=you@lntedutech.com                         # optional
# KIMAI_TOKEN=your-api-password                         # optional

# ── Legacy Ollama (unused by default) ───
# OLLAMA_MODEL=llama3
# OLLAMA_HOST=http://127.0.0.1:11434
```

---

## Running

```bash
# Start Ollama in a separate terminal
ollama serve

# Start backend (port 3001) + frontend (port 5173)
npm run dev
```

Open **http://localhost:5173** in your browser.

### Individual servers

```bash
npm run dev --prefix backend     # nodemon (auto-restart)
npm run start --prefix backend   # plain node
npm run dev --prefix frontend
```

---

## myTime API credentials

The **API Password** is separate from your portal login password. To set one:

1. Log in to [timesheet.lntedutech.com](https://timesheet.lntedutech.com)
2. Click your name (top-right) → **My profile**
3. Scroll to **API access**
4. Enter and confirm a new API password, then save
5. Use that password as the **API Password** on the login screen

API endpoint: `https://timesheet.lntedutech.com/api`

---

## Playwright fallback

Use the **Browser** button in the UI, or run directly from `/playwright`:

```bash
# Full schedule from schedule.json
npx playwright test --grep "populate timesheet from schedule file"

# Interactive UI
npm run test:ui

# Last HTML report
npm run report

# Audit portal DOM (non-destructive — never clicks Save)
npx playwright test --grep "audit portal DOM"
```

Progress is written to `playwright/automation-status.json` and polled by the frontend every 2 s.

---

## Working-day rules

- Sundays are always skipped.
- The **2nd and 4th Saturday** of each calendar month are skipped.
- 1st, 3rd (and 5th) Saturdays are working days.
- Dates are handled in local time — no UTC conversion.

## Time-slot rules

The day runs **09:00–18:00** with an unlogged lunch break at **13:00–14:00**.  
A task that crosses lunch is split into two portal rows, the second suffixed `(cont.)`.  
All durations sum to exactly 8 hours per day.

---

## Project layout

```
/backend     Express API, port 3001  (CommonJS)
/frontend    React + Vite + Tailwind, port 5173  (ESM)
/playwright  Playwright POM + specs  (CommonJS)
```

Root `package.json` only holds `concurrently` and the fan-out scripts.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `HeadersTimeoutError` during schedule generation | Ollama proxy buffering (`:cloud` models withhold headers until done) | Expected — the client has `headersTimeout: 0`; wait it out |
| `UND_ERR_HEADERS_TIMEOUT` anyway | `headersTimeout` not applied | Ensure `ollamaService.js` uses the undici dispatcher, not Node's global fetch |
| `"A project needs to be selected."` in Playwright | TomSelect rebuild race | `waitForOptionsToReload()` already handles this — check for portal DOM changes |
| Backend returns 404 on `localhost:3001` | Stale process bound to IPv4 | Server binds `127.0.0.1` deliberately; kill the old process |
| SSL error calling myTime API | Self-signed CA chain | `kimaiService.js` uses `rejectUnauthorized: false` scoped to that dispatcher |
