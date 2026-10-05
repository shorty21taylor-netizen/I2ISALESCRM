// Building a rep's end-of-day out of the day they already filed.
//
// Everything on the EOD form except the dials, the cancels and the write-up is
// already in the CRM by 5pm: the booked calls the setter filed, the after-call
// reports the closer filed, the deals that closed. Asking the rep to count them
// again at the end of the day produces two numbers for the same day that do not
// agree, and the one the floor's board reads is whichever was typed last.
//
// So the day is totalled here and offered as a draft. Three rules make it safe:
//
//   1. It fills blanks only. A number the rep typed is never overwritten — if the
//      day's records disagree with it, the disagreement is SHOWN and the rep
//      decides. Silently replacing what somebody typed is how a draft becomes a
//      source of wrong numbers.
//   2. A field nothing in the CRM records is left blank and SAID to be blank,
//      rather than filled with a 0 that reads as "I made no dials today".
//   3. Days are bucketed on the team's calendar, like everywhere else. A 9pm PT
//      deal belongs to that day, and a draft built in UTC would drop it.
//
// Ownership is `repIdentity().owns` — the one implementation — so a draft and the
// rep's own Closed Deals list can never disagree about which records are theirs.

import { recordDay, toReportDay } from '@/lib/report-date';

function n(v) { return Math.round((parseFloat(v) || 0) * 100) / 100; }

// Which after-call outcomes mean the call actually happened, and which mean the
// prospect sat through a pitch. A "Not qualified" call was taken but not pitched;
// a "No show" was neither.
var NO_SHOW = 'no show';
var UNPITCHED = { 'no show': true, 'not qualified': true };

function outcomeOf(r) { return String((r && r.outcome) || '').trim().toLowerCase(); }

// Which cash box a deal belongs in. addClosedDeal stores `program` ("MYFM - 6
// Month Coaching", "I2I - Digital Program", "Partner - …") and does not keep a
// separate brand column, so program is what has to be read — but a submission
// that carried `brand` and no program is still answered rather than dropped into
// neither box.
function brandOf(deal) {
  var text = String((deal && deal.program) || '') + ' ' + String((deal && deal.brand) || '');
  if (/myfm/i.test(text)) return 'MYFM';
  if (/i2i/i.test(text)) return 'I2I';
  if (/partner/i.test(text)) return 'Partner';
  return '';
}

// A field the draft can fill, with where the number came from so the form can say
// so rather than just showing a figure that appeared out of nowhere.
function counted(value, from) {
  return { value: String(value), from: from, derived: true };
}
// A field nothing in the CRM records. Carried through explicitly so the form can
// tell the rep which boxes are still theirs to fill, instead of leaving them
// looking identical to the ones that were computed.
function manual(why) {
  return { value: '', from: why, derived: false, manual: true };
}

// The closer's end-of-day.
export function buildEodDraft(input) {
  var day = toReportDay(input && input.day) || '';
  var owns = (input && input.owns) || function() { return false; };
  var booked = (input && input.booked) || [];
  var deals = (input && input.deals) || [];
  var afterCalls = (input && input.afterCalls) || [];

  // Booked calls the rep SET today. Their own bookings, on the day they filed them.
  var setToday = booked.filter(function(r) {
    return recordDay(r) === day && owns(r, 'closerEmail', 'setter');
  });

  // Calls that sat on the rep's calendar for today. A different question from the
  // one above: these were booked whenever, FOR today, with this rep as the closer.
  // bookedDay is what the setter typed, so a blank one cannot be counted.
  var onCalendar = booked.filter(function(r) {
    return r.bookedDay && toReportDay(r.bookedDay) === day && owns(r, 'closerEmail', 'closer');
  });

  var acToday = afterCalls.filter(function(r) {
    return recordDay(r) === day && owns(r, 'closerEmail', 'closer');
  });
  var noShows = acToday.filter(function(r) { return outcomeOf(r) === NO_SHOW; });
  var taken = acToday.filter(function(r) { return outcomeOf(r) !== NO_SHOW; });
  var pitched = acToday.filter(function(r) { return !UNPITCHED[outcomeOf(r)]; });

  var dealsToday = deals.filter(function(r) {
    return recordDay(r) === day && owns(r, 'closerEmail', 'closer');
  });

  var myfm = 0, i2i = 0, other = 0, total = 0;
  dealsToday.forEach(function(d) {
    var cash = n(d.cashCollected);
    total += cash;
    var brand = brandOf(d);
    if (brand === 'MYFM') myfm += cash;
    else if (brand === 'I2I') i2i += cash;
    else other += cash;
  });

  var fields = {
    netNewCallsBooked: counted(setToday.length, setToday.length === 1
      ? '1 booked call you filed today'
      : setToday.length + ' booked calls you filed today'),
    callsOnCalendar: counted(onCalendar.length,
      onCalendar.length + ' booked for today with you as closer'),
    callsTaken: counted(taken.length,
      taken.length + ' of your after-call reports today, minus no-shows'),
    callsNoShowed: counted(noShows.length, noShows.length === 1
      ? '1 after-call report marked No show'
      : noShows.length + ' after-call reports marked No show'),
    callsTakenAndPitched: counted(pitched.length,
      pitched.length + ' where the prospect sat through the pitch'),
    closes: counted(dealsToday.length,
      dealsToday.length === 1 ? '1 deal you closed today' : dealsToday.length + ' deals you closed today'),
    cashCollectedMYFM: counted(myfm, 'MYFM deals you closed today'),
    cashCollectedI2I: counted(i2i, 'I2I deals you closed today'),
    revenueOnDay: counted(total, 'every deal you closed today'),

    // Nothing in the CRM knows about these, and a 0 would read as a claim.
    callsCanceled: manual('Nothing records a cancellation — yours to fill in'),
    callsRescheduled: manual('Nothing records a reschedule — yours to fill in'),
    outboundDials: manual('The CRM does not count dials — yours to fill in'),
    improvementPlan: manual('Yours to write'),
  };

  var notes = [];
  // The EOD has two cash boxes and the floor sells three brands, so Partner cash
  // has nowhere to sit. Said out loud rather than quietly folded into I2I, where
  // it would misattribute somebody's commission.
  if (other > 0) {
    notes.push('Cash of ' + other + ' from deals that are neither MYFM nor I2I is in the day '
      + 'total but not in either box — the EOD has no third column.');
  }
  if (!dealsToday.length && !acToday.length && !setToday.length) {
    notes.push('Nothing filed today yet, so there is nothing to build from.');
  }

  return {
    day: day,
    fields: fields,
    notes: notes,
    counts: {
      booked: setToday.length,
      onCalendar: onCalendar.length,
      afterCalls: acToday.length,
      deals: dealsToday.length,
      cash: Math.round(total * 100) / 100,
    },
  };
}

// The phone setter's end-of-day. Measured on the dials and the sets, not on calls
// taken — a setter's report must carry no callsTaken, callsOnCalendar or
// callsTakenAndPitched at all, because eodRole() reads evidence of closing as
// outranking the stated position and would file the day onto the closer board.
export function buildSetterEodDraft(input) {
  var day = toReportDay(input && input.day) || '';
  var owns = (input && input.owns) || function() { return false; };
  var booked = (input && input.booked) || [];
  var deals = (input && input.deals) || [];

  var setToday = booked.filter(function(r) {
    return recordDay(r) === day && owns(r, 'closerEmail', 'setter');
  });
  // Deals credited to them as the SETTER. A setter reports the closes their sets
  // produced; they did not take those calls.
  var setDeals = deals.filter(function(r) {
    return recordDay(r) === day && owns(r, 'closerEmail', 'setter');
  });
  var cash = 0;
  setDeals.forEach(function(d) { cash += n(d.cashCollected); });

  return {
    day: day,
    fields: {
      sets: counted(setToday.length, setToday.length === 1
        ? '1 call you set today'
        : setToday.length + ' calls you set today'),
      closes: counted(setDeals.length,
        setDeals.length + ' deals closed off calls you set'),
      cashCollectedI2I: counted(Math.round(cash * 100) / 100,
        'cash from deals closed off your sets today'),

      outboundDials: manual('The CRM does not count dials — yours to fill in'),
      conversations: manual('Nothing records conversations — yours to fill in'),
      liveCalls: manual('Yours to fill in'),
      talkTime: manual('Yours to fill in'),
      followUpsScheduled: manual('Yours to fill in'),
      improvementPlan: manual('Yours to write'),
    },
    notes: setToday.length || setDeals.length ? []
      : ['Nothing filed today yet, so there is nothing to build from.'],
    counts: {
      booked: setToday.length,
      deals: setDeals.length,
      cash: Math.round(cash * 100) / 100,
    },
  };
}

// The DM setter's end-of-day. A different funnel: they are measured on the calls
// they SET and the deals that came off them, not on calls they took.
export function buildDmEodDraft(input) {
  var day = toReportDay(input && input.day) || '';
  var owns = (input && input.owns) || function() { return false; };
  var booked = (input && input.booked) || [];
  var deals = (input && input.deals) || [];

  var setToday = booked.filter(function(r) {
    return recordDay(r) === day && owns(r, 'closerEmail', 'setter');
  });
  // Deals credited to this rep as the SETTER. A DM setter reports closes they did
  // not personally take, which is why this matches on setter and not closer.
  var setDeals = deals.filter(function(r) {
    return recordDay(r) === day && owns(r, 'closerEmail', 'setter');
  });
  var cash = 0;
  setDeals.forEach(function(d) { cash += n(d.cashCollected); });

  return {
    day: day,
    fields: {
      netNewCallsBooked: counted(setToday.length,
        setToday.length + ' booked calls you filed today'),
      closes: counted(setDeals.length,
        setDeals.length + ' deals closed off calls you set'),
      cashCollectedI2I: counted(Math.round(cash * 100) / 100,
        'cash from deals closed off your sets today'),

      newLeads: manual('Nothing records inbox leads — yours to fill in'),
      conversations: manual('Nothing records conversations — yours to fill in'),
      setsShowed: manual('Yours to fill in'),
      leadsGhosted: manual('Yours to fill in'),
      leadsReactivated: manual('Yours to fill in'),
      commonThemes: manual('Yours to write'),
      biggestBottleneck: manual('Yours to write'),
    },
    notes: setToday.length || setDeals.length ? []
      : ['Nothing filed today yet, so there is nothing to build from.'],
    counts: {
      booked: setToday.length,
      deals: setDeals.length,
      cash: Math.round(cash * 100) / 100,
    },
  };
}
