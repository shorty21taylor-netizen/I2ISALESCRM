// The operator's company-wide numbers: one row of figures for every offer being
// run, added up across every workspace at once.
//
// This does not reimplement the funnel. computeSalesReport already knows how to
// read these records honestly — it dedupes deals filed twice, throws out counts
// past the sanity limits, refuses to divide by a field nobody fills, and derives
// the calendar from the outcomes when a rep skipped it. All of that took real
// incidents to get right.
//
// So this runs that same report once PER WORKSPACE and adds the results up. Two
// consequences are deliberate:
//
//   - Per workspace, not pooled. Pooling every record into one report would let
//     one client's well-kept EODs paper over another's empty ones, and the
//     coverage guards would pass on a population that does not exist.
//   - Volumes add; rates do not. A show rate is recomputed from the summed
//     numerator and denominator, because averaging four percentages weights a
//     workspace with nine calls the same as one with nine hundred.

import { computeSalesReport } from '@/lib/sales-report';
import { toReportDay } from '@/lib/report-date';

function num(v) {
  var n = parseFloat(v);
  return isFinite(n) ? n : 0;
}

function money(v) { return Math.round(num(v) * 100) / 100; }

// A percentage, or null when the question cannot honestly be answered. Null is
// not zero: "no calls were taken" and "0% of calls were taken" are different
// statements and the page prints them differently.
function rate(numerator, denominator) {
  if (!denominator || denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function wsOf(record) {
  return (record && record.workspaceId) || 'default';
}

// Split a flat list into one bucket per workspace, so each workspace's report is
// built from its own records and nobody else's.
function bucket(rows) {
  var out = {};
  (rows || []).filter(Boolean).forEach(function (r) {
    var id = wsOf(r);
    (out[id] = out[id] || []).push(r);
  });
  return out;
}

export function emptyTotals() {
  return {
    cashCollected: 0,
    closes: 0,
    callsBooked: 0,
    onCalendar: 0,
    taken: 0,
    noShowed: 0,
    canceled: 0,
    pitched: 0,
    dials: 0,
    conversations: 0,
    dealsFiled: 0,
    duplicatesRemoved: 0,
  };
}

// Volumes only. Every rate is derived afterwards from these sums.
function addInto(totals, report) {
  var v = report.volume || {};
  var c = report.cash || {};
  var rep = report.reporting || {};
  totals.cashCollected += num(c.collected);
  totals.closes += num(v.closes);
  totals.callsBooked += num(v.sets);
  totals.onCalendar += num(v.onCalendar);
  totals.taken += num(v.taken);
  totals.noShowed += num(v.noShowed);
  totals.canceled += num(v.canceled);
  totals.pitched += num(v.pitched);
  totals.dials += num(v.dials);
  totals.conversations += num(v.conversations);
  totals.dealsFiled += num(rep.dealsFiled);
  totals.duplicatesRemoved += num(c.duplicatesRemoved);
  return totals;
}

// The shape the dashboard renders: the raw counts, plus the handful of rates the
// operator actually steers on.
export function deriveRates(t) {
  return {
    cashCollected: money(t.cashCollected),
    closes: t.closes,
    callsBooked: t.callsBooked,
    onCalendar: t.onCalendar,
    taken: t.taken,
    noShowed: t.noShowed,
    canceled: t.canceled,
    pitched: t.pitched,
    dials: t.dials,
    conversations: t.conversations,
    dealsFiled: t.dealsFiled,
    duplicatesRemoved: t.duplicatesRemoved,

    // Of everything that was on the calendar, how much of it actually happened.
    showRate: rate(t.taken, t.onCalendar),
    noShowRate: rate(t.noShowed, t.onCalendar),
    cancelRate: rate(t.canceled, t.onCalendar),

    // Closes over calls TAKEN, not over calls booked. Booked calls that never
    // showed are an attendance problem, and folding them in here would read as a
    // closing problem and send the wrong person to get coached.
    closeRate: rate(t.closes, t.taken),
    // Of the people who sat through the offer, how many bought.
    offerToClose: rate(t.closes, t.pitched),

    // Cash per close. Zero closes means there is no average, not an average of 0.
    avgDeal: t.closes > 0 ? Math.round(t.cashCollected / t.closes) : null,
    // What a booked call is worth before anyone shows up — the number that says
    // whether buying more calls is worth it.
    cashPerBookedCall: t.callsBooked > 0 ? Math.round(t.cashCollected / t.callsBooked) : null,
  };
}

// deals/eods/booked/afterCalls are the WHOLE store, unfiltered — computeSalesReport
// does its own range filtering, and it must, because it filters each record type on
// the right date field.
export function computeCommandMetrics(input) {
  var opts = input || {};
  var start = opts.start || '';
  var end = opts.end || '';
  var workspaces = (opts.workspaces || []).filter(Boolean);

  var dealsBy = bucket(opts.deals);
  var eodsBy = bucket(opts.eods);
  var bookedBy = bucket(opts.booked);
  var afterBy = bucket(opts.afterCalls);

  // Every workspace that exists, plus any id that appears only in the records —
  // a deal filed against a workspace that was later renamed or removed still
  // happened, and dropping it would quietly shrink the company's cash.
  var ids = {};
  workspaces.forEach(function (w) { if (w && w.id) ids[w.id] = w.name || w.id; });
  [dealsBy, eodsBy, bookedBy, afterBy].forEach(function (b) {
    Object.keys(b).forEach(function (id) { if (!ids[id]) ids[id] = id; });
  });

  var totals = emptyTotals();
  var rows = Object.keys(ids).map(function (id) {
    var report = computeSalesReport({
      start: start,
      end: end,
      deals: dealsBy[id] || [],
      eods: eodsBy[id] || [],
      booked: bookedBy[id] || [],
      afterCalls: afterBy[id] || [],
    });
    var t = addInto(emptyTotals(), report);
    addInto(totals, report);
    return Object.assign({ workspaceId: id, name: ids[id] }, deriveRates(t));
  });

  // Busiest first: the offer carrying the month should not be below the one that
  // sold nothing.
  rows.sort(function (a, b) {
    if (b.cashCollected !== a.cashCollected) return b.cashCollected - a.cashCollected;
    return b.closes - a.closes;
  });

  var active = rows.filter(function (r) {
    return r.cashCollected > 0 || r.closes > 0 || r.callsBooked > 0 || r.onCalendar > 0;
  });

  return {
    range: { start: start, end: end },
    totals: deriveRates(totals),
    workspaces: rows,
    workspacesActive: active.length,
    workspacesTotal: rows.length,
  };
}

// Today in the team's timezone. The dashboard opens here, so it has to be the
// same day boundary every other page buckets by — a 9pm PT close belongs to that
// day, not to tomorrow because the server sits in UTC.
export function todayRange() {
  var d = toReportDay(new Date());
  return { start: d, end: d };
}
