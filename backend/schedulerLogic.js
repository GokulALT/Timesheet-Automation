/**
 * Returns an array of working date strings ("YYYY-MM-DD") starting from
 * startDate until daysRequired working days have been collected.
 *
 * Working day rules:
 *  - Sundays are always skipped.
 *  - The 2nd and 4th Saturday of each month are skipped.
 *  - All other days (Mon–Fri, and 1st / 3rd / 5th Saturdays) are working days.
 *
 * @param {string} startDate   - "YYYY-MM-DD"
 * @param {number} daysRequired
 * @returns {string[]}
 */
function getWorkingDates(startDate, daysRequired) {
  /**
   * Given a Date object that falls on a Saturday, return which occurrence
   * of Saturday it is within its month (1-based).
   * e.g. the first Saturday of the month → 1, second → 2, etc.
   */
  function saturdayOccurrenceInMonth(date) {
    // Count how many Saturdays have occurred up to and including this date
    // within the same month.
    const day = date.getDate(); // 1-31
    // A Saturday on the Nth of the month is the ceil(N/7)-th Saturday
    // only if every prior week also had a Saturday, so we count directly:
    let count = 0;
    const year = date.getFullYear();
    const month = date.getMonth();
    for (let d = 1; d <= day; d++) {
      const candidate = new Date(year, month, d);
      if (candidate.getDay() === 6) {
        count++;
      }
    }
    return count;
  }

  /**
   * Returns true when the given date is a working day.
   */
  function isWorkingDay(date) {
    const dow = date.getDay(); // 0 = Sun, 6 = Sat

    // Skip Sundays
    if (dow === 0) return false;

    // Check Saturdays
    if (dow === 6) {
      const occurrence = saturdayOccurrenceInMonth(date);
      // Skip 2nd and 4th Saturdays
      if (occurrence === 2 || occurrence === 4) return false;
    }

    return true;
  }

  /**
   * Format a Date object as "YYYY-MM-DD" without timezone conversion.
   */
  function formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // Parse startDate as a local date (avoid UTC shift)
  const [year, month, day] = startDate.split('-').map(Number);
  const current = new Date(year, month - 1, day);

  const workingDates = [];

  while (workingDates.length < daysRequired) {
    if (isWorkingDay(current)) {
      workingDates.push(formatDate(current));
    }
    current.setDate(current.getDate() + 1);
  }

  return workingDates;
}

module.exports = { getWorkingDates };
