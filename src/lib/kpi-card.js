// The KPI card: what a rep is being measured on this month, and how close they
// are to each number.
//
// Three jobs, three sets of KPIs. A closer is measured on calls taken and the
// rate they close them at; a phone setter on dials and sets; a DM setter on
// leads out of the inbox. Showing a closer's funnel to a DM setter would be
// four zeros and none of the work they actually did.
//
// Pace is the honest part. Halfway through the month, half the target is not
// behind — it is exactly on track. Every KPI is measured against the weekdays
// gone rather than the raw total, which is the same rule computeGoalPace has
// always used for the cash goal.
//
// Pure: no store, no database. Everything is passed in.

import { recordDay } from '@/lib/report-date';
import { weekdaysBetween } from '@/lib/rep-stats';

function n(v) {
  var f = parseFloat(v);
  return isFinite(f) ? f : 0;
}

// Each KPI names where its number comes from, so the card and the target editor
// read from one list and can never offer a target for something not measured.
export var KPI_SETS = {
  closer: [
    { key: 'cash', label: 'Cash collected', kind: 'money', from: 'goal' },
    { key: 'closes', label: 'Deals closed', kind: 'count', eod: function(e) { return n(e.closes); } },
    { key: 'callsTaken', label: 'Calls taken', kind: 'count', eod: function(e) { return n(e.callsTaken); } },
    { key: 'pitched', label: 'Calls pitched', kind: 'count', eod: function(e) { return n(e.callsTakenAndPitched) || n(e.callsTaken); } },
    { key: 'closeRate', label: 'Close rate', kind: 'rate',
      over: ['closes', 'pitched'] },
  ],
  setter: [
    { key: 'cash', label: 'Cash from sets', kind: 'money', from: 'goal' },
    { key: 'dials', label: 'Outbound dials', kind: 'count', eod: function(e) { return n(e.outboundDials) || n(e.totalDials); } },
    { key: 'conversations', label: 'Conversations', kind: 'count', eod: function(e) { return n(e.conversations); } },
    { key: 'sets', label: 'Calls set', kind: 'count',
      eod: function(e) { return n(e.sets) || n(e.netNewCallsBooked); } },
    { key: 'setRate', label: 'Conversation to set', kind: 'rate', over: ['sets', 'conversations'] },
  ],
  'dm-setter': [
    { key: 'cash', label: 'Cash collected', kind: 'money', from: 'goal' },
    { key: 'newLeads', label: 'New leads', kind: 'count', eod: function(e) { return n(e.newLeads); } },
    { key: 'conversations', label: 'Conversations', kind: 'count', eod: function(e) { return n(e.conversations); } },
    { key: 'booked', label: 'Calls booked', kind: 'count',
      eod: function(e) { return n(e.netNewCallsBooked) || n(e.callsBooked); } },
    { key: 'closes', label: 'Deals closed', kind: 'count', eod: function(e) { return n(e.closes); } },
  ],
};

export function kpiSetFor(role) {
  var key = String(role || '').toLowerCase();
  if (KPI_SETS[key]) return KPI_SETS[key];
  // Anything else — a manager, an admin, a rep whose role was never set — is
  // shown the closer set, which is what the floor's numbers have always meant.
  return KPI_SETS.closer;
}

function monthBounds(today) {
  var day = String(today || '');
  var month = day.slice(0, 7);
  if (!month) return null;
  var last = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0);
  return {
    month: month,
    start: month + '-01',
    end: month + '-' + String(last.getDate()).padStart(2, '0'),
  };
}

// opts: { role, eods, today, targets, goal }
//
// `goal` is the object computeGoalPace already returns for the cash target, so
// the KPI card and the goal tile on the dashboard can never disagree about how
// much has been collected.
export function computeKpiProgress(opts) {
  var options = opts || {};
  var today = options.today || '';
  var bounds = monthBounds(today);
  if (!bounds) return null;

  var targets = options.targets || {};
  var set = kpiSetFor(options.role);

  var mine = (options.eods || []).filter(Boolean).filter(function(e) {
    var day = recordDay(e);
    return day >= bounds.start && day <= today;
  });

  var elapsed = weekdaysBetween(bounds.start, today);
  var total = weekdaysBetween(bounds.start, bounds.end);
  var left = Math.max(0, total - elapsed);

  // Every countable KPI first, so a rate can be built from two of them rather
  // than from a second pass over the reports.
  var actuals = {};
  set.forEach(function(kpi) {
    if (!kpi.eod) return;
    actuals[kpi.key] = mine.reduce(function(sum, e) { return sum + kpi.eod(e); }, 0);
  });

  var rows = set.map(function(kpi) {
    var target = n(targets[kpi.key]);
    var actual;

    if (kpi.from === 'goal') {
      var goal = options.goal || {};
      actual = n(goal.collected);
      if (!target) target = n(goal.goal);
    } else if (kpi.kind === 'rate') {
      var num = n(actuals[kpi.over[0]]);
      var den = n(actuals[kpi.over[1]]);
      // A rate with no denominator is unknowable, not zero. Null here means the
      // card prints an em dash rather than claiming a 0% close rate for someone
      // who has not pitched anybody yet.
      actual = den > 0 ? Math.round((num / den) * 1000) / 10 : null;
    } else {
      actual = n(actuals[kpi.key]);
    }

    var hasTarget = target > 0;
    var percent = (hasTarget && actual !== null)
      ? Math.round((actual / target) * 1000) / 10
      : null;

    // A rate is a standing measure, not something that accumulates, so pacing it
    // against the calendar would be nonsense: 50% of the month gone does not
    // mean half a close rate.
    var paced = kpi.kind !== 'rate' && hasTarget && elapsed > 0;
    var projected = paced ? Math.round((actual / elapsed) * total) : null;

    return {
      key: kpi.key,
      label: kpi.label,
      kind: kpi.kind,
      actual: actual,
      target: hasTarget ? target : null,
      percent: percent,
      // Where they should be TODAY, not at the end of the month. This is the
      // number that decides whether the ring is green.
      expectedByNow: paced ? Math.round((target / total) * elapsed) : null,
      onTrack: kpi.kind === 'rate'
        ? (hasTarget && actual !== null ? actual >= target : null)
        : (paced ? actual >= (target / total) * elapsed : null),
      projected: projected,
      remaining: (hasTarget && actual !== null) ? Math.max(0, Math.round(target - actual)) : null,
      neededPerDay: (paced && left > 0 && actual < target)
        ? Math.max(0, Math.round((target - actual) / left))
        : null,
    };
  });

  var withTargets = rows.filter(function(r) { return r.target !== null; });
  var hit = withTargets.filter(function(r) { return r.percent !== null && r.percent >= 100; });

  return {
    month: bounds.month,
    role: kpiSetFor(options.role) === KPI_SETS.closer && !KPI_SETS[String(options.role || '').toLowerCase()]
      ? 'closer' : String(options.role || 'closer').toLowerCase(),
    weekdaysElapsed: elapsed,
    weekdaysTotal: total,
    weekdaysLeft: left,
    reportsRead: mine.length,
    kpis: rows,
    targetsSet: withTargets.length,
    hitCount: hit.length,
    // One number for the top of the card: how many of the targets they have set
    // are already met. Null when they have set none, because 0 of 0 is not a
    // score, it is an empty card.
    completion: withTargets.length > 0
      ? Math.round((hit.length / withTargets.length) * 100)
      : null,
  };
}
