'use strict';

const { Agent, fetch: undiciFetch } = require('undici');

// Scoped agent: the Kimai server uses a self-signed CA chain.
// rejectUnauthorized is false only for this dispatcher, not the whole process.
const kimaiAgent = new Agent({
  connect: { rejectUnauthorized: false },
});

const BASE_URL = process.env.KIMAI_BASE_URL || 'https://timesheet.lntedutech.com/api';

// IDs confirmed against live instance 2026-10-16
const PROJECT_WORK   = 20;   // Platform Engineering - CBT & Related Modules
const PROJECT_LEAVE  = 60;   // Platform Engineering - Permission / Leave / Optional Holiday
const ACTIVITY_LEAVE = 315;  // PE - Leave    (scoped to project 60)

// Work activities — chosen per-run via the UI toggle
const WORK_ACTIVITIES = {
  product:  2206, // PE - Product
  delivery: 2207, // PE - Delivery
};

function authHeaders(user, token) {
  return {
    'X-AUTH-USER':  user  || process.env.KIMAI_USER,
    'X-AUTH-TOKEN': token || process.env.KIMAI_TOKEN,
    'Content-Type': 'application/json',
    'Accept':       'application/json',
  };
}

/**
 * POST a new timesheet record to Kimai.
 *
 * @param {object} entry
 * @param {string}           entry.date         YYYY-MM-DD
 * @param {string}           entry.beginTime    HH:MM
 * @param {string}           entry.endTime      HH:MM
 * @param {'work'|'leave'}   entry.type
 * @param {string}           entry.description
 * @param {string}           [entry.kimaiUser]  overrides KIMAI_USER env var
 * @param {string}           [entry.kimaiToken] overrides KIMAI_TOKEN env var
 * @returns {Promise<object>} Created timesheet record from Kimai
 */
async function createTimesheetEntry({ date, beginTime, endTime, type, workActivity, description, kimaiUser, kimaiToken }) {
  const projectId  = type === 'leave' ? PROJECT_LEAVE : PROJECT_WORK;
  const activityId = type === 'leave'
    ? ACTIVITY_LEAVE
    : (WORK_ACTIVITIES[workActivity] || WORK_ACTIVITIES.product);

  const res = await undiciFetch(`${BASE_URL}/timesheets`, {
    method:     'POST',
    headers:    authHeaders(kimaiUser, kimaiToken),
    body:       JSON.stringify({
      begin:       `${date}T${beginTime}:00`,
      end:         `${date}T${endTime}:00`,
      project:     projectId,
      activity:    activityId,
      description: description || '',
    }),
    dispatcher: kimaiAgent,
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json.message || json.error || JSON.stringify(json);
    throw new Error(`Kimai ${res.status}: ${msg}`);
  }
  return json;
}

module.exports = { createTimesheetEntry };
