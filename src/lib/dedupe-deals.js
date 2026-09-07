// One real deal can reach the CRM twice: the closer submits it, and so does the
// setter who booked it. Both records are honest — they are two people reporting the
// same money — so a setter board that simply sums deals would pay a setter twice for
// one close, and reward whoever submits most rather than whoever sets best.
//
// Nothing is deleted. The duplicates are collapsed at read time and reported back, so
// the number on the board can always be traced to the records behind it.

import { canonicalRep } from '@/lib/store';

// Two submissions of the same close can be days apart — in the live data a pair sat
// 27 days apart, because one side filed late. The window has to be generous enough to
// catch that, and tight enough that a client who genuinely buys the same package
// again months later is not silently merged into their first purchase.
export var DUPLICATE_WINDOW_DAYS = 45;

function normalizeName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cashOf(deal) {
  var n = parseFloat(deal && (deal.cashCollected !== undefined ? deal.cashCollected : deal.dealValue));
  return isNaN(n) ? 0 : Math.round(n * 100) / 100;
}

function timeOf(deal) {
  var t = deal && deal.submittedAt ? Date.parse(deal.submittedAt) : NaN;
  return isNaN(t) ? 0 : t;
}

// Which of two reports of the same close should stand? The one that names a setter,
// because that is the attribution the board is built on and the closer's copy
// frequently leaves it blank. Then the earlier one: the original filing.
function preferred(a, b) {
  var aSetter = !!(a.setter && String(a.setter).trim());
  var bSetter = !!(b.setter && String(b.setter).trim());
  if (aSetter !== bSetter) return aSetter ? a : b;

  var aFields = (a.leadsPhone ? 1 : 0) + (a.leadsEmail ? 1 : 0) + (a.program ? 1 : 0);
  var bFields = (b.leadsPhone ? 1 : 0) + (b.leadsEmail ? 1 : 0) + (b.program ? 1 : 0);
  if (aFields !== bFields) return aFields > bFields ? a : b;

  return timeOf(a) <= timeOf(b) ? a : b;
}

// deals -> { deals: one record per real close, groups: what was merged, merged: count }
export function dedupeDeals(deals, options) {
  var windowDays = (options && options.windowDays) || DUPLICATE_WINDOW_DAYS;
  var windowMs = windowDays * 24 * 60 * 60 * 1000;

  var buckets = {};
  (deals || []).forEach(function(deal) {
    if (!deal) return;
    var name = normalizeName(deal.leadsName);
    // A deal with no lead name cannot be matched to anything; it stands on its own.
    var key = name ? name + '|' + cashOf(deal) : 'unmatched|' + (deal.id || Math.random());
    if (!buckets[key]) buckets[key] = [];
    buckets[key].push(deal);
  });

  var kept = [];
  var groups = [];

  Object.keys(buckets).forEach(function(key) {
    var rows = buckets[key].slice().sort(function(a, b) { return timeOf(a) - timeOf(b); });

    // Walk the bucket in time order, starting a new cluster whenever the gap from the
    // cluster's first record exceeds the window.
    var cluster = [rows[0]];
    var clusters = [cluster];
    for (var i = 1; i < rows.length; i++) {
      if (timeOf(rows[i]) - timeOf(cluster[0]) <= windowMs) {
        cluster.push(rows[i]);
      } else {
        cluster = [rows[i]];
        clusters.push(cluster);
      }
    }

    clusters.forEach(function(members) {
      var winner = members[0];
      for (var j = 1; j < members.length; j++) winner = preferred(winner, members[j]);
      kept.push(winner);

      if (members.length > 1) {
        groups.push({
          leadsName: winner.leadsName || '',
          cashCollected: cashOf(winner),
          kept: winner.id,
          merged: members.filter(function(m) { return m.id !== winner.id; }).map(function(m) {
            return {
              id: m.id,
              submittedAt: m.submittedAt || '',
              closer: m.closer || '',
              setter: m.setter || '',
            };
          }),
        });
      }
    });
  });

  var mergedCount = groups.reduce(function(n, g) { return n + g.merged.length; }, 0);
  return { deals: kept, groups: groups, merged: mergedCount };
}

// Setter standings, built on the deduped deals so one close counts once no matter how
// many people filed it. Booked calls come from the booking form and are counted per
// setter as their own effort.
export function computeSetterBoard(deals, bookedCalls) {
  var setters = {};

  function rowFor(name) {
    var clean = canonicalRep(name);
    if (!clean) return null;
    var key = clean.toLowerCase();
    if (!setters[key]) {
      setters[key] = {
        name: clean, closes: 0, cash: 0, booked: 0,
        biggest: 0, lastActivity: null,
      };
    }
    return setters[key];
  }

  (deals || []).forEach(function(deal) {
    var row = rowFor(deal.setter);
    if (!row) return;
    var cash = cashOf(deal);
    row.closes++;
    row.cash += cash;
    if (cash > row.biggest) row.biggest = cash;
    if (deal.submittedAt && (!row.lastActivity || deal.submittedAt > row.lastActivity)) {
      row.lastActivity = deal.submittedAt;
    }
  });

  (bookedCalls || []).forEach(function(call) {
    var row = rowFor(call.setter);
    if (!row) return;
    row.booked++;
    if (call.submittedAt && (!row.lastActivity || call.submittedAt > row.lastActivity)) {
      row.lastActivity = call.submittedAt;
    }
  });

  var rows = Object.keys(setters).map(function(k) {
    var row = setters[k];
    row.cash = Math.round(row.cash * 100) / 100;
    row.avgDeal = row.closes > 0 ? Math.round(row.cash / row.closes) : 0;
    // Of the calls this setter booked, how many turned into a close — reported only
    // when it can be trusted. Booking records are filed inconsistently, so closes
    // often exceed booked calls; capping that at "100%" would read as perfection
    // when it actually means the bookings were never logged.
    row.closeRate = (row.booked > 0 && row.closes <= row.booked)
      ? Math.round((row.closes / row.booked) * 100)
      : null;
    return row;
  });

  rows.sort(function(a, b) { return (b.cash - a.cash) || (b.closes - a.closes) || (b.booked - a.booked); });
  rows.forEach(function(row, i) { row.rank = i + 1; });
  return rows;
}
