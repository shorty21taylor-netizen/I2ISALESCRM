// What each Summit AIOS tool actually does.
//
// Not one of these functions builds a query. They read the same in-memory store
// every page reads and hand it to the same engine every page uses —
// computeSalesReport, computeSetterBoard, summarise — so a figure quoted in chat
// is the figure on the dashboard by construction, not by agreement.
//
// Scope is enforced here, in the handler, on every call. The system prompt also
// describes the rule, but only so the model explains itself well; the prompt is
// not what stops a rep reading someone else's commission.
import { getStore, getCloserProfile, canonicalRep, getOnboardingSteps } from '@/lib/store';
import { matchesWorkspace } from '@/lib/access';
import { computeSalesReport } from '@/lib/sales-report';
import { computeSetterBoard, dedupeDeals } from '@/lib/dedupe-deals';
import { repIdentity } from '@/lib/rep-stats';
import { progressFor, repSteps, stepDone } from '@/lib/onboarding-plan';
import { summarise } from '@/lib/awards/evaluate';
import { getUser } from '@/lib/users';
import { toReportDay } from '@/lib/report-date';
import { resolveRange, previousWindow } from '@/lib/aios/range';
import { MAX_ROWS } from '@/lib/aios/tools';

function keyOf(name) {
  return String(name || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function inRange(day, start, end) {
  if (!day) return false;
  if (start && day < start) return false;
  if (end && day > end) return false;
  return true;
}

// The slice of the floor's records this caller is allowed to read at all, before
// any per-tool narrowing. Built once per turn.
export function buildContext(opts) {
  var store = getStore();
  function mine(list) {
    return (list || []).filter(function(r) { return matchesWorkspace(r, opts.workspaceId); });
  }
  return {
    access: opts.access,
    workspaceId: opts.workspaceId,
    // A rep scope; null when the caller may see the whole workspace.
    scope: opts.scope,
    selfName: opts.scope ? opts.scope.name : (opts.selfName || ''),
    canSeeTeam: !opts.scope,
    eods: mine(store.eodReports),
    deals: mine(store.closedDeals),
    booked: mine(store.bookedCalls),
    afterCalls: mine(store.afterCallReports || []),
  };
}

// Whose numbers is this call about? Null means "the whole floor".
// A rep may only ever name themselves; anyone else is refused by name, not
// silently swapped for their own row, so the answer is honest about the limit.
function resolveSubject(ctx, repName) {
  if (!repName) {
    if (ctx.canSeeTeam) return { name: null };
    return { name: ctx.selfName, self: true };
  }
  var wanted = canonicalRep(repName) || repName;
  if (!ctx.canSeeTeam) {
    if (keyOf(wanted) !== keyOf(ctx.selfName)) {
      return { denied: 'You can look up your own numbers. ' + wanted +
        '’s individual numbers are only visible to managers.' };
    }
    return { name: ctx.selfName, self: true };
  }
  return { name: wanted };
}

function report(ctx, range, filterName) {
  function only(list, nameFields) {
    if (!filterName) return list;
    return list.filter(function(r) {
      for (var i = 0; i < nameFields.length; i++) {
        if (keyOf(r[nameFields[i]]) === keyOf(filterName)) return true;
      }
      return false;
    });
  }
  return computeSalesReport({
    eods: only(ctx.eods, ['salesRep', 'closerName']),
    deals: only(ctx.deals, ['closer', 'setter']),
    booked: only(ctx.booked, ['setter', 'closer']),
    afterCalls: only(ctx.afterCalls, ['closer']),
    start: range.start,
    end: range.end,
  });
}

function headline(rep) {
  var v = rep.volume, r = rep.rates, c = rep.cash;
  return {
    dials: v.dials,
    conversations: v.conversations,
    liveCalls: v.liveCalls,
    callsBooked: v.sets,
    onCalendar: v.onCalendar,
    showed: v.taken,
    noShowed: v.noShowed,
    canceled: v.canceled,
    rescheduled: v.rescheduled,
    offersMade: v.pitched,
    closes: v.closes,
    offeredNoClose: v.offeredNoClose,
    followUpsScheduled: v.followUps,
    cashCollected: c.collected,
    avgDealSize: c.avgDeal,
    cashPerShow: c.perShow,
    cashPerOffer: c.perOffer,
    cashPerDay: c.perDay,
    showRate: r.showRate,
    noShowRate: r.noShowRate,
    pitchRate: r.pitchRate,
    closeRateOfOffers: r.closeRateOfOffers,
    closeRateOfShows: r.closeRateOfShows,
    dialToConversation: r.dialToConversation,
    conversationToSet: r.conversationToSet,
    daysReported: rep.range.daysReported,
    repsReporting: rep.range.repsReporting,
  };
}

// Anything counted from a field the floor barely fills in is not a fact, and the
// answer should say so rather than quote it.
function caveats(rep) {
  var q = rep.quality || {};
  var untracked = (q.untracked || []).map(function(u) { return u.label; });
  var out = [];
  if (untracked.length) out.push('Not reported at all in this range: ' + untracked.join(', ') + '.');
  if (q.derivedCalendar) out.push('Calls on calendar was under-reported, so it was derived from the outcomes.');
  if (q.rejectedCount) out.push(q.rejectedCount + ' impossible value(s) were dropped before totalling.');
  if (q.closeCheck && q.closeCheck.disagreement > 0) {
    out.push('EODs report ' + q.closeCheck.eodCloses + ' closes; the deal forms show ' +
      q.closeCheck.dealCloses + '. Cash always follows the deal forms.');
  }
  out.push('Disqualifications are not captured on any form, so there is no number for them.');
  return out;
}

function cap(rows, limit) {
  var n = Math.min(limit || 25, MAX_ROWS);
  return { rows: rows.slice(0, n), returned: Math.min(rows.length, n), total: rows.length };
}

// ---- the handlers ----

var HANDLERS = {};

HANDLERS.get_team_metrics = function(ctx, input) {
  var range = resolveRange(input.range, input.start, input.end);
  // A rep asking "how did we do" gets the team's aggregate, which is what the
  // spec allows them. It carries no individual's name.
  var rep = report(ctx, range, null);
  return {
    window: range.label,
    start: range.start,
    end: range.end,
    scope: ctx.canSeeTeam ? 'whole team' : 'team aggregate (no individual figures)',
    metrics: headline(rep),
    funnel: rep.funnel,
    caveats: caveats(rep),
  };
};

HANDLERS.get_rep_metrics = function(ctx, input) {
  var subject = resolveSubject(ctx, input.rep_name);
  if (subject.denied) return { denied: subject.denied };
  if (!subject.name) return { denied: 'Name the rep whose numbers you want.' };
  var range = resolveRange(input.range, input.start, input.end);
  var rep = report(ctx, range, subject.name);
  return {
    rep: subject.name,
    window: range.label,
    start: range.start,
    end: range.end,
    metrics: headline(rep),
    caveats: caveats(rep),
  };
};

HANDLERS.list_reps = function(ctx, input) {
  var range = resolveRange(input.range, input.start, input.end);
  var rep = report(ctx, range, null);
  var groups = rep.groups;
  var wanted = input.group && input.group !== 'all' ? [input.group] : ['closers', 'setters', 'dmSetters'];
  var rows = [];
  wanted.forEach(function(g) {
    (groups[g] || []).forEach(function(r) {
      rows.push({ name: r.name, group: g, daysReported: r.daysReported });
    });
  });
  return { window: range.label, reps: rows, count: rows.length };
};

HANDLERS.get_leaderboard = function(ctx, input) {
  var range = resolveRange(input.range, input.start, input.end);
  var rep = report(ctx, range, null);
  var rows;

  if (input.board === 'setters') {
    var board = computeSetterBoard(
      ctx.deals.filter(function(d) { return inRange(toReportDay(d.submittedAt), range.start, range.end); }),
      ctx.booked.filter(function(b) { return inRange(toReportDay(b.submittedAt), range.start, range.end); })
    );
    rows = (board || []).map(function(r, i) {
      return { rank: i + 1, name: r.name, callsBooked: r.booked, closes: r.closes,
        cash: r.cash, avgDeal: r.avgDeal, closeRate: r.closeRate };
    });
  } else {
    rows = (rep.groups.closers || []).map(function(r, i) {
      return { rank: i + 1, name: r.name, cash: r.cash, closes: r.closes, offersMade: r.pitched,
        showed: r.taken, avgDeal: r.avgDeal, showRate: r.showRate, closeRate: r.closeRate };
    });
  }

  // A rep sees the standings — where they sit and who is above them — but not
  // what anyone else's row is worth. Their own row stays whole.
  var redacted = false;
  if (!ctx.canSeeTeam) {
    rows = rows.map(function(r) {
      if (keyOf(r.name) === keyOf(ctx.selfName)) return r;
      redacted = true;
      return { rank: r.rank, name: r.name, cash: null, avgDeal: null, closes: null, closeRate: null };
    });
  }

  var out = cap(rows, input.limit);
  return {
    board: input.board,
    window: range.label,
    rows: out.rows,
    returned: out.returned,
    total: out.total,
    note: redacted
      ? 'Only this rep’s own row carries figures. Other people’s cash and closes are not theirs to see, so they are null — say that plainly rather than reporting them as zero.'
      : null,
  };
};

HANDLERS.get_daily_series = function(ctx, input) {
  var range = resolveRange(input.range, input.start, input.end);
  var rep = report(ctx, range, ctx.canSeeTeam ? null : ctx.selfName);
  var out = cap(rep.daily, MAX_ROWS);
  return {
    window: range.label,
    scope: ctx.canSeeTeam ? 'whole team' : 'this rep only',
    days: out.rows,
    returned: out.returned,
  };
};

HANDLERS.compare_periods = function(ctx, input) {
  var range = resolveRange(input.range, input.start, input.end);
  var prior = previousWindow(range);
  var now = headline(report(ctx, range, null));
  if (!prior) {
    return { window: range.label, metrics: now,
      note: 'That range is open-ended, so there is no equal window before it to compare against.' };
  }
  var before = headline(report(ctx, prior, null));
  var change = {};
  Object.keys(now).forEach(function(k) {
    var a = before[k], b = now[k];
    if (typeof a !== 'number' || typeof b !== 'number') { change[k] = null; return; }
    change[k] = { from: a, to: b, delta: Math.round((b - a) * 100) / 100,
      percent: a ? Math.round(((b - a) / a) * 1000) / 10 : null };
  });
  return { window: range.label, priorWindow: prior.label, current: now, prior: before, change: change };
};

HANDLERS.list_closed_deals = function(ctx, input) {
  var subject = resolveSubject(ctx, input.rep_name);
  if (subject.denied) return { denied: subject.denied };
  var range = resolveRange(input.range, input.start, input.end);

  var deals = dedupeDeals(ctx.deals.filter(function(d) {
    return inRange(toReportDay(d.submittedAt), range.start, range.end);
  })).deals;

  // A rep's deal list is their own, always — the same ownership rule their
  // dashboard uses, where a filed name is deliberate and the email is ambient.
  if (!ctx.canSeeTeam) {
    deals = ctx.scope.filter(deals, 'closerEmail', 'closer');
  } else if (subject.name) {
    deals = deals.filter(function(d) {
      return keyOf(d.closer) === keyOf(subject.name) || keyOf(d.setter) === keyOf(subject.name);
    });
  }

  var rows = deals.map(function(d) {
    return {
      day: toReportDay(d.submittedAt),
      closer: d.closer || null,
      setter: d.setter || null,
      program: d.program || null,
      cashCollected: parseFloat(d.cashCollected) || 0,
      source: d.outboundInbound || null,
    };
  }).sort(function(a, b) { return String(b.day).localeCompare(String(a.day)); });

  var out = cap(rows, input.limit);
  return { window: range.label, scope: ctx.canSeeTeam ? (subject.name || 'everyone') : 'this rep only',
    deals: out.rows, returned: out.returned, total: out.total,
    totalCash: rows.reduce(function(s, r) { return s + r.cashCollected; }, 0) };
};

HANDLERS.list_booked_calls = function(ctx, input) {
  var subject = resolveSubject(ctx, input.rep_name);
  if (subject.denied) return { denied: subject.denied };
  var range = resolveRange(input.range, input.start, input.end);

  var calls = ctx.booked.filter(function(b) {
    return inRange(toReportDay(b.submittedAt), range.start, range.end);
  });
  if (!ctx.canSeeTeam) {
    calls = ctx.scope.filter(calls, 'closerEmail', 'setter');
  } else if (subject.name) {
    calls = calls.filter(function(b) {
      return keyOf(b.setter) === keyOf(subject.name) || keyOf(b.closer) === keyOf(subject.name);
    });
  }

  var rows = calls.map(function(b) {
    return {
      day: toReportDay(b.submittedAt),
      setter: b.setter || null,
      closer: b.closer || null,
      qualified: b.qualified === true || b.qualified === 'yes',
    };
  }).sort(function(a, b) { return String(b.day).localeCompare(String(a.day)); });

  var out = cap(rows, input.limit);
  return { window: range.label, calls: out.rows, returned: out.returned, total: out.total };
};

HANDLERS.list_eod_reports = function(ctx, input) {
  var subject = resolveSubject(ctx, input.rep_name);
  if (subject.denied) return { denied: subject.denied };
  var range = resolveRange(input.range, input.start, input.end);

  var eods = ctx.eods.filter(function(e) {
    return inRange(e.date || toReportDay(e.submittedAt), range.start, range.end);
  });
  if (!ctx.canSeeTeam) {
    eods = ctx.scope.filter(eods, 'closerEmail', 'salesRep');
  } else if (subject.name) {
    eods = eods.filter(function(e) { return keyOf(e.salesRep) === keyOf(subject.name); });
  }

  var rows = eods.map(function(e) {
    return {
      day: e.date || toReportDay(e.submittedAt),
      rep: e.salesRep || null,
      position: e.position || e.role || null,
      dials: e.outboundDials, conversations: e.conversations, liveCalls: e.liveCalls,
      callsBooked: e.netNewCallsBooked, callsOnCalendar: e.callsOnCalendar,
      callsTaken: e.callsTaken, noShowed: e.callsNoShowed, canceled: e.callsCanceled,
      rescheduled: e.callsRescheduled, pitched: e.callsTakenAndPitched,
      closes: e.closes, cashCollected: e.cashCollected, revenueOnDay: e.revenueOnDay,
    };
  }).sort(function(a, b) { return String(b.day).localeCompare(String(a.day)); });

  var out = cap(rows, input.limit);
  return { window: range.label, reports: out.rows, returned: out.returned, total: out.total };
};

HANDLERS.get_data_quality = function(ctx, input) {
  var range = resolveRange(input.range, input.start, input.end);
  var rep = report(ctx, range, ctx.canSeeTeam ? null : ctx.selfName);
  var q = rep.quality;
  return {
    window: range.label,
    eodsFiled: q.eodsInRange,
    coverage: q.coverage,
    neverReported: (q.untracked || []).map(function(u) { return u.label; }),
    rejectedValues: q.rejectedCount,
    impossible: q.impossible,
    calendarDerived: q.derivedCalendar,
    closeCheck: q.closeCheck,
    clean: q.clean,
  };
};

HANDLERS.get_program_mix = function(ctx, input) {
  var range = resolveRange(input.range, input.start, input.end);
  var rep = report(ctx, range, ctx.canSeeTeam ? null : ctx.selfName);
  return { window: range.label, programs: rep.programs, source: rep.source };
};

HANDLERS.get_after_call_outcomes = function(ctx, input) {
  var range = resolveRange(input.range, input.start, input.end);
  var rep = report(ctx, range, ctx.canSeeTeam ? null : ctx.selfName);
  return {
    window: range.label,
    filed: rep.reporting.afterCallsFiled,
    outcomes: rep.reporting.afterCallOutcomes,
  };
};

HANDLERS.get_awards = async function(ctx, input) {
  var subject = resolveSubject(ctx, input.rep_name);
  if (subject.denied) return { denied: subject.denied };
  var name = subject.name || ctx.selfName;
  if (!name) return { denied: 'Name the rep whose awards you want.' };

  // Awards are keyed by account, and the only account this caller is entitled
  // to by email is their own. A manager asking about someone else is answered
  // from that person's filed name, the same way every other figure is.
  var email = subject.self ? ctx.access.email : emailForName(ctx, name);
  if (!email) return { note: name + ' has no account on Summit OS yet, so no awards have been granted to them.' };

  var account = await getUser(email).catch(function() { return null; });
  var profile = getCloserProfile(email);
  var identity = repIdentity(profile, email, account && account.name);
  var deals = dedupeDeals(ctx.deals).deals.filter(function(d) { return identity.owns(d, 'closerEmail', 'closer'); });
  var eods = ctx.eods.filter(function(e) { return identity.owns(e, 'closerEmail', 'salesRep'); });
  var bookings = ctx.booked.filter(function(b) {
    return identity.owns(b, 'closerEmail', 'setter') || identity.owns(b, 'closerEmail', 'closer');
  });

  var s = summarise({
    email: email,
    role: (account && account.role) || (profile && profile.role) || 'closer',
    deals: deals, eods: eods, bookings: bookings, monthlyLeaders: {},
  });

  return {
    rep: identity.name,
    track: s.track,
    earned: s.earnedCount,
    of: s.total,
    held: s.awards.filter(function(a) { return a.earned; })
      .map(function(a) { return { name: a.name, rarity: a.rarity, awardedAt: a.awardedAt }; }),
    nextUp: s.nextUp.map(function(a) {
      return { name: a.name, description: a.description, at: a.value, needs: a.threshold, percent: a.percent };
    }),
    notMeasurable: s.unbacked,
  };
};

HANDLERS.get_onboarding_status = async function(ctx, input) {
  var subject = resolveSubject(ctx, input.rep_name);
  if (subject.denied) return { denied: subject.denied };
  var name = subject.name || ctx.selfName;
  var email = subject.self ? ctx.access.email : emailForName(ctx, name);
  if (!email) return { note: name + ' has no account on Summit OS yet, so there is no onboarding record.' };

  var steps = getOnboardingSteps(email) || {};
  var progress = progressFor(steps);
  var owed = repSteps().filter(function(s) { return !stepDone(s, steps[s.id]); });
  return {
    rep: name,
    percent: progress.percent,
    complete: progress.complete,
    done: progress.done,
    of: progress.total,
    stillOwed: owed.map(function(s) { return { phase: s.phaseTitle, step: s.title }; }),
  };
};

// The account behind a filed name, when there is one. Managers only ever reach
// this via resolveSubject, which has already decided they may ask.
function emailForName(ctx, name) {
  var store = getStore();
  var profiles = store.closerProfiles || {};
  var hit = '';
  Object.keys(profiles).forEach(function(email) {
    var p = profiles[email];
    var candidate = p && (p.displayName || p.name);
    if (candidate && keyOf(candidate) === keyOf(name)) hit = email;
  });
  return hit;
}

export async function runTool(ctx, name, input) {
  var fn = HANDLERS[name];
  if (!fn) return { error: 'There is no tool called "' + name + '".' };
  return await fn(ctx, input);
}
