'use strict';

const fs   = require('fs');
const path = require('path');

const STATUS_FILE = path.join(__dirname, 'automation-status.json');

function writeStatus(status) {
  const tmp = STATUS_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(status, null, 2));
  fs.renameSync(tmp, STATUS_FILE);
}

function clearStatus() {
  for (const f of [STATUS_FILE, STATUS_FILE + '.tmp']) {
    try { fs.unlinkSync(f); } catch (_) { /* not there: fine */ }
  }
}

function readStatus() {
  try {
    return JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'));
  } catch (_) {
    return null;
  }
}

function createTracker(total) {
  const state = {
    state:      'running',
    startedAt:  new Date().toISOString(),
    finishedAt: null,
    total,
    created:    0,
    failed:     0,
    current:    null,
    failures:   [],
  };
  writeStatus(state);

  return {
    begin(entry)         { state.current = entry; writeStatus(state); },
    success()            { state.created += 1; state.current = null; writeStatus(state); },
    failure(entry, error) {
      state.failed += 1;
      state.failures.push({ ...entry, error: String(error).slice(0, 300) });
      state.current = null;
      writeStatus(state);
    },
    finish() {
      state.state      = 'completed';
      state.finishedAt = new Date().toISOString();
      state.current    = null;
      writeStatus(state);
      return { ...state };
    },
  };
}

module.exports = { createTracker, readStatus, writeStatus, clearStatus, STATUS_FILE };
