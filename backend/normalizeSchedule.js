/**
 * Reconciles raw LLM schedule output against the working dates that were
 * actually requested, and forces every day to a valid 8-hour shape.
 *
 * The model is *asked* to return one entry per working date summing to 8 hours,
 * but nothing makes it comply. Without this pass a miscounted day reaches the
 * portal as real begin/end times — a 10-hour day ends at 20:00, a 6-hour day
 * ends at 16:00, and a date the model invented gets logged against the wrong
 * day entirely.
 *
 * Every correction is recorded on the day as `adjusted` so the UI can show it
 * to the user before they start automation. Nothing is corrected silently.
 */

const WORK_DAY_HOURS = 8;
const FILLER_TASK = 'Documentation & Review';

/** Durations arrive as floats; compare and store at 2dp to avoid 7.999999. */
const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Coerce one day's entries to a clean [{ task, duration }] list,
 * dropping anything malformed or zero-length.
 */
function cleanEntries(entries) {
  if (!Array.isArray(entries)) return [];
  return entries
    .filter((e) => e && typeof e.task === 'string' && e.task.trim())
    .map((e) => ({
      task:     e.task.trim(),
      duration: round2(Number(e.duration)),
      activity: e.activity === 'delivery' ? 'delivery' : 'product',
    }))
    .filter((e) => Number.isFinite(e.duration) && e.duration > 0);
}

/**
 * Force a single day to total exactly WORK_DAY_HOURS.
 * Short days are padded with a filler task; long days are trimmed from the end.
 *
 * @returns {{ date, entries, adjusted? }}
 */
function normalizeDay(day) {
  const entries = cleanEntries(day.entries);
  const total = round2(entries.reduce((sum, e) => sum + e.duration, 0));

  if (total === WORK_DAY_HOURS) {
    return { ...day, entries };
  }

  if (total < WORK_DAY_HOURS) {
    const short = round2(WORK_DAY_HOURS - total);
    const existingFiller = entries.find((e) => e.task === FILLER_TASK);

    if (existingFiller) existingFiller.duration = round2(existingFiller.duration + short);
    else entries.push({ task: FILLER_TASK, duration: short, activity: 'product' });

    return {
      ...day,
      entries,
      adjusted: { action: 'padded', from: total, to: WORK_DAY_HOURS },
    };
  }

  // Over 8 hours — trim from the last entry backwards so the earliest
  // (and usually most substantive) tasks keep their full allocation.
  let excess = round2(total - WORK_DAY_HOURS);
  for (let i = entries.length - 1; i >= 0 && excess > 0; i--) {
    const take = Math.min(entries[i].duration, excess);
    entries[i].duration = round2(entries[i].duration - take);
    excess = round2(excess - take);
  }

  return {
    ...day,
    entries: entries.filter((e) => e.duration > 0),
    adjusted: { action: 'trimmed', from: total, to: WORK_DAY_HOURS },
  };
}

/**
 * Align the model's output with the dates we actually asked for.
 *
 *  - dates the model invented (not in expectedDates) are dropped
 *  - dates the model duplicated are merged
 *  - dates the model omitted are generated as a full filler day
 *  - every surviving day is forced to 8 hours
 *
 * @param {Array<{date: string, entries: Array}>} aiSchedule
 * @param {string[]} expectedDates  - "YYYY-MM-DD", the working days requested
 * @returns {Array<{date, entries, adjusted?}>} ordered to match expectedDates
 */
function normalizeSchedule(aiSchedule, expectedDates) {
  const valid = new Set(expectedDates);
  const byDate = new Map();

  for (const day of Array.isArray(aiSchedule) ? aiSchedule : []) {
    if (!day || !valid.has(day.date)) continue; // drop invented dates
    if (byDate.has(day.date)) {
      // duplicate date — merge entries, normalizeDay will trim the overflow
      byDate.get(day.date).entries.push(...cleanEntries(day.entries));
    } else {
      byDate.set(day.date, { ...day, entries: cleanEntries(day.entries) });
    }
  }

  return expectedDates.map((date) => {
    const day = byDate.get(date);

    if (!day) {
      return {
        date,
        entries: [{ task: FILLER_TASK, duration: WORK_DAY_HOURS }],
        adjusted: { action: 'generated', from: 0, to: WORK_DAY_HOURS },
      };
    }

    return normalizeDay(day);
  });
}

module.exports = { normalizeSchedule, normalizeDay, WORK_DAY_HOURS, FILLER_TASK };
