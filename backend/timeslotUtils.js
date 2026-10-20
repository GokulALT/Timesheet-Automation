'use strict';

function minutesToTime(m) {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/**
 * Given an array of { task, duration } entries (durations in hours, summing to 8),
 * returns portal-ready slots with beginTime / endTime strings (HH:MM).
 *
 * Work day: 09:00–13:00, lunch 13:00–14:00 (unlogged), afternoon 14:00–18:00.
 * A task crossing lunch is split into two rows; the second is suffixed "(cont.)".
 */
function calculateTimeslots(entries) {
  const DAY_START   = 9 * 60;
  const LUNCH_START = 13 * 60;
  const LUNCH_END   = 14 * 60;

  const slots = [];
  let cursor = DAY_START;

  for (const entry of entries) {
    let remaining = Math.round((Number(entry.duration) || 0) * 60);
    let part = 0;

    while (remaining > 0) {
      if (cursor >= LUNCH_START && cursor < LUNCH_END) cursor = LUNCH_END;

      const untilLunch = cursor < LUNCH_START ? LUNCH_START - cursor : Infinity;
      const chunk = Math.min(remaining, untilLunch);

      const beginTime = minutesToTime(cursor);
      cursor += chunk;
      remaining -= chunk;

      slots.push({
        ...entry,
        task:      part === 0 ? entry.task : `${entry.task} (cont.)`,
        duration:  chunk / 60,
        beginTime,
        endTime:   minutesToTime(cursor),
      });

      part++;
    }
  }

  return slots;
}

module.exports = { calculateTimeslots };
