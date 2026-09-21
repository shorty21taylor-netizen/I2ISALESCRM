// Where the Cash Collected and Revenue figures on the dashboard came from.
//
// Those two tiles are not a sum. `recalcOverview` takes the HIGHEST of three
// independent measures of the same money and shows that:
//
//   1. the closed-deal forms      (cashCollected, falling back to dealValue)
//   2. the EOD cash split          (cashCollectedMYFM + cashCollectedI2I)
//   3. the EOD revenue box         (revenueOnDay)
//
// Highest, not sum, because a rep who files an EOD *and* submits the deal form
// would otherwise be counted twice — and because the three disagree constantly,
// which is the real thing an operator wants to see. This module does not change
// that choice. It re-derives the same three totals from the same records, under
// the same filters, so it can say which one won, by how much, and out of whose
// books it came.
//
// Pure: no store, no database, no network. Everything is passed in.

import { toReportDay, recordDay } from '@/lib/report-date';

function n(v) {
  var f = parseFloat(v);
  return isFinite(f) ? f : 0;
}

function round(v) {
  return Math.round(v * 100) / 100;
}

function wsOf(record) {
  return (record && record.workspaceId) || 'default';
}

function repOf(record, nameField) {
  return String((record && (record[nameField] || record.closerName)) || '').trim() || 'Unattributed';
}

// The cash one closed-deal record represents, read the same way recalcOverview
// reads it: the collected figure, or the deal's value when nothing was collected.
export function dealCash(deal) {
  return n(deal && deal.cashCollected) || n(deal && deal.dealValue);
}

// The three source labels, in the order the tiles resolve them.
export var SOURCES = [
  { key: 'deals', label: 'Closed-deal forms', note: 'One record per deal filed' },
  { key: 'eodSplit', label: 'EOD cash (MYFM + I2I)', note: 'The two cash boxes on the EOD form' },
  { key: 'eodRevenue', label: 'EOD revenue on the day', note: 'The single revenue box on the EOD form' },
];

// Records in range, filtered exactly as computeOverviewForRange filters them:
// an EOD by the day it is FOR, a deal by the day it was submitted. Those are two
// different questions and the difference is deliberate — an EOD filed on Monday
// for Friday belongs to Friday.
export function inRange(day, start, end) {
  if (!day) return false;
  if (start && day < start) return false;
  if (end && day > end) return false;
  return true;
}

function emptyBucket() {
  return { deals: 0, eodSplit: 0, eodRevenue: 0, dealCount: 0, eodCount: 0 };
}

function addBucket(map, key, patch) {
  if (!map[key]) map[key] = emptyBucket();
  Object.keys(patch).forEach(function(k) { map[key][k] += patch[k]; });
  return map[key];
}

function toRows(map, nameFor) {
  return Object.keys(map).map(function(key) {
    var b = map[key];
    return {
      key: key,
      label: nameFor ? nameFor(key) : key,
      deals: round(b.deals),
      eodSplit: round(b.eodSplit),
      eodRevenue: round(b.eodRevenue),
      dealCount: b.dealCount,
      eodCount: b.eodCount,
    };
  });
}

// opts: { eods, deals, start, end, workspaceNames, dedupe }
//
// `dedupe` is the deduped deal list when the caller has one. It is reported
// alongside, never substituted: the tile shows the undeduped total, so saying
// otherwise here would produce a breakdown that does not add up to the headline.
export function cashProvenance(opts) {
  var options = opts || {};
  var start = options.start || '';
  var end = options.end || '';
  var names = options.workspaceNames || {};

  var eods = (options.eods || []).filter(Boolean).filter(function(e) {
    return inRange(recordDay(e), start, end);
  });
  var allDeals = (options.deals || []).filter(Boolean).filter(function(d) {
    return inRange(toReportDay(d.submittedAt), start, end);
  });

  // Partner business is somebody else's offer sold through this floor. The
  // dashboard tile shows our offers alone and gives partner its own box, so the
  // explanation has to draw the line in the same place — a breakdown that
  // included partner cash would not add up to the figure it is explaining.
  // The caller supplies the test, so this file stays free of the store.
  var isPartner = options.isPartner || function() { return false; };
  var partnerDeals = allDeals.filter(function(d) { return isPartner(d); });
  var deals = allDeals.filter(function(d) { return !isPartner(d); });
  var partnerTotal = round(partnerDeals.reduce(function(t, d) { return t + dealCash(d); }, 0));

  var byWorkspace = {};
  var byRep = {};
  var byDay = {};

  var totals = { deals: 0, eodSplit: 0, eodRevenue: 0 };

  deals.forEach(function(d) {
    var cash = dealCash(d);
    totals.deals += cash;
    addBucket(byWorkspace, wsOf(d), { deals: cash, eodSplit: 0, eodRevenue: 0, dealCount: 1, eodCount: 0 });
    addBucket(byRep, repOf(d, 'closer'), { deals: cash, eodSplit: 0, eodRevenue: 0, dealCount: 1, eodCount: 0 });
    addBucket(byDay, toReportDay(d.submittedAt), { deals: cash, eodSplit: 0, eodRevenue: 0, dealCount: 1, eodCount: 0 });
  });

  eods.forEach(function(e) {
    var split = n(e.cashCollectedMYFM) + n(e.cashCollectedI2I);
    var rev = n(e.revenueOnDay);
    totals.eodSplit += split;
    totals.eodRevenue += rev;
    var patch = { deals: 0, eodSplit: split, eodRevenue: rev, dealCount: 0, eodCount: 1 };
    addBucket(byWorkspace, wsOf(e), patch);
    addBucket(byRep, repOf(e, 'salesRep'), patch);
    addBucket(byDay, recordDay(e), patch);
  });

  totals.deals = round(totals.deals);
  // An EOD carries no program, so its cash cannot be attributed to an offer.
  // Partner cash comes off it on the assumption the rep's day total included
  // the partner deal they filed, floored at zero for the rep who did not.
  totals.eodSplit = round(Math.max(0, totals.eodSplit - partnerTotal));
  totals.eodRevenue = round(Math.max(0, totals.eodRevenue - partnerTotal));

  // Which measure the tile is showing. Ties resolve to the earlier source in
  // SOURCES order, which is the same way Math.max leaves them — and when all
  // three are zero the answer is that there is nothing, not that deals won.
  var winner = null;
  var headline = Math.max(totals.deals, totals.eodSplit, totals.eodRevenue);
  if (headline > 0) {
    for (var i = 0; i < SOURCES.length; i++) {
      if (totals[SOURCES[i].key] === headline) { winner = SOURCES[i].key; break; }
    }
  }

  var sources = SOURCES.map(function(s) {
    return {
      key: s.key, label: s.label, note: s.note,
      total: totals[s.key],
      winning: s.key === winner,
      // How far this measure sits from the one being shown. An operator reading
      // "$9,000 unaccounted for" is being told exactly where to go looking.
      shortfall: round(headline - totals[s.key]),
    };
  });

  // The deals behind the figure, newest first. Capped, because a year's range is
  // thousands of rows and the point is to be able to look, not to ship a ledger.
  var dealRows = deals.slice().sort(function(a, b) {
    return String(b.submittedAt || '').localeCompare(String(a.submittedAt || ''));
  }).map(function(d) {
    return {
      id: d.id,
      date: toReportDay(d.submittedAt) || '',
      client: String(d.leadsName || d.clientName || '').trim() || 'Unnamed',
      rep: repOf(d, 'closer'),
      setter: String(d.setter || '').trim(),
      program: String(d.program || '').trim(),
      cash: round(dealCash(d)),
      collected: round(n(d.cashCollected)),
      dealValue: round(n(d.dealValue)),
      workspaceId: wsOf(d),
      workspace: names[wsOf(d)] || wsOf(d),
    };
  });

  var eodRows = eods.slice().sort(function(a, b) {
    return String(recordDay(b)).localeCompare(String(recordDay(a)));
  }).filter(function(e) {
    // Only the EODs that actually carry money. An EOD with no cash on it is not
    // part of where the cash came from.
    return (n(e.cashCollectedMYFM) + n(e.cashCollectedI2I) + n(e.revenueOnDay)) > 0;
  }).map(function(e) {
    return {
      id: e.id,
      date: recordDay(e) || '',
      rep: repOf(e, 'salesRep'),
      myfm: round(n(e.cashCollectedMYFM)),
      i2i: round(n(e.cashCollectedI2I)),
      split: round(n(e.cashCollectedMYFM) + n(e.cashCollectedI2I)),
      revenue: round(n(e.revenueOnDay)),
      closes: parseInt(e.closes) || 0,
      workspaceId: wsOf(e),
      workspace: names[wsOf(e)] || wsOf(e),
    };
  });

  // Duplicate deals, reported and never silently applied. The tile counts the
  // undeduped total, so quietly subtracting here would hand back a breakdown
  // that disagrees with the number it is explaining.
  var duplicateCash = 0, duplicateCount = 0;
  if (options.dedupe && options.dedupe.removed) {
    (options.dedupe.removed || []).filter(Boolean).forEach(function(d) {
      if (!inRange(toReportDay(d.submittedAt), start, end)) return;
      duplicateCount++;
      duplicateCash += dealCash(d);
    });
  }

  function sortRows(rows, key) {
    return rows.sort(function(a, b) { return (b[key] || 0) - (a[key] || 0); });
  }

  var winKey = winner || 'deals';

  // The combined view takes its maximum over the WHOLE account, not per company,
  // and those are different sums.
  //
  // A company that records its money through deal forms and one that records it
  // through EODs each get credited correctly on their own dashboard. Put them
  // together and the three global totals are compared as wholes, so the larger
  // measure wins outright and the other company's money — recorded only in the
  // measure that lost — is not added to it. The combined figure then reads lower
  // than the two workspaces do separately.
  //
  // recalcOverview owns that choice and is not changed here. But an operator
  // looking at every workspace at once is entitled to know when the number in
  // front of them is smaller than its parts, so it is worked out and reported.
  var workspaceHeadlines = Object.keys(byWorkspace).map(function(id) {
    var b = byWorkspace[id];
    return {
      key: id,
      label: names[id] || id,
      headline: round(Math.max(b.deals, b.eodSplit, b.eodRevenue)),
    };
  }).filter(function(r) { return r.headline > 0; });

  var sumOfParts = round(workspaceHeadlines.reduce(function(t, r) { return t + r.headline; }, 0));
  var understatedBy = round(Math.max(0, sumOfParts - headline));

  return {
    range: { start: start, end: end },
    headline: round(headline),
    winner: winner,
    sources: sources,
    // Ordered by whichever measure is actually being shown, so the biggest
    // contributor to the displayed figure is at the top.
    byWorkspace: sortRows(toRows(byWorkspace, function(id) { return names[id] || id; }), winKey),
    byRep: sortRows(toRows(byRep), winKey),
    byDay: toRows(byDay).sort(function(a, b) { return String(b.key).localeCompare(String(a.key)); }),
    deals: dealRows,
    eods: eodRows,
    counts: { deals: deals.length, eods: eods.length, eodsWithCash: eodRows.length },
    partner: {
      cash: partnerTotal,
      deals: partnerDeals.length,
      rows: partnerDeals.slice().sort(function(a, b) {
        return String(b.submittedAt || '').localeCompare(String(a.submittedAt || ''));
      }).map(function(d) {
        return {
          id: d.id,
          date: toReportDay(d.submittedAt) || '',
          client: String(d.leadsName || d.clientName || '').trim() || 'Unnamed',
          rep: repOf(d, 'closer'),
          program: String(d.program || '').trim(),
          cash: round(dealCash(d)),
          workspace: names[wsOf(d)] || wsOf(d),
        };
      }),
    },
    duplicates: { count: duplicateCount, cash: round(duplicateCash) },
    // Only ever non-zero on a combined, multi-workspace view.
    perWorkspaceHeadlines: workspaceHeadlines,
    sumOfParts: sumOfParts,
    understatedBy: understatedBy,
  };
}
