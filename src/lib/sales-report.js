// One place that answers "how did the sales process actually perform between
// two dates". Pure: it takes records in, returns numbers out, and never touches
// the store or the network, so the API route, the analytics page and the printed
// report all read from the same arithmetic.
import { dedupeDeals } from '@/lib/dedupe-deals';
import { toReportDay } from '@/lib/report-date';
import { GROUP_LABELS } from '@/lib/rep-groups';
import { EOD_SANITY_LIMITS } from '@/lib/form-ingest';

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

// Some rates measure a subset of their own denominator: a rep cannot hold more
// calls than were on the calendar, or make more offers than they held calls. A
// figure over 100% there is not a fast month, it is bad data, and printing
// "2800% show rate" on a report sent to a client is worse than printing nothing.
function boundedRate(num, den, label, quality) {
  var value = rate(num, den);
  if (value === null) return null;
  if (value > 100) {
    quality.impossible.push({ metric: label, value: value, numerator: num, denominator: den });
    return null;
  }
  return value;
}

function money(v) { return Math.round(n(v) * 100) / 100; }

// One EOD may carry the closer-only field, the setter's "Sets", or both.
function bookedOn(e) {
  return Math.max(n(e.netNewCallsBooked), n(e.sets));
}

// Every count is gated once, here, and every later pass reads the cleaned row.
// Gating inside each pass would count the same rejection three times over.
var GATED_FIELDS = Object.keys(EOD_SANITY_LIMITS);

function sanitizeEod(record, quality) {
  var clean = Object.assign({}, record);
  for (var i = 0; i < GATED_FIELDS.length; i++) {
    clean[GATED_FIELDS[i]] = counted(record, GATED_FIELDS[i], quality);
  }
  return clean;
}

// The n8n form asks for one cash figure; the in-app form splits it. Take whichever
// the record actually carries, never both.
function cashOn(e) {
  var split = n(e.cashCollectedMYFM) + n(e.cashCollectedI2I);
  if (split) return split;
  return n(e.revenueOnDay) || n(e.cashCollected);
}


// The ingest form already knows what a count can plausibly be; a report built
// months later should hold the same line. A value past that limit is not counted
// and is named in the report's data-quality block, so the source can be fixed.
function counted(record, field, quality) {
  var value = n(record[field]);
  var limit = EOD_SANITY_LIMITS[field];
  if (limit && value > limit) {
    quality.rejected.push({
      rep: normName(record.salesRep || record.closerName) || 'Unnamed rep',
      date: record.date || '',
      field: field,
      value: value,
      limit: limit,
    });
    return 0;
  }
  if (value > 0) quality.reported[field] = (quality.reported[field] || 0) + 1;
  return value;
}

// A field nobody fills is not a field that is zero. Rates built on an untracked
// field read as "0% of dials" or "$3,539 per dial", which are worse than silence.
function tracked(quality, field) {
  // A booked call arrives as the closer's "Net new calls booked" or the setter's
  // "Sets"; either one means the stage is being reported.
  if (field === 'netNewCallsBooked') {
    return (quality.reported.netNewCallsBooked || 0) > 0 || (quality.reported.sets || 0) > 0;
  }
  return (quality.reported[field] || 0) > 0;
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
    reportedCalendar: 0,
    onCalendar: 0,
    taken: 0,
    noShowed: 0,
    canceled: 0,
    rescheduled: 0,
    pitched: 0,
    closes: 0,
    eodCloses: 0,
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
  var quality = { rejected: [], impossible: [], reported: {}, eodsInRange: eods.length, derivedCalendar: false };
  // Below this share of the range's reports, a count is too patchy to divide by.
  var MIN_COVERAGE_SHARE = 0.25;
  function coverageOk(field) {
    var reported = (quality.reported[field] || 0);
    if (field === 'netNewCallsBooked') reported = Math.max(reported, quality.reported.sets || 0);
    if (!reported || !eods.length) return false;
    return reported / eods.length >= MIN_COVERAGE_SHARE;
  }
  var clean = eods.map(function(e) { return sanitizeEod(e, quality); });
  function total(field) { return sum(clean, field); }

  var dials = total('outboundDials');
  var conversations = total('conversations');
  var liveCalls = total('liveCalls');
  var sets = clean.reduce(function(t, e) { return t + bookedOn(e); }, 0);
  var reportedCalendar = total('callsOnCalendar');
  var taken = total('callsTaken');
  var noShowed = total('callsNoShowed');
  var canceled = total('callsCanceled');
  var rescheduled = total('callsRescheduled');
  var pitched = total('callsTakenAndPitched');
  var eodCloses = total('closes');
  var closes = deals.length;
  var followUps = total('followUpsScheduled');

  // Reps skip "Calls On Calendar" far more often than they skip the outcomes, and
  // a show rate divided by a field nobody fills is how you get 2800%. The calendar
  // is, by definition, at least everything that happened to those calls.
  var dialCoverageOk = coverageOk('outboundDials');
  var calendarTracked = tracked(quality, 'callsOnCalendar') || tracked(quality, 'callsTaken')
    || tracked(quality, 'callsNoShowed') || tracked(quality, 'callsCanceled')
    || tracked(quality, 'callsRescheduled');
  var settledCalls = taken + noShowed + canceled + rescheduled;
  var onCalendar = Math.max(reportedCalendar, settledCalls);
  quality.derivedCalendar = onCalendar > reportedCalendar;

  // The number the floor actually argues about: showed up, heard the offer,
  // and said no.
  var offeredNoClose = Math.max(0, pitched - closes);
  // Worth surfacing when the two sources disagree: one of them is being skipped.
  var closesDisagree = Math.abs(eodCloses - closes);
  var showedNotPitched = Math.max(0, taken - pitched);

  var cashCollected = money(sum(deals, 'cashCollected'));
  var eodCash = money(clean.reduce(function(t, e) { return t + cashOn(e); }, 0));

  var dayKeys = {};
  clean.forEach(function(e) { if (e.date) dayKeys[e.date] = true; });
  var daysReported = Object.keys(dayKeys).length;

  // Each stage carries its own conversion, computed under the same rules as every
  // other rate, so neither page has to decide when a division is meaningful.
  // A stage whose feeder field is barely reported gets no conversion at all -
  // that is where "1135% of calls booked landed on the calendar" comes from.
  function stageConversion(value, from, fromField, subsetOfFrom) {
    if (fromField && !coverageOk(fromField)) return null;
    var r = rate(value, from);
    if (r === null) return null;
    if (subsetOfFrom && r > 100) return null;
    return r;
  }

  var funnel = [
    { stage: 'Outbound dials', value: dials, conversion: null },
    { stage: 'Conversations', value: conversations,
      conversion: tracked(quality, 'conversations') ? stageConversion(conversations, dials, 'outboundDials', true) : null },
    { stage: 'Calls booked', value: sets,
      conversion: stageConversion(sets, conversations || dials, conversations ? 'conversations' : 'outboundDials', true) },
    { stage: 'On calendar', value: onCalendar,
      conversion: stageConversion(onCalendar, sets, 'netNewCallsBooked', false) },
    { stage: 'Showed', value: taken,
      conversion: calendarTracked ? stageConversion(taken, onCalendar, null, true) : null },
    { stage: 'Offer made', value: pitched,
      conversion: stageConversion(pitched, taken, 'callsTaken', true) },
    { stage: 'Closed', value: closes,
      conversion: stageConversion(closes, pitched, 'callsTakenAndPitched', true) },
  ];

  // A rate is only computed when both of its fields are actually being reported,
  // and only over the reports that carry the denominator, so the two sides of the
  // division describe the same population.
  function pairRate(numField, denField, numOf) {
    if (!tracked(quality, numField) || !coverageOk(denField)) return null;
    var num = 0, den = 0;
    clean.forEach(function(e) {
      var d = n(e[denField]);
      if (d <= 0) return;
      den += d;
      num += numOf ? numOf(e) : n(e[numField]);
    });
    return rate(num, den);
  }
  function subset(num, den, numField, denField, label) {
    if (!tracked(quality, numField) || !tracked(quality, denField)) return null;
    return boundedRate(num, den, label, quality);
  }
  function ofCalendar(num, numField, label) {
    if (!tracked(quality, numField) || !calendarTracked) return null;
    return boundedRate(num, onCalendar, label, quality);
  }

  var rates = {
    dialToConversation: pairRate('conversations', 'outboundDials'),
    conversationToSet: pairRate('netNewCallsBooked', 'conversations', bookedOn),
    dialToSet: pairRate('netNewCallsBooked', 'outboundDials', bookedOn),
    showRate: ofCalendar(taken, 'callsTaken', 'Show rate'),
    noShowRate: ofCalendar(noShowed, 'callsNoShowed', 'No-show rate'),
    cancelRate: ofCalendar(canceled, 'callsCanceled', 'Cancel rate'),
    rescheduleRate: ofCalendar(rescheduled, 'callsRescheduled', 'Reschedule rate'),
    pitchRate: subset(pitched, taken, 'callsTakenAndPitched', 'callsTaken', 'Pitch rate'),
    closeRateOfOffers: subset(closes, pitched, 'callsTakenAndPitched', 'callsTakenAndPitched', 'Close rate of offers'),
    closeRateOfShows: subset(closes, taken, 'callsTaken', 'callsTaken', 'Close rate of shows'),
    closeRateOfCalendar: ofCalendar(closes, 'callsTaken', 'Close rate of calendar'),
    offerDeclineRate: subset(offeredNoClose, pitched, 'callsTakenAndPitched', 'callsTakenAndPitched', 'Offer decline rate'),
    dialToClose: dialCoverageOk ? rate(closes, dials) : null,
  };

  // "$3,539 per dial" is what you get when one rep logged 50 dials and nobody else
  // logged any. Per-stage cash is null unless the stage is actually being counted.
  function per(field, den, decimals) {
    if (!coverageOk(field) || !den || den <= 0) return null;
    return decimals ? Math.round((cashCollected / den) * 100) / 100 : Math.round(cashCollected / den);
  }

  var cash = {
    collected: cashCollected,
    fromEod: eodCash,
    dealCount: deals.length,
    avgDeal: deals.length ? Math.round(cashCollected / deals.length) : 0,
    perOffer: per('callsTakenAndPitched', pitched),
    perShow: per('callsTaken', taken),
    perBookedCall: per('netNewCallsBooked', sets),
    perDial: per('outboundDials', dials, true),
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

  clean.forEach(function(e) {
    var name = e.salesRep || e.closerName;
    var r = repFor(name, repGroup(e.position || e.role, e));
    if (!r) return;
    r.daysReported++;
    r.dials += n(e.outboundDials);
    r.conversations += n(e.conversations);
    r.liveCalls += n(e.liveCalls);
    r.sets += bookedOn(e);
    r.followUps += n(e.followUpsScheduled);
    r.reportedCalendar += n(e.callsOnCalendar);
    r.taken += n(e.callsTaken);
    r.noShowed += n(e.callsNoShowed);
    r.canceled += n(e.callsCanceled);
    r.rescheduled += n(e.callsRescheduled);
    r.pitched += n(e.callsTakenAndPitched);
    r.eodCloses += n(e.closes);
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
    // Closers are credited with the deals they filed; a rep with no deal forms
    // falls back to what they reported on their EODs.
    r.closes = r.deals || r.eodCloses;
    r.offeredNoClose = Math.max(0, r.pitched - r.closes);
    // Same calendar identity as the team totals, per rep.
    r.onCalendar = Math.max(r.reportedCalendar, r.taken + r.noShowed + r.canceled + r.rescheduled);
    r.showRate = boundedRate(r.taken, r.onCalendar, 'Show rate — ' + r.name, quality);
    r.closeRate = boundedRate(r.closes, r.pitched, 'Close rate — ' + r.name, quality);
    r.pitchRate = boundedRate(r.pitched, r.taken, 'Pitch rate — ' + r.name, quality);
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
        pitched: 0, closes: 0, eodCloses: 0, noShowed: 0, cash: 0, dealCash: 0, eodCash: 0 };
    }
    return dailyMap[key];
  }
  clean.forEach(function(e) {
    if (!e.date) return;
    var d = dayRow(e.date);
    d.dials += n(e.outboundDials);
    d.conversations += n(e.conversations);
    d.sets += bookedOn(e);
    d.taken += n(e.callsTaken);
    d.pitched += n(e.callsTakenAndPitched);
    d.eodCloses += n(e.closes);
    d.noShowed += n(e.callsNoShowed);
    d.eodCash += cashOn(e);
  });
  deals.forEach(function(dl) {
    var row = dayRow(toReportDay(dl.submittedAt));
    row.dealCash += n(dl.cashCollected);
    row.closes += 1;
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
      reportedCalendar: reportedCalendar,
      taken: taken,
      noShowed: noShowed,
      canceled: canceled,
      rescheduled: rescheduled,
      pitched: pitched,
      closes: closes,
      eodCloses: eodCloses,
      offeredNoClose: offeredNoClose,
      showedNotPitched: showedNotPitched,
      followUps: followUps,
      talkTime: clean.map(function(e) { return e.talkTime; }).filter(Boolean),
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
    quality: buildQuality(quality, { eodCloses: eodCloses, dealCloses: closes, disagreement: closesDisagree }),
  };
}

// What the report could not take at face value, in the words a manager can act on.
var FIELD_LABELS = {
  outboundDials: 'Outbound dials',
  conversations: 'Conversations',
  liveCalls: 'Live calls',
  netNewCallsBooked: 'Calls booked',
  callsOnCalendar: 'Calls on calendar',
  callsTaken: 'Calls taken',
  callsNoShowed: 'No-shows',
  callsCanceled: 'Cancellations',
  callsRescheduled: 'Reschedules',
  callsTakenAndPitched: 'Offers made',
  closes: 'Closes (as reported on EODs)',
  followUpsScheduled: 'Follow-ups scheduled',
};

function buildQuality(q, closeCheck) {
  var coverage = Object.keys(FIELD_LABELS).map(function(field) {
    return {
      field: field,
      label: FIELD_LABELS[field],
      reported: field === 'netNewCallsBooked'
        ? Math.max(q.reported.netNewCallsBooked || 0, q.reported.sets || 0)
        : (q.reported[field] || 0),
      of: q.eodsInRange,
      share: null,
    };
  }).map(function(c) {
    c.share = q.eodsInRange ? Math.round((c.reported / q.eodsInRange) * 1000) / 10 : null;
    return c;
  }).sort(function(a, b) { return a.reported - b.reported; });

  var rejected = q.rejected.slice().sort(function(a, b) { return b.value - a.value; });
  rejected.forEach(function(r) { r.label = FIELD_LABELS[r.field] || r.field; });

  return {
    eodsInRange: q.eodsInRange,
    rejected: rejected,
    rejectedCount: rejected.length,
    impossible: q.impossible,
    derivedCalendar: q.derivedCalendar,
    coverage: coverage,
    untracked: coverage.filter(function(c) { return c.reported === 0 && c.field !== 'closes'; }),
    closeCheck: closeCheck,
    clean: rejected.length === 0 && q.impossible.length === 0,
  };
}
