// The arithmetic behind the EOD analysis. Pure: no key, no database, no network.
//
// It lives apart from eod-analyst.js for a reason the build enforces. The EOD
// Logs page needs these totals for its own footer, and eod-analyst.js reaches
// getApiKey() -> db.js -> pg, so importing it from a client component drags the
// Postgres driver and the Anthropic key's resolution path into the browser
// bundle. The model-facing half stays server-only; the maths is shared.
//
// The split of labour is the point of this feature: **the code does every
// calculation and the model only interprets the result**. Nothing here or in
// eod-analyst.js asks the model to add, divide or work out a rate.

import { recordDay, shiftReportDay } from '@/lib/report-date';


var MAX_PLANS = 200;
var PLAN_CHARS = 400;

function num(v) {
  var n = parseFloat(v);
  return isFinite(n) ? n : 0;
}

// The field each figure actually lives under, old spellings included. An EOD
// filed a year ago and one filed this morning have to count the same.
function dials(e) { return num(e.outboundDials) || num(e.totalDials); }
function booked(e) { return num(e.netNewCallsBooked) || num(e.callsBooked); }
function onCalendar(e) { return num(e.callsOnCalendar); }
function taken(e) { return num(e.callsTaken); }
function noShowed(e) { return num(e.callsNoShowed) || num(e.noShowed); }
function canceled(e) { return num(e.callsCanceled) || num(e.canceled); }
function rescheduled(e) { return num(e.callsRescheduled) || num(e.rescheduled); }
// A report that never filled in the pitched box still pitched the calls it took;
// counting it as zero would invent a drop-off that did not happen.
function pitched(e) { return num(e.callsTakenAndPitched) || num(e.callsTaken); }
function closes(e) { return num(e.closes); }
function cashMYFM(e) { return num(e.cashCollectedMYFM) || num(e.cashMYFM); }
function cashI2I(e) { return num(e.cashCollectedI2I) || num(e.cashI2I); }
function revenue(e) { return num(e.revenueOnDay); }
function repOf(e) { return String(e.salesRep || e.closerName || '').trim() || 'Unknown'; }

// A setter's EOD reports conversations and sets, not pitches and closes. Folding
// those rows into a closing funnel manufactures a collapse at the pitch stage
// that nobody on the floor would recognise, so they are counted separately and
// the aggregate says how many there were.
function isSetterReport(e) {
  // The stored `role` cannot be trusted on its own. Until recently the ingest
  // decided it from dials before calls taken, so a great many closers' reports
  // are sitting in the database labelled 'setter'. Those records are history and
  // history is not rewritten here, so the label is read alongside the numbers and
  // the numbers win: anything showing a call taken, a pitch, a close, a booked
  // calendar or cash is a closing day, whatever it was labelled.
  var closingActivity = num(e.callsTaken) > 0
    || num(e.callsTakenAndPitched) > 0
    || num(e.closes) > 0
    || num(e.callsOnCalendar) > 0
    || cashMYFM(e) > 0 || cashI2I(e) > 0;
  if (closingActivity) return false;

  var labelled = String(e.role || '').toLowerCase() === 'setter'
    || String(e.position || '').toLowerCase() === 'setter';
  // A day with sets or conversations and nothing closing on it is setter work
  // whether or not anyone filled the Position box in.
  return labelled || num(e.sets) > 0 || num(e.conversations) > 0;
}

// Every division in this file goes through one of these two, and both answer
// null rather than Infinity or NaN. A null is "we cannot know this", which the
// page prints as an em dash and the model is told to read as insufficient data.
// Zero would be a claim, and it would be a false one.
function pct(numerator, denominator) {
  if (!denominator || denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function per(numerator, denominator) {
  if (!denominator || denominator <= 0) return null;
  return Math.round((numerator / denominator) * 100) / 100;
}

function blankTotals() {
  return {
    reports: 0, dials: 0, booked: 0, onCalendar: 0, taken: 0, pitched: 0,
    noShowed: 0, canceled: 0, rescheduled: 0, closes: 0,
    cashMYFM: 0, cashI2I: 0, cashTotal: 0, revenue: 0,
  };
}

function addInto(totals, e) {
  totals.reports++;
  totals.dials += dials(e);
  totals.booked += booked(e);
  totals.onCalendar += onCalendar(e);
  totals.taken += taken(e);
  totals.pitched += pitched(e);
  totals.noShowed += noShowed(e);
  totals.canceled += canceled(e);
  totals.rescheduled += rescheduled(e);
  totals.closes += closes(e);
  totals.cashMYFM += cashMYFM(e);
  totals.cashI2I += cashI2I(e);
  totals.revenue += revenue(e);
  return totals;
}

function settle(totals) {
  totals.cashTotal = Math.round((totals.cashMYFM + totals.cashI2I) * 100) / 100;
  totals.cashMYFM = Math.round(totals.cashMYFM * 100) / 100;
  totals.cashI2I = Math.round(totals.cashI2I * 100) / 100;
  totals.revenue = Math.round(totals.revenue * 100) / 100;
  return totals;
}

// The rates, all of them derived from totals that are already settled.
function ratesFor(t) {
  return {
    dialsToBooked: pct(t.booked, t.dials),
    // Two different questions that get confused constantly. bookedToTaken asks
    // how much of what was booked in the range was sat through; showRate asks
    // how much of what was ON the calendar showed up. A team that books ahead
    // has a low first number and a healthy second, and reading the first as a
    // show-rate problem sends the coaching to the wrong place.
    bookedToTaken: pct(t.taken, t.booked),
    showRate: pct(t.taken, t.onCalendar),
    noShowRate: pct(t.noShowed, t.onCalendar),
    cancelRate: pct(t.canceled, t.onCalendar),
    takenToPitched: pct(t.pitched, t.taken),
    pitchedToClosed: pct(t.closes, t.pitched),
    cashPerDial: per(t.cashTotal, t.dials),
    cashPerCallTaken: per(t.cashTotal, t.taken),
    avgDealSize: per(t.cashTotal, t.closes),
  };
}

// Weekdays between two day-keys, inclusive. Weekends are not expected — the
// compliance tracker has always worked that way and a reporting gap has to mean
// the same thing here as it does there.
export function businessDaysBetween(from, to) {
  var out = [];
  if (!from || !to || from > to) return out;
  var day = from;
  var guard = 0;
  while (day <= to && guard++ < 800) {
    var parts = day.split('-');
    var dow = new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2], 12, 0, 0)).getUTCDay();
    if (dow !== 0 && dow !== 6) out.push(day);
    day = shiftReportDay(day, 1);
  }
  return out;
}

function standardDeviation(values) {
  if (values.length < 2) return 0;
  var mean = values.reduce(function(s, v) { return s + v; }, 0) / values.length;
  var variance = values.reduce(function(s, v) { return s + (v - mean) * (v - mean); }, 0) / values.length;
  return Math.sqrt(variance);
}

// Which rates are worth flagging an outlier on, and which direction is bad.
var OUTLIER_RATES = [
  { key: 'dialsToBooked', label: 'dials to booked', worseWhen: 'low' },
  { key: 'showRate', label: 'show rate', worseWhen: 'low' },
  { key: 'noShowRate', label: 'no-show rate', worseWhen: 'high' },
  { key: 'takenToPitched', label: 'taken to pitched', worseWhen: 'low' },
  { key: 'pitchedToClosed', label: 'pitched to closed', worseWhen: 'low' },
];

// Everything the model is allowed to talk about, worked out here.
export function aggregateEod(reports, businessDays) {
  var all = (reports || []).filter(Boolean);
  var days = businessDays || [];

  var setterReports = all.filter(isSetterReport);
  var rows = all.filter(function(e) { return !isSetterReport(e); });

  // ---- team ----
  var team = settle(rows.reduce(function(t, e) { return addInto(t, e); }, blankTotals()));
  var teamRates = ratesFor(team);

  // ---- per rep ----
  var byRep = {};
  rows.forEach(function(e) {
    var name = repOf(e);
    if (!byRep[name]) byRep[name] = { rep: name, totals: blankTotals(), daysSeen: {} };
    addInto(byRep[name].totals, e);
    var d = recordDay(e);
    if (d) byRep[name].daysSeen[d] = true;
  });

  var reps = Object.keys(byRep).map(function(name) {
    var row = byRep[name];
    var totals = settle(row.totals);
    return {
      rep: name,
      daysReported: Object.keys(row.daysSeen).length,
      totals: totals,
      rates: ratesFor(totals),
    };
  }).sort(function(a, b) { return b.totals.cashTotal - a.totals.cashTotal; });

  // ---- first half vs second half ----
  //
  // Split on the business-day calendar rather than on the reports, so a quiet
  // week does not get folded into a busy one and called a trend.
  var half = Math.floor(days.length / 2);
  var firstDays = days.slice(0, half);
  var secondDays = days.slice(days.length - (days.length - half));
  var firstSet = {}, secondSet = {};
  firstDays.forEach(function(d) { firstSet[d] = true; });
  secondDays.forEach(function(d) { secondSet[d] = true; });

  function sliceTotals(set) {
    return settle(rows.filter(function(e) { return set[recordDay(e)]; })
      .reduce(function(t, e) { return addInto(t, e); }, blankTotals()));
  }

  var trend = null;
  // Two halves of one day each is not a trend, it is two days.
  if (days.length >= 4) {
    var firstTotals = sliceTotals(firstSet);
    var secondTotals = sliceTotals(secondSet);
    var firstRates = ratesFor(firstTotals);
    var secondRates = ratesFor(secondTotals);
    var deltas = {};
    Object.keys(firstRates).forEach(function(k) {
      // A delta needs both halves to have an answer. One half being unknowable
      // makes the change unknowable too, not a fall from nothing.
      deltas[k] = (firstRates[k] === null || secondRates[k] === null)
        ? null
        : Math.round((secondRates[k] - firstRates[k]) * 10) / 10;
    });
    trend = {
      firstHalf: { from: firstDays[0] || '', to: firstDays[firstDays.length - 1] || '', totals: firstTotals, rates: firstRates },
      secondHalf: { from: secondDays[0] || '', to: secondDays[secondDays.length - 1] || '', totals: secondTotals, rates: secondRates },
      rateDeltas: deltas,
    };
  }

  // ---- outliers ----
  //
  // Withheld below three reps or three days. One rep is not a team to be an
  // outlier against, and two days of data makes an outlier of whoever had a bad
  // Tuesday.
  var outliers = [];
  var eligible = reps.filter(function(r) { return r.daysReported >= 3; });
  if (reps.length >= 3 && days.length >= 3 && eligible.length >= 3) {
    OUTLIER_RATES.forEach(function(spec) {
      var withValue = eligible.filter(function(r) { return r.rates[spec.key] !== null; });
      if (withValue.length < 3) return;
      var values = withValue.map(function(r) { return r.rates[spec.key]; });
      var mean = values.reduce(function(s, v) { return s + v; }, 0) / values.length;
      var sd = standardDeviation(values);
      if (sd <= 0) return;
      withValue.forEach(function(r) {
        var value = r.rates[spec.key];
        var distance = (value - mean) / sd;
        if (Math.abs(distance) <= 1) return;
        outliers.push({
          rep: r.rep,
          metric: spec.label,
          value: value,
          teamMean: Math.round(mean * 10) / 10,
          standardDeviations: Math.round(distance * 10) / 10,
          direction: distance > 0 ? 'above' : 'below',
          concerning: spec.worseWhen === 'high' ? distance > 0 : distance < 0,
          daysReported: r.daysReported,
        });
      });
    });
  }

  // ---- who did not report ----
  var reportedByRep = {};
  rows.concat(setterReports).forEach(function(e) {
    var name = repOf(e);
    var d = recordDay(e);
    if (!d) return;
    (reportedByRep[name] = reportedByRep[name] || {})[d] = true;
  });
  var reportingGaps = Object.keys(reportedByRep).map(function(name) {
    var seen = reportedByRep[name];
    var missing = days.filter(function(d) { return !seen[d]; });
    return { rep: name, missingDays: missing, missingCount: missing.length, reportedCount: days.length - missing.length };
  }).filter(function(row) { return row.missingCount > 0; })
    .sort(function(a, b) { return b.missingCount - a.missingCount; });

  // ---- what they said they would fix ----
  var improvementPlans = [];
  all.forEach(function(e) {
    var text = String(e.improvementPlan || '').trim();
    if (!text) return;
    improvementPlans.push({
      rep: repOf(e),
      date: recordDay(e),
      text: text.length > PLAN_CHARS ? text.slice(0, PLAN_CHARS) + '…' : text,
    });
  });
  improvementPlans.sort(function(a, b) { return String(a.date).localeCompare(String(b.date)); });
  var plansTruncated = improvementPlans.length > MAX_PLANS;
  if (plansTruncated) improvementPlans = improvementPlans.slice(-MAX_PLANS);

  return {
    range: { from: days[0] || '', to: days[days.length - 1] || '', businessDays: days.length },
    reportCount: rows.length,
    setterReportCount: setterReports.length,
    repCount: reps.length,
    daysWithReports: Object.keys(rows.reduce(function(a, e) { var d = recordDay(e); if (d) a[d] = true; return a; }, {})).length,
    team: { totals: team, rates: teamRates },
    reps: reps,
    trend: trend,
    outliers: outliers,
    reportingGaps: reportingGaps,
    improvementPlans: improvementPlans,
    plansTruncated: plansTruncated,
    // Said out loud in the payload so the model reads a null as "not knowable"
    // rather than as a zero it is free to describe as a collapse.
    notes: 'Every figure here is already calculated. A null rate means the'
      + ' denominator was zero and the rate is unknowable — it is not 0%.',
  };
}
