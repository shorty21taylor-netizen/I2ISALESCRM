// One place that answers "how did the sales process actually perform between
// two dates". Pure: it takes records in, returns numbers out, and never touches
// the store or the network, so the API route, the analytics page and the printed
// report all read from the same arithmetic.
import { dedupeDeals } from '@/lib/dedupe-deals';
import { toReportDay } from '@/lib/report-date';
import { GROUP_LABELS } from '@/lib/rep-groups';

function n(v) {
  var x = parseFloat(v);
  return isFinite(x) ? x : 0;
}

function sum(arr, field) {
  return arr.reduce(function(s, x) { return s + n(x[field]); }, 0);
}

// Rates are reported as null, not zero, when there is nothing to divide by — a
// close rate of "0%" on a day nobody pitched is a lie, and it drags averages down.
function rate(num, den) {
  if (!den || den <= 0) return null;
  return Math.round((num / den) * 1000) / 10;
}

function money(v) { return Math.round(n(v) * 100) / 100; }

// One EOD may carry the closer-only field, the setter's "Sets", or both.
function bookedOn(e) {
  return Math.max(n(e.netNewCallsBooked), n(e.sets));
}

// The n8n form asks for one cash figure; the in-app form splits it. Take whichever
// the record actually carries, never both.
function cashOn(e) {
  var split = n(e.cashCollectedMYFM) + n(e.cashCollectedI2I);
  if (split) return split;
  return n(e.revenueOnDay) || n(e.cashCollected);
}

function normName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ');
}

function keyOf(name) { return normName(name).toLowerCase(); }

// Closer | Setter | DM Setter. The EOD form's Position answer wins; when it is
// missing we fall back to the shape of the answers, the same way form-ingest does.
export function repGroup(position, row) {
  var p = String(position || '').toLowerCase();
  if (p.indexOf('dm') !== -1 || p.indexOf('social') !== -1 || p.indexOf('instagram') !== -1) return 'dmSetters';
  if (p.indexOf('setter') !== -1) return 'setters';
  if (p.indexOf('closer') !== -1) return 'closers';
  if (row) {
    // A rep with conversations but no dials is working DMs, not the phone.
    if (n(row.conversations) > 0 && n(row.outboundDials) === 0 && n(row.callsTaken) === 0) return 'dmSetters';
    if (n(row.sets) > 0 || n(row.outboundDials) > 0) return 'setters';
    if (n(row.callsTaken) > 0 || n(row.callsTakenAndPitched) > 0) return 'closers';
  }
  return 'closers';
}

export { GROUP_LABELS };

function inRange(day, start, end) {
  if (!day) return false;
  if (start && day < start) return false;
  if (end && day > end) return false;
  return true;
}

function emptyRep(name, group) {
  return {
    name: name,
    group: group,
    daysReported: 0,
    dials: 0,
    conversations: 0,
    liveCalls: 0,
    sets: 0,
    followUps: 0,
    onCalendar: 0,
    taken: 0,
    noShowed: 0,
    canceled: 0,
    rescheduled: 0,
    pitched: 0,
    closes: 0,
    eodCash: 0,
    dealCash: 0,
    deals: 0,
    afterCalls: 0,
    bookedForms: 0,
    setCredits: 0,
  };
}

// The headline set for a high-ticket floor: every stage of the funnel, the
// leakage between stages, and what each stage is worth in cash.
export function computeSalesReport(input) {
  var opts = input || {};
  var start = opts.start || '';
  var end = opts.end || '';

  var allEods = opts.eods || [];
  var allDeals = opts.deals || [];
  var allBooked = opts.booked || [];
  var allAfter = opts.afterCalls || [];

  var eods = allEods.filter(function(e) {
    return inRange(e.date || toReportDay(e.submittedAt), start, end);
  });
  var rawDeals = allDeals.filter(function(d) {
    return inRange(toReportDay(d.submittedAt), start, end);
  });
  var booked = allBooked.filter(function(b) {
    return inRange(toReportDay(b.submittedAt), start, end);
  });
  var afterCalls = allAfter.filter(function(a) {
    return inRange(toReportDay(a.submittedAt), start, end);
  });

  // Cash always comes from deduped deals. The same close filed by both the setter
  // and the closer is one deal, not two.
  var deduped = dedupeDeals(rawDeals);
  var deals = deduped.deals || deduped;
  var duplicatesRemoved = rawDeals.length - deals.length;
  var duplicateCash = money(sum(rawDeals, 'cashCollected') - sum(deals, 'cashCollected'));

  // ---- funnel ----
  var dials = sum(eods, 'outboundDials');
  var conversations = sum(eods, 'conversations');
  var liveCalls = sum(eods, 'liveCalls');
  var sets = eods.reduce(function(t, e) { return t + bookedOn(e); }, 0);
  var onCalendar = sum(eods, 'callsOnCalendar');
  var taken = sum(eods, 'callsTaken');
  var noShowed = sum(eods, 'callsNoShowed');
  var canceled = sum(eods, 'callsCanceled');
  var rescheduled = sum(eods, 'callsRescheduled');
  var pitched = sum(eods, 'callsTakenAndPitched');
  var closes = sum(eods, 'closes');
  var followUps = sum(eods, 'followUpsScheduled');

  // The number the floor actually argues about: showed up, heard the offer,
  // and said no.
  var offeredNoClose = Math.max(0, pitched - closes);
  var showedNotPitched = Math.max(0, taken - pitched);

  var cashCollected = money(sum(deals, 'cashCollected'));
  var eodCash = money(eods.reduce(function(t, e) { return t + cashOn(e); }, 0));

  var dayKeys = {};
  eods.forEach(function(e) { if (e.date) dayKeys[e.date] = true; });
  var daysReported = Object.keys(dayKeys).length;

  var funnel = [
    { stage: 'Outbound dials', value: dials, of: null },
    { stage: 'Conversations', value: conversations, of: dials },
    { stage: 'Calls booked', value: sets, of: conversations || dials },
    { stage: 'On calendar', value: onCalendar, of: sets },
    { stage: 'Showed', value: taken, of: onCalendar },
    { stage: 'Offer made', value: pitched, of: taken },
    { stage: 'Closed', value: closes, of: pitched },
  ];

  var rates = {
    dialToConversation: rate(conversations, dials),
    conversationToSet: rate(sets, conversations),
    dialToSet: rate(sets, dials),
    showRate: rate(taken, onCalendar),
    noShowRate: rate(noShowed, onCalendar),
    cancelRate: rate(canceled, onCalendar),
    rescheduleRate: rate(rescheduled, onCalendar),
    pitchRate: rate(pitched, taken),
    closeRateOfOffers: rate(closes, pitched),
    closeRateOfShows: rate(closes, taken),
    closeRateOfCalendar: rate(closes, onCalendar),
    offerDeclineRate: rate(offeredNoClose, pitched),
    dialToClose: rate(closes, dials),
  };

  var cash = {
    collected: cashCollected,
    fromEod: eodCash,
    dealCount: deals.length,
    avgDeal: deals.length ? Math.round(cashCollected / deals.length) : 0,
    perOffer: pitched ? Math.round(cashCollected / pitched) : 0,
    perShow: taken ? Math.round(cashCollected / taken) : 0,
    perBookedCall: sets ? Math.round(cashCollected / sets) : 0,
    perDial: dials ? Math.round((cashCollected / dials) * 100) / 100 : 0,
    perDay: daysReported ? Math.round(cashCollected / daysReported) : 0,
    myfm: money(sum(eods, 'cashCollectedMYFM')),
    i2i: money(sum(eods, 'cashCollectedI2I')),
    duplicatesRemoved: duplicatesRemoved,
    duplicateCash: duplicateCash,
  };

  // ---- inbound / outbound and program mix ----
  var inbound = deals.filter(function(d) {
    return String(d.outboundInbound || '').toLowerCase().indexOf('in') === 0;
  });
  var source = {
    inboundCash: money(sum(inbound, 'cashCollected')),
    inboundDeals: inbound.length,
    outboundCash: money(cashCollected - sum(inbound, 'cashCollected')),
    outboundDeals: deals.length - inbound.length,
  };

  var programMap = {};
  deals.forEach(function(d) {
    var p = normName(d.program) || 'Unspecified';
    if (!programMap[p]) programMap[p] = { name: p, deals: 0, cash: 0 };
    programMap[p].deals++;
    programMap[p].cash += n(d.cashCollected);
  });
  var programs = Object.keys(programMap).map(function(k) {
    var p = programMap[k];
    p.cash = money(p.cash);
    p.avg = p.deals ? Math.round(p.cash / p.deals) : 0;
    return p;
  }).sort(function(a, b) { return b.cash - a.cash; });

  // ---- after-call reports ----
  var outcomeMap = {};
  afterCalls.forEach(function(a) {
    var o = normName(a.outcome) || 'Unspecified';
    outcomeMap[o] = (outcomeMap[o] || 0) + 1;
  });
  var afterCallOutcomes = Object.keys(outcomeMap).map(function(k) {
    return { outcome: k, count: outcomeMap[k], share: rate(outcomeMap[k], afterCalls.length) };
  }).sort(function(a, b) { return b.count - a.count; });

  // ---- booked-call forms ----
  var qualified = booked.filter(function(b) { return b.qualified === true || b.qualified === 'yes'; }).length;
  var bookedForms = {
    filed: booked.length,
    qualified: qualified,
    unqualified: booked.length - qualified,
    qualifiedRate: rate(qualified, booked.length),
  };

  // ---- per rep, grouped by what they actually do ----
  var repMap = {};
  function repFor(name, group) {
    var k = keyOf(name);
    if (!k) return null;
    if (!repMap[k]) repMap[k] = emptyRep(normName(name), group);
    // A rep who ever files as a closer is a closer, whatever a stray row says.
    if (group === 'closers') repMap[k].group = 'closers';
    return repMap[k];
  }

  eods.forEach(function(e) {
    var name = e.salesRep || e.closerName;
    var r = repFor(name, repGroup(e.position || e.role, e));
    if (!r) return;
    r.daysReported++;
    r.dials += n(e.outboundDials);
    r.conversations += n(e.conversations);
    r.liveCalls += n(e.liveCalls);
    r.sets += bookedOn(e);
    r.followUps += n(e.followUpsScheduled);
    r.onCalendar += n(e.callsOnCalendar);
    r.taken += n(e.callsTaken);
    r.noShowed += n(e.callsNoShowed);
    r.canceled += n(e.callsCanceled);
    r.rescheduled += n(e.callsRescheduled);
    r.pitched += n(e.callsTakenAndPitched);
    r.closes += n(e.closes);
    r.eodCash += cashOn(e);
  });

  deals.forEach(function(d) {
    var r = repFor(d.closer, 'closers');
    if (r) { r.dealCash += n(d.cashCollected); r.deals++; }
    var setterName = normName(d.setter);
    // Self-set deals earn the closer credit once, not twice.
    if (setterName && keyOf(setterName) !== keyOf(d.closer)) {
      var sr = repFor(setterName, 'setters');
      if (sr) sr.setCredits++;
    }
  });

  afterCalls.forEach(function(a) {
    var r = repFor(a.closer, 'closers');
    if (r) r.afterCalls++;
  });

  booked.forEach(function(b) {
    var r = repFor(b.setter, 'setters');
    if (r) r.bookedForms++;
  });

  var groups = { closers: [], setters: [], dmSetters: [] };
  Object.keys(repMap).forEach(function(k) {
    var r = repMap[k];
    r.dealCash = money(r.dealCash);
    r.eodCash = money(r.eodCash);
    r.cash = Math.max(r.dealCash, r.eodCash);
    r.offeredNoClose = Math.max(0, r.pitched - r.closes);
    r.showRate = rate(r.taken, r.onCalendar);
    r.closeRate = rate(r.closes, r.pitched);
    r.pitchRate = rate(r.pitched, r.taken);
    r.dialToSet = rate(r.sets, r.dials);
    r.avgDialsPerDay = r.daysReported ? Math.round(r.dials / r.daysReported) : 0;
    r.avgDeal = r.deals ? Math.round(r.dealCash / r.deals) : 0;
    (groups[r.group] || groups.closers).push(r);
  });

  function sortGroup(rows, field) {
    return rows.sort(function(a, b) { return n(b[field]) - n(a[field]); });
  }
  groups.closers = sortGroup(groups.closers, 'cash');
  groups.setters = sortGroup(groups.setters, 'sets');
  groups.dmSetters = sortGroup(groups.dmSetters, 'sets');

  // ---- daily series ----
  var dailyMap = {};
  function dayRow(key) {
    if (!dailyMap[key]) {
      dailyMap[key] = { date: key, dials: 0, conversations: 0, sets: 0, taken: 0,
        pitched: 0, closes: 0, noShowed: 0, cash: 0, dealCash: 0, eodCash: 0 };
    }
    return dailyMap[key];
  }
  eods.forEach(function(e) {
    if (!e.date) return;
    var d = dayRow(e.date);
    d.dials += n(e.outboundDials);
    d.conversations += n(e.conversations);
    d.sets += bookedOn(e);
    d.taken += n(e.callsTaken);
    d.pitched += n(e.callsTakenAndPitched);
    d.closes += n(e.closes);
    d.noShowed += n(e.callsNoShowed);
    d.eodCash += cashOn(e);
  });
  deals.forEach(function(dl) {
    dayRow(toReportDay(dl.submittedAt)).dealCash += n(dl.cashCollected);
  });
  var daily = Object.keys(dailyMap).sort().map(function(k) {
    var d = dailyMap[k];
    // Same rule the rest of the CRM uses: a day's cash is the larger of what the
    // deal forms say and what the EODs say, never the two added together.
    d.cash = money(Math.max(d.dealCash, d.eodCash));
    d.dealCash = money(d.dealCash);
    d.eodCash = money(d.eodCash);
    return d;
  });

  var repsReporting = Object.keys(repMap).length;

  return {
    range: {
      start: start,
      end: end,
      daysReported: daysReported,
      repsReporting: repsReporting,
    },
    volume: {
      dials: dials,
      conversations: conversations,
      liveCalls: liveCalls,
      sets: sets,
      onCalendar: onCalendar,
      taken: taken,
      noShowed: noShowed,
      canceled: canceled,
      rescheduled: rescheduled,
      pitched: pitched,
      closes: closes,
      offeredNoClose: offeredNoClose,
      showedNotPitched: showedNotPitched,
      followUps: followUps,
      talkTime: eods.map(function(e) { return e.talkTime; }).filter(Boolean),
    },
    funnel: funnel,
    rates: rates,
    cash: cash,
    source: source,
    programs: programs,
    reporting: {
      eodsFiled: eods.length,
      afterCallsFiled: afterCalls.length,
      afterCallOutcomes: afterCallOutcomes,
      bookedForms: bookedForms,
      dealsFiled: rawDeals.length,
      dealsAfterDedupe: deals.length,
    },
    groups: groups,
    daily: daily,
  };
}
