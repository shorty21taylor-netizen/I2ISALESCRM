// One definition of "what day did this happen on".
//
// The team sells in Pacific time and the servers run in UTC, so a deal logged at
// 9pm PT carries a timestamp on the *next* UTC day. Deriving the day with
// submittedAt.split('T')[0] therefore files evening work under tomorrow — which is
// how a rep who logged a $5k deal and then reported the same $5k in their EOD ended
// up on the leaderboard twice: the two records landed in different day buckets, so
// the dedupe that takes the larger of the two never saw them as the same day.

export var REPORT_TIMEZONE = process.env.REPORT_TIMEZONE || 'America/Los_Angeles';

var formatter = null;

function getFormatter() {
  if (formatter) return formatter;
  // 'en-CA' formats as YYYY-MM-DD, which is the shape every comparison here uses.
  formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: REPORT_TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
  return formatter;
}

// An ISO timestamp (or Date) -> 'YYYY-MM-DD' in the team's timezone.
export function toReportDay(value) {
  if (!value) return '';
  // Already a plain date: leave it alone. Shifting it by a timezone would be wrong,
  // since a date with no time of day is not an instant.
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return value.trim();
  }
  var d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return String(value).split('T')[0];
  try {
    return getFormatter().format(d);
  } catch (e) {
    // A runtime without full ICU data throws on an unknown zone — UTC beats crashing.
    console.error('[ReportDate] Timezone conversion failed, using UTC:', e.message);
    return d.toISOString().split('T')[0];
  }
}

// Today, in the team's timezone.
export function todayInReportTimezone() {
  return toReportDay(new Date());
}

// The day a record belongs to: an explicit date field wins (the rep told us), then
// the submission instant converted to the team's timezone.
export function recordDay(record) {
  if (!record) return '';
  if (record.date) return toReportDay(record.date);
  return toReportDay(record.submittedAt);
}
