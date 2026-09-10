// The booking form asks for the call day as free text, so what lands in the record
// is anything from "2026-09-12" to "9/12" to "Friday" to nothing at all. This turns
// what can be turned into a date, and is honest about the rest rather than guessing.
import { toReportDay, todayInReportTimezone } from '@/lib/report-date';

var MONTHS = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};
var WEEKDAYS = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };

function iso(y, m, d) {
  return String(y) + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
}

// Returns YYYY-MM-DD, or '' when the text does not name a day we can pin down.
export function parseCallDay(value, today) {
  var raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';
  var now = today || todayInReportTimezone();
  var thisYear = Number(now.slice(0, 4));

  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  if (raw === 'today') return now;
  if (raw === 'tomorrow') {
    var t = new Date(now + 'T12:00:00');
    t.setDate(t.getDate() + 1);
    return toReportDay(t);
  }

  // 9/12, 09/12/2026, 9-12
  var slash = raw.match(/^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?$/);
  if (slash) {
    var year = slash[3] ? Number(slash[3].length === 2 ? '20' + slash[3] : slash[3]) : thisYear;
    return iso(year, Number(slash[1]), Number(slash[2]));
  }

  // "Sep 12", "12 September", "September 12, 2026"
  var named = raw.match(/([a-z]{3,9})\.?\s+(\d{1,2})|(\d{1,2})\s+([a-z]{3,9})/);
  if (named) {
    var monthWord = (named[1] || named[4] || '').slice(0, 4);
    var dayNum = Number(named[2] || named[3]);
    var month = MONTHS[monthWord] || MONTHS[monthWord.slice(0, 3)];
    if (month && dayNum >= 1 && dayNum <= 31) {
      var withYear = raw.match(/\b(20\d{2})\b/);
      return iso(withYear ? Number(withYear[1]) : thisYear, month, dayNum);
    }
  }

  // A bare weekday means the next one coming up, which is what a rep means when
  // they write "Thursday" on a booking.
  var weekdayWord = raw.match(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
  if (weekdayWord) {
    var target = WEEKDAYS[weekdayWord[1]];
    var cursor = new Date(now + 'T12:00:00');
    for (var i = 0; i < 7; i++) {
      if (cursor.getDay() === target) return toReportDay(cursor);
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  return '';
}

// Minutes past midnight, for sorting. Unparseable times sort to the end of the day.
export function parseCallMinutes(value) {
  var raw = String(value || '').trim().toLowerCase();
  var m = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (!m) return 24 * 60;
  var hour = Number(m[1]);
  var mins = Number(m[2] || 0);
  var suffix = m[3];
  if (suffix === 'pm' && hour < 12) hour += 12;
  if (suffix === 'am' && hour === 12) hour = 0;
  if (hour > 23) return 24 * 60;
  return hour * 60 + mins;
}

export function prettyTime(value) {
  var raw = String(value || '').trim();
  if (!raw) return 'Time not set';
  return raw;
}
