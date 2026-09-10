// One rep's own view of themselves: what they have collected, how they convert,
// what they have earned, and what they are close to earning.
//
// The period figures come from the same engine the team report uses, fed only
// this rep's records, so a number on a rep's page can never disagree with the
// same number on the company report. What is added here is the part that only
// makes sense for a person: lifetime totals, personal records, and awards.
import { computeSalesReport } from '@/lib/sales-report';
import { dedupeDeals } from '@/lib/dedupe-deals';
import { toReportDay } from '@/lib/report-date';

function n(v) {
  var x = parseFloat(v);
  return isFinite(x) ? x : 0;
}

function norm(name) {
  return String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function money(v) { return Math.round(n(v)); }

// Everything a rep is called across the records. Records carry an email far more
// reliably than a consistently spelled name, so email is the primary key and the
// name forms are the fallback for older records filed without one.
export function repIdentity(profile, email) {
  var names = {};
  var emails = {};
  function addName(v) { var k = norm(v); if (k) names[k] = true; }
  function addEmail(v) { var k = norm(v); if (k) emails[k] = true; }

  addName(profile && profile.name);
  addEmail(email);
  addEmail(profile && profile.email);

  // firstname.lastname@ and firstname_lastname@ are the same person as
  // "Firstname Lastname" on an EOD.
  var local = String(email || '').split('@')[0];
  if (local) {
    addName(local.replace(/[._-]+/g, ' '));
    addName(local);
  }

  return {
    name: (profile && profile.name) || (local ? local.replace(/[._-]+/g, ' ') : email) || 'Unknown',
    email: String(email || '').toLowerCase(),
    matches: function(candidate) { return !!names[norm(candidate)]; },
    matchesEmail: function(candidate) { return !!emails[norm(candidate)]; },
    // A record belongs to this rep if either its email or its name says so.
    owns: function(record, emailField, nameField) {
      if (!record) return false;
      if (emailField && record[emailField] && emails[norm(record[emailField])]) return true;
      return !!(nameField && record[nameField] && names[norm(record[nameField])]);
    },
  };
}

function bestOf(list, valueOf) {
  var best = null;
  list.forEach(function(item) {
    var v = valueOf(item);
    if (v > 0 && (best === null || v > best.value)) best = { value: v, item: item };
  });
  return best;
}

// Consecutive weekdays filed, counting back from the most recent report.
function eodStreak(eods) {
  var filed = {};
  eods.forEach(function(e) { if (e.date) filed[e.date] = true; });
  var days = Object.keys(filed).sort();
  if (!days.length) return 0;

  var cursor = new Date(days[days.length - 1] + 'T12:00:00');
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

// ---------------------------------------------------------------------------
// Awards
// ---------------------------------------------------------------------------
// Every award is derived from records the rep actually filed. An unearned one
// still shows what it needs and how close they are, because a locked badge with
// a progress bar is the part that changes behaviour.

var TIERS = ['bronze', 'silver', 'gold', 'platinum'];

function ladder(idBase, label, unit, thresholds, value, describe) {
  return thresholds.map(function(target, i) {
    return {
      id: idBase + '-' + target,
      name: label(target),
      detail: describe(target),
      tier: TIERS[Math.min(i, TIERS.length - 1)],
      unit: unit,
      value: value,
      target: target,
      earned: value >= target,
      progress: Math.max(0, Math.min(1, target ? value / target : 0)),
    };
  });
}

function single(id, name, detail, tier, earned, value, target, unit) {
  return {
    id: id, name: name, detail: detail, tier: tier, unit: unit || '',
    value: value, target: target, earned: !!earned,
    progress: target ? Math.max(0, Math.min(1, value / target)) : (earned ? 1 : 0),
  };
}

export function buildAwards(ctx) {
  var a = [];

  a = a.concat(ladder('cash', function(t) {
    return '$' + (t >= 1000000 ? (t / 1000000) + 'M' : (t / 1000) + 'k') + ' Collected';
  }, 'cash', [10000, 50000, 150000, 500000], ctx.lifetimeCash, function(t) {
    return 'Collect $' + t.toLocaleString('en-US') + ' in your career here.';
  }));

  a = a.concat(ladder('closes', function(t) { return t === 1 ? 'First Close' : t + ' Closes'; }, 'closes',
    [1, 25, 100, 250], ctx.lifetimeCloses, function(t) {
      return t === 1 ? 'Close your first deal.' : 'Close ' + t + ' deals.';
    }));

  a = a.concat(ladder('streak', function(t) { return t + '-Day Streak'; }, 'weekdays',
    [5, 20, 60, 120], ctx.longestStreak, function(t) {
      return 'File an EOD every weekday for ' + t + ' days running.';
    }));

  if (ctx.lifetimeSets > 0 || ctx.isSetter) {
    a = a.concat(ladder('sets', function(t) { return t + ' Calls Booked'; }, 'calls',
      [25, 100, 300, 750], ctx.lifetimeSets, function(t) {
        return 'Book ' + t + ' calls for the floor.';
      }));
  }

  // Craft awards need enough volume to mean anything, so each carries its own
  // qualifying threshold rather than rewarding one lucky call.
  a.push(single('craft-close-rate', 'Closer’s Eye',
    'Hold a 40% close rate across at least 20 offers.', 'gold',
    ctx.offers >= 20 && ctx.closeRate !== null && ctx.closeRate >= 40,
    ctx.offers >= 20 && ctx.closeRate !== null ? ctx.closeRate : 0, 40, '%'));

  a.push(single('craft-show-rate', 'Full Calendar',
    'Hold an 85% show rate across at least 30 booked calls.', 'gold',
    ctx.onCalendar >= 30 && ctx.showRate !== null && ctx.showRate >= 85,
    ctx.onCalendar >= 30 && ctx.showRate !== null ? ctx.showRate : 0, 85, '%'));

  a.push(single('peak-deal', 'Whale Hunter',
    'Close a single deal worth $10,000 or more.', 'platinum',
    ctx.biggestDeal >= 10000, ctx.biggestDeal, 10000, 'cash'));

  a.push(single('peak-day', 'Perfect Day',
    'Collect $20,000 in a single day.', 'platinum',
    ctx.bestDayCash >= 20000, ctx.bestDayCash, 20000, 'cash'));

  a.push(single('peak-closes-day', 'Hat Trick',
    'Close three deals in one day.', 'silver',
    ctx.mostClosesInADay >= 3, ctx.mostClosesInADay, 3, 'closes'));

  a.push(single('board-first', 'Top of the Board',
    'Finish a calendar month as the top closer.', 'platinum',
    ctx.monthsAtNumberOne > 0, ctx.monthsAtNumberOne, 1, 'months'));

  return a;
}

// ---------------------------------------------------------------------------

export function computeRepStats(input) {
  var rep = input.identity;
  var today = input.today;

  function mineEod(e) {
    return rep.owns(e, 'closerEmail', 'salesRep') || rep.matches(e.closerName);
  }
  function mineDeal(d) { return rep.owns(d, 'closerEmail', 'closer'); }
  function mineSet(d) { return rep.matches(d.setter); }

  var myEods = (input.eods || []).filter(mineEod);
  var myDeals = (input.deals || []).filter(mineDeal);
  var mySetDeals = (input.deals || []).filter(function(d) {
    return mineSet(d) && !mineDeal(d);
  });
  var myBooked = (input.booked || []).filter(function(b) { return rep.matches(b.setter); });
  var myAfterCalls = (input.afterCalls || []).filter(function(a) {
    return rep.owns(a, 'closerEmail', 'closer');
  });

  // The period view runs through the shared engine, so its rules — deduped cash,
  // derived calendar, withheld rates — apply here identically.
  function report(start, end) {
    return computeSalesReport({
      start: start, end: end,
      eods: myEods, deals: myDeals, booked: myBooked, afterCalls: myAfterCalls,
    });
  }

  var lifetime = report('0000-01-01', '9999-12-31');
  var period = report(input.start, input.end);

  var dedupedLifetime = dedupeDeals(myDeals).deals;

  // ---- personal records ----
  var byDay = {};
  dedupedLifetime.forEach(function(d) {
    var day = toReportDay(d.submittedAt);
    if (!byDay[day]) byDay[day] = { day: day, cash: 0, closes: 0 };
    byDay[day].cash += n(d.cashCollected);
    byDay[day].closes += 1;
  });
  var dayRows = Object.keys(byDay).map(function(k) { return byDay[k]; });

  var byMonth = {};
  dedupedLifetime.forEach(function(d) {
    var month = toReportDay(d.submittedAt).slice(0, 7);
    if (!byMonth[month]) byMonth[month] = { month: month, cash: 0, closes: 0 };
    byMonth[month].cash += n(d.cashCollected);
    byMonth[month].closes += 1;
  });
  var monthRows = Object.keys(byMonth).sort().map(function(k) {
    var m = byMonth[k];
    m.cash = money(m.cash);
    return m;
  });

  var biggest = bestOf(dedupedLifetime, function(d) { return n(d.cashCollected); });
  var bestDay = bestOf(dayRows, function(r) { return r.cash; });
  var bestMonth = bestOf(monthRows, function(r) { return r.cash; });
  var mostCloses = bestOf(dayRows, function(r) { return r.closes; });

  var records = {
    biggestDeal: biggest ? money(biggest.value) : 0,
    biggestDealLead: biggest ? (biggest.item.leadsName || '') : '',
    biggestDealAt: biggest ? biggest.item.submittedAt : '',
    bestDayCash: bestDay ? money(bestDay.value) : 0,
    bestDay: bestDay ? bestDay.item.day : '',
    bestMonthCash: bestMonth ? money(bestMonth.value) : 0,
    bestMonth: bestMonth ? bestMonth.item.month : '',
    mostClosesInADay: mostCloses ? mostCloses.value : 0,
    currentStreak: eodStreak(myEods),
    longestStreak: input.longestStreak || eodStreak(myEods),
    firstCloseAt: dedupedLifetime.length
      ? dedupedLifetime.map(function(d) { return d.submittedAt; }).sort()[0]
      : '',
  };

  // ---- how many months they finished first ----
  var monthsAtNumberOne = 0;
  var boardByMonth = input.monthlyLeaders || {};
  Object.keys(boardByMonth).forEach(function(month) {
    if (month.slice(0, 7) === String(today || '').slice(0, 7)) return; // month still running
    if (rep.matches(boardByMonth[month])) monthsAtNumberOne++;
  });

  var awards = buildAwards({
    lifetimeCash: lifetime.cash.collected,
    lifetimeCloses: lifetime.volume.closes,
    lifetimeSets: lifetime.volume.sets + myBooked.length,
    isSetter: myBooked.length > 0 || mySetDeals.length > 0,
    longestStreak: records.longestStreak,
    offers: lifetime.volume.pitched,
    closeRate: lifetime.rates.closeRateOfOffers,
    onCalendar: lifetime.volume.onCalendar,
    showRate: lifetime.rates.showRate,
    biggestDeal: records.biggestDeal,
    bestDayCash: records.bestDayCash,
    mostClosesInADay: records.mostClosesInADay,
    monthsAtNumberOne: monthsAtNumberOne,
  });

  var earned = awards.filter(function(x) { return x.earned; });
  // The nearest three unearned awards, so the page can say what is next.
  var next = awards.filter(function(x) { return !x.earned; })
    .sort(function(a, b) { return b.progress - a.progress; })
    .slice(0, 3);

  return {
    rep: { name: rep.name, email: rep.email },
    lifetime: {
      cash: lifetime.cash.collected,
      deals: lifetime.cash.dealCount,
      avgDeal: lifetime.cash.avgDeal,
      closes: lifetime.volume.closes,
      offers: lifetime.volume.pitched,
      callsTaken: lifetime.volume.taken,
      dials: lifetime.volume.dials,
      setsBooked: lifetime.volume.sets + myBooked.length,
      closeRate: lifetime.rates.closeRateOfOffers,
      showRate: lifetime.rates.showRate,
      cashPerCall: lifetime.cash.perShow,
      cashPerOffer: lifetime.cash.perOffer,
      eodsFiled: myEods.length,
      setCreditsClosed: mySetDeals.length,
      setCreditsCash: money(mySetDeals.reduce(function(s, d) { return s + n(d.cashCollected); }, 0)),
    },
    period: {
      start: period.range.start,
      end: period.range.end,
      cash: period.cash.collected,
      deals: period.cash.dealCount,
      closes: period.volume.closes,
      offers: period.volume.pitched,
      callsTaken: period.volume.taken,
      dials: period.volume.dials,
      closeRate: period.rates.closeRateOfOffers,
      showRate: period.rates.showRate,
      cashPerCall: period.cash.perShow,
      daily: period.daily,
    },
    monthly: monthRows.slice(-12),
    records: records,
    awards: awards,
    earnedCount: earned.length,
    totalAwards: awards.length,
    nextUp: next,
    quality: period.quality,
  };
}
