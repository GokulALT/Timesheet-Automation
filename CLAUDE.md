# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Purpose

Two cooperating pieces, not one app:

1. **AI Task Scheduler** — a React + Express app where a user describes a sprint in plain language and a local Ollama model turns it into a day-by-day, hour-allocated plan.
2. **Timesheet automation** — a Playwright run that takes that plan and fills every entry into the myTime portal at `https://timesheet.lntedutech.com`.

The user drives both from the browser UI; there is no CLI path for the normal workflow.

`README.md` is the run guide, `SOP.md` the end-user procedure, `projectInfo.md` the original build spec (historical — its port 3000 and `{date, tasks[]}` response shape are both superseded).

## Layout

```
/backend      Express API, port 3001  (CommonJS)
/frontend     React + Vite + Tailwind, port 5173  (ESM)
/playwright   Playwright POM + specs   (CommonJS)
```

Each has its own `package.json` and `node_modules`; the root `package.json` only holds `concurrently` and the fan-out scripts. This repo is **not** a git repository.

## The handoff chain (the thing to understand first)

Tracing one schedule end to end crosses all three packages:

1. `InputForm.jsx` collects `{ startDate, daysRequired, tasks, holidays[] }` and POSTs to `/api/schedule` (Vite proxies `/api` → `http://127.0.0.1:3001`).
2. `server.js` calls `getWorkingDates()` for the raw calendar, splits it into `taskDates` vs `leaveDates` using the holiday list, sends **only** the task dates to `ollamaService.scheduleWithAI()`, passes the result through `normalizeSchedule()`, synthesizes fixed 8-hour entries for the leave dates, merges, and sorts.
3. `ScheduleResults.jsx` renders work days (indigo) and leave days (amber) for the user to eyeball.
4. Clicking **Start Automation** POSTs the *reviewed* schedule to `/api/automate`, which writes `playwright/schedule.json` and `spawn`s a **detached, stdio-ignored** `npx playwright test --grep "populate timesheet from schedule file"`. The API returns immediately. **Create schedule.json** (`POST /api/schedule/save`) writes the same file without spawning anything, for running Playwright by hand.
5. `createEntry.spec.js` reads `schedule.json` back off disk, logs in once, and creates one portal entry **per task** (not per day).

Because step 4 is fire-and-forget through a file, a failed automation run is re-runnable without regenerating anything — just re-run that grep from `/playwright`.

### Reporting progress back

The spawned process is detached with stdio ignored, so the backend cannot see anything it prints. The run therefore reports through a second file, `playwright/automation-status.json`, written by `playwright/runStatus.js` (temp-file-then-rename, so a reader never sees a half-written document) and served by `GET /api/automation/status`. The frontend polls it — every 2s while a run is active, every 6s otherwise, the slow poll being what lets the UI notice a run started from the CLI rather than the page.

The endpoint merges the file with what the parent process can observe, and that merge is the point: a file still saying `running` after the child exited non-zero means the run died, which the endpoint reports as `crashed` instead of leaving the UI on a progress bar that never moves. `POST /api/automation/stop` tree-kills the run (`taskkill /T` on Windows, since the child is an npx shell that owns Chromium) and flags it so the same merge reports `stopped`.

States: `idle`, `starting`, `running`, `completed`, `stopped`, `crashed`.

**A failing entry no longer aborts the run.** Each entry is wrapped so the failure is recorded and the loop continues; the test still fails at the end if `failures` is non-empty. Without this the summary could only ever say "stopped at entry 3".

### The schedule object

One shape flows through every layer; changing it means touching all four files:

```js
{ date: "YYYY-MM-DD", type: "work" | "leave", entries: [{ task: string, duration: hours }] }
```

- `ollamaService` returns `{ date, entries }`; `server.js` is what stamps on `type`.
- `type` is the only branch in both the renderer and the Playwright spec (it picks the project/activity constants).
- Durations must sum to 8 per day. The prompt asks for this; `normalizeSchedule()` enforces it.
- A day corrected by normalization also carries `adjusted: { action, from, to }`, which the UI renders as an amber banner. Nothing is corrected silently — the user sees it before starting automation.

## Key business logic (must not regress)

**Working days** (`backend/schedulerLogic.js`) — iterate forward from `startDate` until `daysRequired` valid days are collected. Skip every Sunday, and skip the 2nd and 4th Saturday of the calendar month (counted by walking the month from day 1, not by `ceil(date/7)`). 1st/3rd/5th Saturdays are working days. Dates are parsed and formatted component-wise to stay in local time — do not introduce `new Date(isoString)` or `toISOString()` here, both reintroduce the UTC shift this code exists to avoid.

**Time slots** (`calculateTimeslots` in `playwright/pages/TimesheetPage.js`) — the LLM supplies durations only; clock times are derived client-side. The day runs 09:00–18:00 with an unlogged 13:00–14:00 lunch, so 8 hours of work lands exactly on 18:00.

A task whose span would cross lunch is **split into two portal rows** (e.g. a 5-hour task after a 3-hour one becomes 12:00–13:00 and 14:00–18:00), with the second row's description suffixed `(cont.)`. Splitting rather than shifting keeps each row's portal-computed DURATION equal to real work time and leaves no idle gap. Consequence: the `duration` on a returned slot is that *slot's* hours, not the originating entry's — slots for one entry sum back to it. The spec only reads `task`/`beginTime`/`endTime`.

**Schedule normalization** (`backend/normalizeSchedule.js`) — treats model output as advisory. Invented dates are dropped, duplicated dates merged, omitted dates generated as filler, short days padded with `Documentation & Review`, long days trimmed from the end. Every day comes out at exactly 8 hours. Without this, a 10-hour day reached the portal as a shift ending at 20:00.

**Date formats** — `YYYY-MM-DD` everywhere internally; `toFormDate()` in the spec converts to `M/D/YYYY` at the last moment. **The portal is asymmetric here:** the create form accepts `9/2/2026`, but the results table renders the same entry as `9/2/26`. Anything matching against the table must tolerate both year widths.

## Commands

```bash
# Setup (once)
npm install && npm run install:all
cd playwright && npx playwright install chromium

# Ollama must be running in its own terminal for schedule generation
ollama serve

# Both servers (backend :3001 + frontend :5173)
npm run dev

# Individually
npm run dev --prefix backend      # nodemon
npm run start --prefix backend    # plain node
npm run dev --prefix frontend
curl http://localhost:3001/api/health

# Playwright (from /playwright)
npm test                                    # all specs, headful
npm run test:ui                             # interactive
npm run report                              # last HTML report
npx playwright test --grep "populate timesheet from schedule file"
```

VS Code tasks in `.vscode/tasks.json` wrap all of the above.

## Ollama integration

`ollamaService.js` loads the ESM-only `ollama` package via dynamic `import()` from CommonJS — keep it that way; a top-level `require('ollama')` will throw. Model comes from `OLLAMA_MODEL` (default `llama3`), host from `OLLAMA_HOST`.

### The 300-second trap

**Ollama sends no HTTP response headers until generation finishes**, and undici gives headers only **300 seconds**. A long schedule exceeds that and Node reports:

```
TypeError: fetch failed
  cause: HeadersTimeoutError  code: UND_ERR_HEADERS_TIMEOUT
```

which reads like an unreachable server when the model is simply still working. Measured on `nemotron-3-ultra:cloud` with a 15-day schedule, headers arrived at 148s, 168s and >306s on consecutive runs — so the failure is intermittent and gets likelier as the schedule grows.

The client is therefore built with a dedicated dispatcher:

```js
const ollamaDispatcher = new Agent({ headersTimeout: 0, bodyTimeout: 0 })
new Ollama({ host, fetch: (input, init) => undiciFetch(input, { ...init, dispatcher: ollamaDispatcher }) })
```

Two things are load-bearing. It must be **undici's own `fetch`** — Node's global fetch rejects an `Agent` from the standalone package with `UND_ERR_INVALID_ARG`. And the dispatcher is scoped to this client, so nothing else in the process loses its timeouts. Verified by pointing the service at a stub that withheld headers for 320s: it completed.

**Streaming does not solve this**, though `stream: true` is kept because it is correct against a genuinely local model. A `:cloud` model is proxied through ollama.com, which buffers — measured: first chunk at 168.4s, all 117KB delivered in the final 0.4s.

### Model choice

`README.md` says to `ollama pull llama3`, but the configured model may be a `:cloud` one, which changes the performance picture entirely:

| Model | Time (15 days) | Quality |
|---|---|---|
| `nemotron-3-ultra:cloud` (550B, remote) | 148–306s+ | 15/15 days, 0 corrections |
| `qwen2.5-coder:1.5b` (local) | 47s | 14/15 days needed correction |

The small local model is fast but leans on `normalizeSchedule()` to produce anything usable. An 8B-class local model is the untested middle ground.

The response is stripped of ``` fences and handed straight to `JSON.parse` with no schema check. Any prompt edit must preserve: the exact `[{ "date", "entries": [{ "task", "duration" }] }]` shape, the "sum to exactly 8 hours" rule, and the instruction to pad short days with a filler task.

## Playwright notes

- **Dropdowns are TomSelect, not `<select>`.** `selectTomSelect()` reaches into `document.querySelector('#id').tomselect` via `page.evaluate` and substring-matches option text. Clicking/typing into these is race-prone — that's why the JS API is used.
- **The dependent dropdowns rebuild asynchronously, and this is the subtlest trap in the codebase.** Project and Activity arrive *already populated* on page load (37 and 17 options). Changing Customer does not refill an empty list — it **replaces a full one, roughly 2.5 seconds later**, filtered to that customer (37 → 34).

  The original code waited on `options.length > 1`, which was already true at load, so it waited for nothing. It then selected into the soon-to-be-discarded list, and the rebuild silently cleared the choice. Save posted with an empty Project and the server rejected it with *"A project needs to be selected."* Every entry failed this way.

  `waitForOptionsToReload()` therefore waits for the option **count to change** from a value captured beforehand, rather than for the list to be non-empty. `selectTomSelect()` re-reads the value after a settle delay and re-applies it if the rebuild wiped it, and **throws** when no option matches — the old version returned silently, which is why this surfaced only as a server-side validation error.
- **`assertRequiredFieldsSet()` runs before every Save**, failing with a clear message rather than letting the POST be rejected.
- **Order matters:** Customer → (wait for rebuild) → Project → (wait for rebuild) → Activity.
- Budget roughly **14 seconds per entry**; the settle delays dominate. The population test sets its own 30-minute timeout because one test creates the whole schedule and the 60s config default cannot cover it.
- Field IDs (`#timesheet_edit_form_begin_date`, `_begin_time`, `_end_time`, `_customer`, `_project`, `_activity`, `_description`) and the `input[type="submit"]` Save button were confirmed against the live site. If a run starts timing out on field lookups, the portal changed — update the POM, not the spec.
- `clickCreate()` navigates straight to `/en/timesheet/create` instead of clicking the `+ Create` link.
- Runs **headful by default** (`headless: false` in `playwright.config.js`) — the user is meant to watch it.
- Portal field constants (`CUSTOMER`, `PROJECT_WORK`, `PROJECT_LEAVE`, `ACTIVITY_WORK`, `ACTIVITY_LEAVE`) live at the top of `createEntry.spec.js`.
- **The Activity list is scoped to the selected Project**, which is easy to miss. Under the work project it offers `PE - Product`, `PE - Others` and the Cloud Infra activities. Under the leave project it is replaced by exactly four: `PE - Leave`, `PE - Permission`, `PE - Optional Holiday`, `PE - Holiday`. `PE - Others` **does not exist** there, so leave days use `PE - Leave`. Any audit that reads the Activity options before choosing a Project is measuring the wrong list and will report a false pass.
- Credentials come from `playwright/.env` (`TIMESHEET_USERNAME` / `TIMESHEET_PASSWORD`); `backend/.env` holds `PORT` and `OLLAMA_MODEL`.

- `verifyEntryInTable()` asserts each save landed, filtering rows on date **and** both times. Filtering on date alone matches many rows (one per task) and trips Playwright strict mode — that is why the original version had to be disabled.
- Its date pattern is deliberately written with `[0-9]` and lookaround rather than the usual shorthand escapes. A lone backslash-b inside a template literal is the backspace control character, not a word boundary; that exact corruption silently reduced this locator to matching nothing. The anchors are load-bearing — without them `1/2/26` matches inside `11/2/26`.

## DOM audit

`tests/domAudit.spec.js` is a read-only diagnostic that logs in, opens the create form, and reports whether every locator still resolves — **it never clicks Save, so it creates no entries.** Run it first whenever the portal might have changed:

```bash
npx playwright test --grep "audit portal DOM"
```

It checks the login fields, all seven form fields, the Save button, that each TomSelect is still TomSelect-backed, that every project/activity constant still matches a real option, and finally runs `verifyEntryInTable()` against a row that already exists. Last full run: **24/24**.

### Current gaps

- Only the population test and the audit are live. `tests/poctests.bkup` holds two more (`should generate schedule from AI UI then populate timesheet`, `should create a single timesheet entry (smoke)`) that Playwright does not pick up because of the `.bkup` extension. README §6 lists all three as runnable — it is stale. Rename to `.spec.js` to re-enable.

## Port wiring

Three places must agree: `PORT` in `backend/.env`, the `HOST`/`PORT` bind in `server.js`, and the proxy target in `frontend/vite.config.js`. Both the server bind and the proxy target use literal `127.0.0.1`, deliberately — `0.0.0.0` lets a stale process keep winning `localhost:3001` on Windows (surfacing as mysterious 404s instead of `EADDRINUSE`), and `localhost` in the proxy can resolve to `::1` and miss the IPv4-only backend.
