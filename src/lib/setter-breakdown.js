// Per-setter numbers, which the setter board alone cannot answer.
//
// computeSetterBoard ranks setters by what their sets turned into — bookings,
// closes, cash. That is the leaderboard question. A setter's dashboard has to
// answer the working question too: how many dials, how many conversations, how
// many sets, and what each of those turned into on the way down.
//
// The dials and conversations only exist in the EODs; the bookings and the cash
// only exist in the forms. This joins them by rep and keeps the two straight.
//
// Pure: everything is passed in.

import { recordDay } from '@/lib/report-date';

function n(v) {
  var f = parseFloat(v);
  return isFinite(f) ? f : 0;
}

function key(name) {
  return String(name || '').trim().toLowerCase();
}

function pct(part, whole) {
  if (!whole || whole <= 0) return null;
  return Math.round((part / whole) * 1000) / 10;
}

function blank(name) {
  return {
    name: name,
    dials: 0, conversations: 0, liveCalls: 0,
    setsReported: 0, followUps: 0,
    setsFromForms: 0, closes: 0, cash: 0, biggest: 0,
    daysReported: 0, lastActivity: null,
    days: {},
  };
}

// eods: already filtered to the range and the workspace.
// board: the output of computeSetterBoard over the same range.
export function setterBreakdown(eods, board) {
  var rows = {};

  function rowFor(name) {
    var clean = String(name || '').trim();
    if (!clean) return null;
    var k = key(clean);
    if (!rows[k]) rows[k] = blank(clean);
    return rows[k];
  }

  (eods || []).filter(Boolean).forEach(function(e) {
    var row = rowFor(e.salesRep || e.closerName);
    if (!row) return;
    row.dials += n(e.outboundDials) || n(e.totalDials);
    row.conversations += n(e.conversations);
    row.liveCalls += n(e.liveCalls);
    row.setsReported += n(e.sets);
    row.followUps += n(e.followUpsScheduled);
    var day = recordDay(e);
    if (day) row.days[day] = true;
  });

  (board || []).filter(Boolean).forEach(function(b) {
    var row = rowFor(b.name);
    if (!row) return;
    row.setsFromForms += n(b.booked);
    row.closes += n(b.closes);
    row.cash += n(b.cash);
    if (n(b.biggest) > row.biggest) row.biggest = n(b.biggest);
    if (b.lastActivity && (!row.lastActivity || b.lastActivity > row.lastActivity)) {
      row.lastActivity = b.lastActivity;
    }
  });

  return Object.keys(rows).map(function(k) {
    var r = rows[k];
    r.daysReported = Object.keys(r.days).length;
    delete r.days;

    // The higher of the two, never the sum — the same rule the team tiles use.
    // A setter who books four calls in the morning has those forms in hand long
    // before they write the evening EOD that also reports them; adding the two
    // would count every set twice.
    r.sets = Math.max(r.setsReported, r.setsFromForms);
    r.cash = Math.round(r.cash * 100) / 100;

    r.dialToConversation = pct(r.conversations, r.dials);
    r.conversationToSet = pct(r.sets, r.conversations);
    r.setToClose = pct(r.closes, r.sets);
    r.cashPerSet = r.sets > 0 ? Math.round((r.cash / r.sets) * 100) / 100 : null;
    return r;
  }).sort(function(a, b) {
    if (b.cash !== a.cash) return b.cash - a.cash;
    return b.sets - a.sets;
  });
}
