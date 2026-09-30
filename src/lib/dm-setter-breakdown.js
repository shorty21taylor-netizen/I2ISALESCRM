// The DM setter's funnel, worked out here so the model and the page never have
// to. It starts in the inbox, not on the phone:
//
//   new leads -> conversations started -> calls booked -> showed -> closed -> cash
//
// with two side stories that matter as much as the funnel itself: leads that
// went ghost, and dead leads brought back. A DM setter who reactivates ten dead
// leads a week is doing work no stage of the funnel above records.
//
// Pure: everything is passed in.

import { recordDay } from '@/lib/report-date';
import { isDmSetterReport } from '@/lib/eod-role';

function n(v) {
  var f = parseFloat(v);
  return isFinite(f) ? f : 0;
}

function key(name) {
  return String(name || '').trim().toLowerCase();
}

// Every division goes through this, and it answers null rather than Infinity or
// NaN. A null is "we cannot know this", which the page prints as an em dash.
// Zero would be a claim, and a false one.
function pct(part, whole) {
  if (!whole || whole <= 0) return null;
  return Math.round((part / whole) * 1000) / 10;
}

function per(part, whole) {
  if (!whole || whole <= 0) return null;
  return Math.round((part / whole) * 100) / 100;
}

function cashOf(e) {
  var split = n(e.cashCollectedMYFM) + n(e.cashCollectedI2I);
  if (split) return split;
  return n(e.cashCollected) || n(e.revenueOnDay);
}

// The booked-call count, read the same way the ingest writes it.
function bookedOf(e) {
  return n(e.netNewCallsBooked) || n(e.callsBooked) || n(e.sets);
}

function blankTotals() {
  return {
    reports: 0, newLeads: 0, conversations: 0, booked: 0, showed: 0,
    closes: 0, cash: 0, ghosted: 0, reactivated: 0,
  };
}

function addInto(t, e) {
  t.reports++;
  t.newLeads += n(e.newLeads);
  t.conversations += n(e.conversations);
  t.booked += bookedOf(e);
  t.showed += n(e.setsShowed);
  t.closes += n(e.closes);
  t.cash += cashOf(e);
  t.ghosted += n(e.leadsGhosted);
  t.reactivated += n(e.leadsReactivated);
  return t;
}

function settle(t) {
  t.cash = Math.round(t.cash * 100) / 100;
  return t;
}

export function dmRatesFor(t) {
  return {
    // Each stage against the one before it, so a drop-off is attributable to a
    // step rather than to the whole funnel.
    leadToConversation: pct(t.conversations, t.newLeads),
    conversationToBooked: pct(t.booked, t.conversations),
    showRate: pct(t.showed, t.booked),
    showToClose: pct(t.closes, t.showed),
    // End to end, which is the number an operator actually budgets against.
    leadToClose: pct(t.closes, t.newLeads),
    ghostRate: pct(t.ghosted, t.conversations),
    cashPerLead: per(t.cash, t.newLeads),
    cashPerConversation: per(t.cash, t.conversations),
    cashPerBooked: per(t.cash, t.booked),
    avgDealSize: per(t.cash, t.closes),
  };
}

// reports: EODs already filtered to the range and the workspace.
export function dmSetterBreakdown(reports) {
  var rows = (reports || []).filter(Boolean).filter(isDmSetterReport);

  var byRep = {};
  rows.forEach(function(e) {
    var name = String(e.salesRep || e.closerName || '').trim();
    if (!name) return;
    var k = key(name);
    if (!byRep[k]) {
      byRep[k] = { name: name, totals: blankTotals(), days: {}, themes: [], bottlenecks: [] };
    }
    var row = byRep[k];
    addInto(row.totals, e);
    var day = recordDay(e);
    if (day) row.days[day] = true;

    // What they wrote, kept with its date. This is the half of a DM setter's
    // report that never becomes a number, and it is usually the half that says
    // why the numbers moved.
    var themes = String(e.commonThemes || '').trim();
    if (themes) row.themes.push({ date: day, text: themes });
    var block = String(e.biggestBottleneck || '').trim();
    if (block) row.bottlenecks.push({ date: day, text: block });
  });

  var reps = Object.keys(byRep).map(function(k) {
    var row = byRep[k];
    var totals = settle(row.totals);
    return {
      name: row.name,
      daysReported: Object.keys(row.days).length,
      totals: totals,
      rates: dmRatesFor(totals),
      themes: row.themes,
      bottlenecks: row.bottlenecks,
    };
  }).sort(function(a, b) {
    if (b.totals.cash !== a.totals.cash) return b.totals.cash - a.totals.cash;
    return b.totals.booked - a.totals.booked;
  });

  var team = settle(rows.reduce(function(t, e) { return addInto(t, e); }, blankTotals()));

  var days = {};
  rows.forEach(function(e) { var d = recordDay(e); if (d) days[d] = true; });

  return {
    reportCount: rows.length,
    repCount: reps.length,
    daysReported: Object.keys(days).length,
    team: { totals: team, rates: dmRatesFor(team) },
    reps: reps,
  };
}
