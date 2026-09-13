// Every number the twenty awards are judged on, derived at read time.
//
// The spec asked for one SQL query per metric. That is not possible here and
// would be wrong if it were: the record tables are (id, data JSONB), so there is
// no `dials` column to select. Everything is computed in JS from the same store
// the dashboards already read, which has the side benefit that an award can
// never disagree with the number printed next to it.
//
// A metric with no data source returns null. Null is not zero: a null metric
// means "we do not capture this yet", the award is never granted and never
// shown as nearly-earned, and it will light up by itself the day the field
// starts arriving. Reporting a dark award as 0% would be a quiet lie about
// something a rep is trying to chase.

import { toReportDay } from '@/lib/report-date';

function n(v) { var x = parseFloat(v); return isFinite(x) ? x : 0; }
function norm(v) { return String(v == null ? '' : v).trim().toLowerCase(); }

// Windows are bucketed by the report day, which is already Pacific-based
// everywhere else in this app. That is what stops Century Dial firing against a
// UTC midnight and crediting the wrong day.
function byDay(rows, dayOf) {
  var out = {};
  rows.forEach(function(r) {
    var d = dayOf(r);
    if (!d) return;
    out[d] = out[d] || [];
    out[d].push(r);
  });
  return out;
}

function maxOver(buckets, valueOf) {
  var best = 0;
  Object.keys(buckets).forEach(function(k) {
    var v = valueOf(buckets[k], k);
    if (v > best) best = v;
  });
  return best;
}

// Consecutive weekdays with a filed EOD, counting back from the most recent one.
// This is the app's existing definition of logging compliance.
function weekdayStreak(days) {
  var filed = {};
  days.forEach(function(d) { if (d) filed[d] = true; });
  var keys = Object.keys(filed).sort();
  if (!keys.length) return 0;
  var cursor = new Date(keys[keys.length - 1] + 'T12:00:00');
  var streak = 0;
  for (var i = 0; i < 400; i++) {
    var key = cursor.toISOString().slice(0, 10);
    var dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) {
      if (!filed[key]) break;
      streak++;
    }
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

// The lead a deal was for, so a close can be matched back to the booking that
// started it. Email first, then phone — a name is not unique enough to hang a
// gold award on.
function leadKey(record) {
  var email = norm(record.leadsEmail);
  if (email) return 'e:' + email;
  var phone = String(record.leadsPhone || '').replace(/\D/g, '');
  return phone.length >= 7 ? 'p:' + phone.slice(-10) : '';
}

export var UNBACKED_REASONS = {
  contacts_under_5min: 'No opt-in timestamp is captured, so time-to-first-contact cannot be measured.',
  target_hit_days: 'No per-rep daily dial target is stored to compare a day against.',
  show_rate_qualified: 'A booking records no outcome, so a setter’s own show rate is not derivable.',
  revived_sets: 'Leads are not marked written-off, so a revival cannot be detected.',
  quota_months: 'No monthly set quota is stored per rep.',
  one_call_closes: 'Follow-up calls are not linked to a deal, so a one-call close is indistinguishable.',
  pif_closes_flagship_plus: 'Paid-in-full is free text and no offer is designated flagship.',
  closes_objections_3plus: 'Objections are not logged on a call.',
};

// deals / eods / bookings are this rep's records only, already filtered by the
// caller using the same ownership rule the rest of the app uses.
export function computeMetrics(input) {
  var deals = input.deals || [];
  var eods = input.eods || [];
  var bookings = input.bookings || [];
  var monthlyLeaders = input.monthlyLeaders || {};
  var identity = input.identity;

  var dealDay = function(d) { return toReportDay(d.submittedAt); };
  var dealsByDay = byDay(deals, dealDay);
  var eodByDay = byDay(eods, function(e) { return e.date || toReportDay(e.submittedAt); });

  var cashByMonth = {};
  deals.forEach(function(d) {
    var day = dealDay(d);
    if (!day) return;
    var m = day.slice(0, 7);
    cashByMonth[m] = (cashByMonth[m] || 0) + n(d.cashCollected);
  });

  // When a lead was first booked, so a close can be aged against it.
  var firstBooked = {};
  bookings.forEach(function(b) {
    var key = leadKey(b);
    if (!key) return;
    var day = b.bookedDay && /^\d{4}-\d{2}-\d{2}$/.test(b.bookedDay)
      ? b.bookedDay
      : toReportDay(b.submittedAt);
    if (!day) return;
    if (!firstBooked[key] || day < firstBooked[key]) firstBooked[key] = day;
  });

  var agedCloses = 0;
  deals.forEach(function(d) {
    var key = leadKey(d);
    var closed = dealDay(d);
    if (!key || !closed || !firstBooked[key]) return;
    var gap = (new Date(closed + 'T12:00:00') - new Date(firstBooked[key] + 'T12:00:00')) / 86400000;
    if (gap >= 60) agedCloses++;
  });

  var monthsAtNumberOne = 0;
  Object.keys(monthlyLeaders).forEach(function(m) {
    if (identity && identity.matches(monthlyLeaders[m])) monthsAtNumberOne++;
  });

  var big = deals.filter(function(d) {
    return Math.max(n(d.cashCollected), n(d.totalContractValue), n(d.dealValue)) >= 30000;
  }).length;

  // A perfect board: every offer made that day was closed, on a day with at
  // least three of them.
  var perfectDays = 0;
  Object.keys(eodByDay).forEach(function(day) {
    eodByDay[day].forEach(function(e) {
      var offers = n(e.callsTakenAndPitched);
      var closes = n(e.closes);
      if (offers >= 3 && closes >= offers) perfectDays++;
    });
  });

  return {
    // ---- backed ----
    qualified_sets: bookings.filter(function(b) {
      var q = norm(b.qualified);
      return q === 'yes' || q === 'true' || q === '1';
    }).length,

    dials: {
      lifetime: eods.reduce(function(s, e) { return s + n(e.outboundDials); }, 0),
      day: maxOver(eodByDay, function(rows) {
        return rows.reduce(function(s, e) { return s + n(e.outboundDials); }, 0);
      }),
    },

    assisted_closes: deals.filter(function(d) {
      return identity && d.setter && identity.matches(d.setter);
    }).length,

    logging_compliance_days: weekdayStreak(eods.map(function(e) {
      return e.date || toReportDay(e.submittedAt);
    })),

    closes: {
      lifetime: deals.length,
      day: maxOver(dealsByDay, function(rows) { return rows.length; }),
    },

    perfect_day: perfectDays,
    closes_offer_30k: big,
    cash_collected: { month: maxOver(cashByMonth, function(v) { return v; }) },
    closes_aged_60d: agedCloses,
    board_rank_first_months: monthsAtNumberOne,

    // ---- dark: no data source yet ----
    contacts_under_5min: null,
    target_hit_days: null,
    show_rate_qualified: null,
    revived_sets: null,
    quota_months: null,
    one_call_closes: null,
    pif_closes_flagship_plus: null,
    closes_objections_3plus: null,
  };
}

// Pull the figure an award is judged on out of the metric bag, honouring its
// window. A metric stored as a plain number answers every window.
export function valueFor(award, metrics) {
  var raw = metrics[award.metric];
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return raw;
  var byWindow = raw[award.window];
  if (byWindow === null || byWindow === undefined) {
    // A lifetime figure is the honest fallback for a window we did not bucket.
    return raw.lifetime === undefined ? null : raw.lifetime;
  }
  return byWindow;
}

export function unbackedMetrics(metrics) {
  return Object.keys(metrics).filter(function(k) { return metrics[k] === null; });
}
