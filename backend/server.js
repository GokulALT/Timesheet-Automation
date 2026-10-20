require('dotenv').config();

const express = require('express');
const path    = require('path');
const fs      = require('fs');
const { getWorkingDates }      = require('./schedulerLogic');
const { scheduleWithAI }       = require('./aiService');
const { normalizeSchedule }    = require('./normalizeSchedule');
const { calculateTimeslots }   = require('./timeslotUtils');
const { readStatus, clearStatus, createTracker } = require('./runStatus');
const { createTimesheetEntry, verifyCredentials } = require('./kimaiService');

const app  = express();
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '127.0.0.1';

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(express.json());

// Serve the React build in production. In dev, Vite runs its own server and
// proxies /api to this backend, so this block is never reached during dev.
const STATIC_DIR = path.join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(STATIC_DIR));

// ── Routes ─────────────────────────────────────────────────────────────────────

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/auth/verify', async (req, res) => {
  const { kimaiUser, kimaiToken } = req.body || {};
  const result = await verifyCredentials(kimaiUser, kimaiToken);
  if (result.ok) return res.json({ success: true, user: result.user });
  const status = result.reason === 'network' ? 502 : result.reason === 'access' ? 403 : 401;
  return res.status(status).json({ success: false, reason: result.reason, error: result.message });
});

app.post('/api/schedule', async (req, res) => {
  const { startDate, daysRequired, taskSummary, holidays = [], aiProvider } = req.body;

  if (!startDate)
    return res.status(400).json({ success: false, error: 'startDate is required.' });
  if (daysRequired === undefined || daysRequired === null)
    return res.status(400).json({ success: false, error: 'daysRequired is required.' });
  if (!taskSummary || typeof taskSummary !== 'string' || !taskSummary.trim())
    return res.status(400).json({ success: false, error: 'taskSummary is required.' });

  try {
    const allDates   = getWorkingDates(startDate, Number(daysRequired));
    const holidaySet = new Set(holidays);
    const taskDates  = allDates.filter(d => !holidaySet.has(d));
    const leaveDates = allDates.filter(d =>  holidaySet.has(d));

    const rawSchedule = taskDates.length > 0
      ? await scheduleWithAI(taskDates, taskSummary, aiProvider || {})
      : [];

    const aiSchedule = normalizeSchedule(rawSchedule, taskDates);

    const leaveEntries = leaveDates.map(date => ({
      date,
      type:    'leave',
      entries: [{ task: 'Platform Engineering - Permission / Leave / Optional Holiday', duration: 8 }],
    }));

    const workEntries = aiSchedule.map(day => ({ ...day, type: 'work' }));
    const schedule = [...workEntries, ...leaveEntries]
      .sort((a, b) => a.date.localeCompare(b.date));

    return res.json({ success: true, schedule });
  } catch (err) {
    console.error('Error generating schedule:', err);
    return res.status(500).json({ success: false, error: err.message || 'An unexpected error occurred.' });
  }
});

app.post('/api/schedule/save', (req, res) => {
  const { schedule } = req.body || {};
  if (!Array.isArray(schedule) || schedule.length === 0)
    return res.status(400).json({ success: false, error: 'schedule array is required.' });

  const outPath = path.join(__dirname, 'schedule.json');
  try {
    fs.writeFileSync(outPath, JSON.stringify(schedule, null, 2));
  } catch (err) {
    return res.status(500).json({ success: false, error: `Could not write file: ${err.message}` });
  }

  const totalEntries = schedule.reduce((n, d) => n + (d.entries?.length ?? 0), 0);
  return res.json({ success: true, days: schedule.length, entries: totalEntries, path: outPath });
});

function countEntries(schedule) {
  return schedule.reduce((n, day) => {
    if (day.type === 'leave') return n + 1;
    return n + calculateTimeslots(day.entries || []).length;
  }, 0);
}

let currentRun = null;

app.post('/api/automate-kimai', (req, res) => {
  const { schedule, kimaiUser, kimaiToken } = req.body;

  if (!Array.isArray(schedule) || schedule.length === 0)
    return res.status(400).json({ success: false, error: 'schedule array is required.' });

  if (currentRun && currentRun.exitCode === null)
    return res.status(409).json({ success: false, error: 'A run is already in progress.' });

  const planned = [];
  for (const day of schedule) {
    if (day.type === 'leave') {
      planned.push({
        date:        day.date,
        beginTime:   '09:00',
        endTime:     '18:00',
        type:        'leave',
        description: day.entries[0]?.task || 'Platform Engineering - Permission / Leave / Optional Holiday',
      });
    } else {
      for (const slot of calculateTimeslots(day.entries || [])) {
        planned.push({
          date:         day.date,
          beginTime:    slot.beginTime,
          endTime:      slot.endTime,
          type:         'work',
          workActivity: slot.activity || 'product',
          description:  slot.task,
        });
      }
    }
  }

  clearStatus();
  const tracker = createTracker(planned.length);
  currentRun = { startedAt: new Date().toISOString(), exitCode: null, stopped: false };

  res.json({ success: true, entries: planned.length, message: `Creating ${planned.length} entries via Kimai API.` });

  (async () => {
    for (const entry of planned) {
      if (currentRun.stopped) break;
      tracker.begin({ date: entry.date, beginTime: entry.beginTime, endTime: entry.endTime });
      try {
        await createTimesheetEntry({ ...entry, kimaiUser, kimaiToken });
        tracker.success();
      } catch (err) {
        tracker.failure(
          { date: entry.date, beginTime: entry.beginTime, endTime: entry.endTime },
          err?.message || String(err),
        );
      }
    }
    const summary = tracker.finish();
    currentRun.exitCode = summary.failed > 0 ? 1 : 0;
    console.log(`Kimai API run: ${summary.created}/${summary.total} created, ${summary.failed} failed`);
  })().catch(err => {
    console.error('Kimai API run error:', err.message);
    currentRun.exitCode = -1;
  });
});

app.get('/api/automation/status', (req, res) => {
  const status = readStatus();

  if (!status) {
    if (currentRun && currentRun.exitCode === null)
      return res.json({ state: 'starting', startedAt: currentRun.startedAt });
    return res.json({ state: 'idle' });
  }

  if (status.state === 'running') {
    if (!currentRun)
      return res.json({ ...status, state: 'crashed',
        error: 'The backend restarted while a run was in progress.' });
    if (currentRun.stopped)
      return res.json({ ...status, state: 'stopped' });
    if (currentRun.exitCode !== null)
      return res.json({ ...status, state: 'crashed',
        error: `The automation process exited before finishing (code ${currentRun.exitCode}).` });
  }

  return res.json(status);
});

app.post('/api/automation/stop', (req, res) => {
  if (!currentRun || currentRun.exitCode !== null)
    return res.status(409).json({ success: false, error: 'No automation run is in progress.' });

  currentRun.stopped = true;
  return res.json({ success: true, message: 'Stopping automation.' });
});

// Catch-all: serve React app for any non-API route (client-side routing).
app.get('*', (req, res) => {
  res.sendFile(path.join(STATIC_DIR, 'index.html'));
});

// ── Start ──────────────────────────────────────────────────────────────────────
const server = app.listen(PORT, HOST, () => {
  console.log(`AI Task Scheduler running on http://${HOST}:${PORT}`);
});

server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Stop it or set PORT in backend/.env.`);
    process.exit(1);
  }
  throw err;
});
