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
import { parseCallDay, parseCallMinutes } from '@/lib/call-day';

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
export function repIdentity(profile, email, accountName) {
  var names = {};
  var emails = {};
  function addName(v) { var k = norm(v); if (k) names[k] = true; }
  function addEmail(v) { var k = norm(v); if (k) emails[k] = true; }

  // A closer profile is created by whichever form first carried this email, so its
  // name can be somebody else's — that is how a manager filing on a rep's behalf
  // ends up owning the rep's records. When we know the person's real name, that is
  // the name we match on; the profile name is only trusted when nothing better
  // exists, which is the ordinary case for a rep who has never been filed for.
  var known = (profile && profile.displayName) || accountName || '';
  if (known) addName(known);
  else addName(profile && profile.name);
  addEmail(email);
  addEmail(profile && profile.email);

  // firstname.lastname@ and firstname_lastname@ are the same person as
  // "Firstname Lastname" on an EOD.
  var local = String(email || '').split('@')[0];
  if (local) {
    addName(local.replace(/[._-]+/g, ' '));
    addName(local);
  }

  // Whose name to show is a different question from which records are theirs.
  // A closer profile is created by whatever form first carried the email, so a
  // manager who filed a deal on someone else's behalf ends up with that rep's
  // name stamped on their own profile. The account's own name outranks it.
  return {
    name: (profile && profile.displayName)
      || accountName
      || (profile && profile.name)
      || (local ? local.replace(/[._-]+/g, ' ') : email)
      || 'Unknown',
    // The name records are actually filed under, kept separate from the display
    // name so matching never depends on how someone chose to present themselves.
    recordName: known || (profile && profile.name) || (local ? local.replace(/[._-]+/g, ' ') : email) || '',
    email: String(email || '').toLowerCase(),
    // The same match set as matches(), flattened — for callers that need to build
    // a lookup rather than ask about one candidate at a time.
    matchNames: Object.keys(names),
    matches: function(candidate) { return !!names[norm(candidate)]; },
    matchesEmail: function(candidate) { return !!emails[norm(candidate)]; },
    // Whose record is this?
    //
    // The name field is the deliberate one — somebody chose it when they filed the
    // form. The email is ambient: it used to be stamped from whoever was signed in,
    // so a manager filing on a rep's behalf produced a record carrying the manager's
    // email and the rep's name. Matching on either would hand that record to both of
    // them, and every personal total would count it twice.
    //
    // So a named record belongs to the person named. The email only decides it when
    // there is no name to go on.
    owns: function(record, emailField, nameField) {
      if (!record) return false;
      var name = nameField ? record[nameField] : '';
      if (name) return !!names[norm(name)];
      return !!(emailField && record[emailField] && emails[norm(record[emailField])]);
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


// Weekdays are the unit a sales month is actually paced in; a target divided by
// calendar days is wrong by a third.
function weekdaysBetween(startDay, endDay) {
  if (!startDay || !endDay || startDay > endDay) return 0;
  var cursor = new Date(startDay + 'T12:00:00');
  var stop = new Date(endDay + 'T12:00:00');
  var count = 0;
  while (cursor <= stop && count < 400) {
    var dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

// Where a rep stands against their monthly target, and what the rest of the month
// has to look like to hit it.
export function computeGoalPace(goal, deals, today) {
  var target = n(goal);
  var day = String(today || '');
  var month = day.slice(0, 7);
  if (!month) return null;

  var monthStart = month + '-01';
  var lastDay = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0);
  var monthEnd = month + '-' + String(lastDay.getDate()).padStart(2, '0');

  var collected = 0;
  (deals || []).forEach(function(d) {
    var dealDay = toReportDay(d.submittedAt);
    if (dealDay >= monthStart && dealDay <= day) collected += n(d.cashCollected);
  });
  collected = money(collected);

  var elapsed = weekdaysBetween(monthStart, day);
  var total = weekdaysBetween(monthStart, monthEnd);
  var remaining = Math.max(0, total - elapsed);
  var perDaySoFar = elapsed > 0 ? collected / elapsed : 0;

  return {
    goal: target,
    collected: collected,
    month: month,
    weekdaysElapsed: elapsed,
    weekdaysTotal: total,
    weekdaysLeft: remaining,
    // Null rather than 0% when no target is set — an unset goal is not a missed one.
    percent: target > 0 ? Math.round((collected / target) * 1000) / 10 : null,
    projected: elapsed > 0 ? Math.round(perDaySoFar * total) : 0,
    onTrack: target > 0 && elapsed > 0 ? perDaySoFar * total >= target : null,
    neededPerDay: target > 0 && remaining > 0
      ? Math.max(0, Math.round((target - collected) / remaining))
      : 0,
    shortfall: target > 0 ? Math.max(0, Math.round(target - collected)) : 0,
  };
}


// What is on this rep's calendar today, and what their own history says to expect
// from it. Every expectation is their rate, not a floor average.
export function computeTodaysCalls(booked, today, rates, avgDeal) {
  var scheduled = [];
  var unscheduled = 0;

  (booked || []).forEach(function(b) {
    var day = parseCallDay(b.bookedDay, today);
    if (!day) { unscheduled++; return; }
    if (day !== today) return;
    scheduled.push({
      id: b.id,
      lead: b.leadsName || 'Unnamed lead',
      time: b.bookedTime || '',
      minutes: parseCallMinutes(b.bookedTime),
      program: b.program || '',
      setter: b.setter || '',
      qualified: b.qualified === true || String(b.qualified).toLowerCase() === 'yes',
      source: b.outboundInbound || '',
      goal: b.goal || '',
      pain: b.pain || '',
      notes: b.notes || '',
      intentScore: b.intentScore || '',
      creditScore: b.creditScore || '',
    });
  });

  scheduled.sort(function(a, b) { return a.minutes - b.minutes; });

  var count = scheduled.length;
  var showRate = rates && rates.showRate;
  var pitchRate = rates && rates.pitchRate;
  var closeRate = rates && rates.closeRate;

  // Each stage is only projected when the rep has a measured rate for it.
  var expectedShows = showRate === null || showRate === undefined ? null : Math.round((count * showRate) / 100 * 10) / 10;
  var expectedOffers = expectedShows === null || pitchRate === null || pitchRate === undefined
    ? null : Math.round((expectedShows * pitchRate) / 100 * 10) / 10;
  var expectedCloses = expectedOffers === null || closeRate === null || closeRate === undefined
    ? null : Math.round((expectedOffers * closeRate) / 100 * 10) / 10;
  var expectedCash = expectedCloses === null || !avgDeal ? null : Math.round(expectedCloses * avgDeal);

  return {
    date: today,
    calls: scheduled,
    count: count,
    unscheduled: unscheduled,
    expect: {
      shows: expectedShows,
      offers: expectedOffers,
      closes: expectedCloses,
      cash: expectedCash,
      showRate: showRate === undefined ? null : showRate,
      closeRate: closeRate === undefined ? null : closeRate,
    },
  };
}


// A PnL card compares a window against the one before it, so the headline is a
// change rather than a total. Growth from nothing is not a percentage — it is
// reported as new, because "+Infinity%" is not a claim anyone can act on.
export function computePnl(deals, start, end) {
  var from = String(start || '');
  var to = String(end || '');
  if (!from || !to || from > to) return null;

  var days = Math.round((new Date(to + 'T12:00:00') - new Date(from + 'T12:00:00')) / 86400000) + 1;
  var prevEnd = new Date(from + 'T12:00:00');
  prevEnd.setDate(prevEnd.getDate() - 1);
  var prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - (days - 1));

  function windowOf(a, b) {
    var cash = 0, count = 0;
    (deals || []).forEach(function(d) {
      var day = toReportDay(d.submittedAt);
      if (day >= a && day <= b) { cash += n(d.cashCollected); count++; }
    });
    return { cash: money(cash), closes: count };
  }

  var now = windowOf(from, to);
  var before = windowOf(toReportDay(prevStart), toReportDay(prevEnd));

  var change = null;
  if (before.cash > 0) change = Math.round(((now.cash - before.cash) / before.cash) * 1000) / 10;

  return {
    start: from,
    end: to,
    days: days,
    cash: now.cash,
    closes: now.closes,
    previousCash: before.cash,
    previousCloses: before.closes,
    // null means there is no prior period to compare against, not zero growth.
    changePercent: change,
    changeCash: money(now.cash - before.cash),
    direction: change === null ? (now.cash > 0 ? 'new' : 'flat') : (change >= 0 ? 'up' : 'down'),
  };
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
      pitchRate: lifetime.rates.pitchRate,
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
