# Standard Operating Procedure — Timesheet Automation

## Purpose

This SOP describes the end-to-end process for using the AI Task Scheduler to generate a work plan and automatically fill timesheet entries in the myTime portal at `https://timesheet.lntedutech.com`.

---

## Prerequisites (One-time)

Before using the system for the first time:

1. Install **Node.js 18+** and **Ollama** (see README.md)
2. Run `ollama pull llama3` to download the AI model
3. Run the first-time setup commands in README.md Section 1
4. Fill in your credentials in `playwright/.env`

---

## Weekly / Sprint Procedure

Follow these steps at the start of each planning period (sprint, week, or month).

---

### Step 1 — Start the required services

Open **two terminals**:

**Terminal 1 — Ollama (AI model server)**
```bash
ollama serve
```
Leave this running. Ollama must be active for schedule generation.

**Terminal 2 — Application servers**
```bash
cd "D:\AI_FileSys\Timesheet Automation"
npm run dev
```
This starts:
- Backend API on `http://localhost:3001`
- Frontend UI on `http://localhost:5173`

---

### Step 2 — Open the AI Task Scheduler

Open your browser and go to:
```
http://localhost:5173
```

---

### Step 3 — Fill in the scheduling form

| Field | What to enter |
|---|---|
| **Start Date** | First working day of your plan period (e.g. `2025-12-22`) |
| **Number of Days** | Total working days to cover (e.g. `10` for a fortnight) |
| **Task Summary** | A paragraph describing all your planned work in natural language (see example below) |
| **Holidays / Leave Days** | Any dates you will be absent, one per line in `YYYY-MM-DD` format |

**Example Task Summary:**
> "Design the authentication module, set up the PostgreSQL database schema, build the user management REST APIs, write unit and integration tests for the core modules, conduct a security review of all API endpoints, and prepare the deployment pipeline for staging."

**Example Leave Days:**
```
2025-12-25
2025-12-26
```

> **Note:** You do not need to list tasks one per line. Write naturally — the AI reads your description and identifies the individual tasks automatically.

---

### Step 4 — Generate the schedule

Click **Generate Schedule**.

- Ollama will process your description (this may take 30–90 seconds depending on your machine)
- The UI will display a card for each working day
- **Indigo cards** = work days with tasks and per-task hour allocations
- **Amber cards** = leave / holiday days

**Verify the output:**
- Each work day should total **8 hours**
- Tasks should be distributed in a logical order
- Leave days should show the correct dates

If the output looks wrong, adjust your Task Summary to be more specific and click Generate Schedule again.

---

### Step 5 — Start the automation

Once you are satisfied with the schedule, click **▶ Start Automation**.

What happens:
1. The schedule is sent to the backend
2. The backend saves it to `playwright/schedule.json`
3. A **Chromium browser window opens automatically**
4. Playwright logs into the timesheet portal and begins filling entries

**Do not close the browser window** while automation is running.

The page shows live progress while it runs — a progress bar, an *N of M* entry count, and which entry is being filled — with a **Stop** button if you need to abort.

When the run finishes the page shows a summary: total duration, entries created, and any failures listed with the reason for each. A failed entry does not stop the run; it is recorded and the remaining entries continue, so the summary tells you exactly what to fix.

---

### Step 6 — Monitor the automation

Watch the Chromium window. For each working day, Playwright will:

1. Navigate to `https://timesheet.lntedutech.com/en/timesheet/create`
2. Fill the date in `M/D/YYYY` format
3. Set begin and end times (calculated from task durations, with a 13:00–14:00 lunch break)
4. Select:
   - **Customer** → Platform Engineering Department
   - **Project** → Platform Engineering - CBT & Related Modules *(or Permission / Leave for leave days)*
   - **Activity** → PE - Product *(or PE - Leave for leave days)*
5. Paste the AI-generated task description
6. Click **Save**
7. Move to the next task / next day

---

### Step 7 — Verify entries in the portal

After automation completes:

1. Open `https://timesheet.lntedutech.com/en/timesheet/` in your browser
2. Check that all expected dates appear in the timesheet table
3. Spot-check a few entries to confirm the correct project, activity, and description

---

## Time Slot Calculation Reference

The system distributes tasks across the working day as follows:

| Period | Hours |
|---|---|
| Morning | 09:00 – 13:00 (4 hours) |
| Lunch break | 13:00 – 14:00 (not logged) |
| Afternoon | 14:00 – 18:00 (4 hours) |
| **Total logged** | **8 hours** |

Tasks are slotted sequentially. A task that would run through the lunch break is split into two entries either side of it, so the day always ends at 18:00 and lunch is never logged as work.

For example, a 3-hour task followed by a 5-hour task is logged as three entries:

| Entry | Time | Hours |
|---|---|---|
| Task A | 09:00 – 12:00 | 3 |
| Task B | 12:00 – 13:00 | 1 |
| Task B *(cont.)* | 14:00 – 18:00 | 4 |

The second half of a split task carries the same description with `(cont.)` appended.

---

## Field Mapping Reference

| Timesheet Field | Work Day | Leave Day |
|---|---|---|
| Customer | Platform Engineering Department | Platform Engineering Department |
| Project | Platform Engineering - CBT & Related Modules | Platform Engineering - Permission / Leave / Optional Holiday |
| Activity | PE - Product | PE - Leave |
| Description | AI-generated task text | Platform Engineering - Permission / Leave / Optional Holiday |

---

## Working Day Rules

The scheduler automatically skips:
- All **Sundays**
- The **2nd and 4th Saturday** of each calendar month

1st, 3rd, and 5th Saturdays are treated as working days.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| "Generate Schedule" spins forever | Ollama is not running | Run `ollama serve` in a separate terminal |
| Schedule JSON is malformed / empty | LLM returned non-JSON output | Retry generation; if it recurs, check `OLLAMA_MODEL` in `backend/.env` |
| Playwright browser doesn't open | Backend not running on :3001 | Run `npm run dev` from project root |
| Form fields not found / timeout | Portal UI updated its element IDs | Run the DOM audit (below) to see exactly which locator broke, then update `playwright/pages/TimesheetPage.js` |
| `Refusing to save: required field(s) not set` | The portal rebuilt its Project/Activity dropdowns more slowly than the automation allowed | Re-run. If it persists, run the DOM audit — the project or activity name may have changed |
| Wrong project selected | TomSelect options changed | Update `PROJECT_WORK` / `PROJECT_LEAVE` constants in `playwright/tests/createEntry.spec.js` |
| Entries missing after automation | Network timeout mid-run | Re-run `cd playwright && npx playwright test --grep "populate timesheet from schedule file"` — it reads the same `schedule.json` |

---

## Checking the Portal Without Filling Anything

If a run fails and you want to know whether the portal itself changed, run the read-only audit. It logs in, opens the create form, checks every field and dropdown option, and **creates no entries**:

```bash
cd playwright
npx playwright test --grep "audit portal DOM"
```

It prints a PASS/FAIL line per check and a final score. Anything other than a full pass tells you precisely which locator or dropdown option no longer matches.

---

## Re-running Without Regenerating

If automation fails partway through, you do not need to regenerate the schedule. Run Playwright directly:

```bash
cd playwright
npx playwright test --grep "populate timesheet from schedule file"
```

This re-reads the existing `playwright/schedule.json` and retries all entries.

---

## File Locations

| File | Purpose |
|---|---|
| `playwright/.env` | Credentials and schedule configuration |
| `playwright/schedule.json` | Generated schedule (created at runtime by "Start Automation") |
| `playwright/pages/TimesheetPage.js` | Page Object Model — update locators here if the portal changes |
| `playwright/tests/createEntry.spec.js` | Test suite — update field constants here |
| `backend/.env` | Port and Ollama model configuration |
