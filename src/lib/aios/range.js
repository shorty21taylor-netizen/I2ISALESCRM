// The date ranges Summit AIOS understands, defined once so a question asked in
// chat lands on exactly the same window the team dashboard's range picker uses.
// "This week" means the week you are standing in, Monday to today — not the last
// seven days — because that is what the floor plans against.
import { toReportDay, todayInReportTimezone } from '@/lib/report-date';

export var RANGE_IDS = ['today', 'yesterday', 'week', 'month', 'quarter', 'year', 'all', 'custom'];

export var RANGE_LABELS = {
  today: 'today',
  yesterday: 'yesterday',
  week: 'this week (Monday to today)',
  month: 'the past 30 days',
  quarter: 'the past 90 days',
  year: 'the past 365 days',
  all: 'all time',
  custom: 'a custom range',
};

var DAY = /^\d{4}-\d{2}-\d{2}$/;

export function isDay(value) {
  return typeof value === 'string' && DAY.test(value.trim());
}

function back(days) {
  var d = new Date();
  d.setDate(d.getDate() - days);
  return toReportDay(d);
}

// Resolve a validated range id into the { start, end } the report engine takes.
// An unknown id can never reach here — the tool layer allowlists it first — but
// the default is still the narrowest window rather than the widest.
export function resolveRange(id, start, end) {
  var today = todayInReportTimezone();

  if (id === 'all') return { start: null, end: null, label: RANGE_LABELS.all };
  if (id === 'yesterday') {
    var y = back(1);
    return { start: y, end: y, label: RANGE_LABELS.yesterday };
  }
  if (id === 'week') {
    var w = new Date();
    var dow = (w.getDay() + 6) % 7; // Monday = 0
    w.setDate(w.getDate() - dow);
    return { start: toReportDay(w), end: today, label: RANGE_LABELS.week };
  }
  if (id === 'month') return { start: back(29), end: today, label: RANGE_LABELS.month };
  if (id === 'quarter') return { start: back(89), end: today, label: RANGE_LABELS.quarter };
  if (id === 'year') return { start: back(364), end: today, label: RANGE_LABELS.year };
  if (id === 'custom') {
    // Both ends must be real days. A half-specified custom range silently
    // widening to all time is how a rep gets shown the company's whole history.
    if (!isDay(start) || !isDay(end)) return null;
    var a = start.trim(), b = end.trim();
    if (a > b) { var t = a; a = b; b = t; }
    return { start: a, end: b, label: a + ' to ' + b };
  }
  return { start: today, end: today, label: RANGE_LABELS.today };
}

// The window immediately before a resolved range, same length, for comparisons.
// Open-ended ranges have no "before", so they get none rather than a guess.
export function previousWindow(range) {
  if (!range || !range.start || !range.end) return null;
  var startMs = Date.parse(range.start + 'T12:00:00Z');
  var endMs = Date.parse(range.end + 'T12:00:00Z');
  if (isNaN(startMs) || isNaN(endMs)) return null;
  var span = Math.round((endMs - startMs) / 86400000) + 1;
  function shift(day, days) {
    var d = new Date(Date.parse(day + 'T12:00:00Z') - days * 86400000);
    return d.toISOString().slice(0, 10);
  }
  return {
    start: shift(range.start, span),
    end: shift(range.start, 1),
    label: shift(range.start, span) + ' to ' + shift(range.start, 1),
  };
}
