import { NextResponse } from 'next/server';
import {
  initStore, getStore, getAllCloserProfiles, canonicalRep,
} from '@/lib/store';
import { resolveAccess } from '@/lib/access';
import { getUser } from '@/lib/users';
import { dedupeDeals } from '@/lib/dedupe-deals';
import { toReportDay } from '@/lib/report-date';
import { repIdentity } from '@/lib/rep-stats';
import { summarise, evaluateAwards } from '@/lib/awards/evaluate';

export var dynamic = 'force-dynamic';

// The one-time catch-up.
//
// Without it, the first login after this ships is a slot machine: a rep with a
// year of closes behind them trips eight medals at once and sits through half a
// minute of animation. This grants everything already earned with seenAt
// pre-stamped, so none of it plays. Only what is earned afterwards animates.
//
// GET is a dry run and changes nothing. POST needs {"confirm":"backfill"}.
// It writes rep_awards rows and nothing else — no sales record is read for
// anything but counting, and none is written at all.

async function plan(commit) {
  var store = getStore();
  var before = {
    bookedCalls: (store.bookedCalls || []).length,
    closedDeals: (store.closedDeals || []).length,
    eodReports: (store.eodReports || []).length,
  };

  var deduped = dedupeDeals(store.closedDeals || []).deals;

  var months = {};
  deduped.forEach(function(d) {
    var m = toReportDay(d.submittedAt).slice(0, 7);
    var name = canonicalRep(d.closer) || d.closer;
    if (!m || !name) return;
    months[m] = months[m] || {};
    months[m][name] = (months[m][name] || 0) + (parseFloat(d.cashCollected) || 0);
  });
  var leaders = {};
  Object.keys(months).forEach(function(m) {
    var best = null;
    Object.keys(months[m]).forEach(function(name) {
      if (!best || months[m][name] > best.cash) best = { name: name, cash: months[m][name] };
    });
    if (best) leaders[m] = best.name;
  });

  var profiles = getAllCloserProfiles() || {};
  var emails = Object.keys(profiles);
  var perRep = [];
  var total = 0;
  var unbacked = [];

  for (var i = 0; i < emails.length; i++) {
    var email = emails[i];
    var account = await getUser(email).catch(function() { return null; });
    var identity = repIdentity(profiles[email], email, account && account.name);

    var input = {
      email: email,
      role: (account && account.role) || 'closer',
      identity: identity,
      deals: deduped.filter(function(d) { return identity.owns(d, 'closerEmail', 'closer'); }),
      eods: (store.eodReports || []).filter(function(e) { return identity.owns(e, 'closerEmail', 'salesRep'); }),
      bookings: (store.bookedCalls || []).filter(function(b) {
        return identity.owns(b, 'closerEmail', 'setter') || identity.owns(b, 'closerEmail', 'closer');
      }),
      monthlyLeaders: leaders,
    };

    var granted;
    var summary = summarise(input);
    unbacked = summary.unbacked;
    if (commit) {
      granted = evaluateAwards(input, { silent: true }).granted;
    } else {
      granted = summary.awards.filter(function(a) {
        return !a.earned && !a.dark && a.value >= a.threshold;
      }).map(function(a) { return a.id; });
    }
    if (granted.length) {
      total += granted.length;
      perRep.push({ name: identity.name, email: email, awards: granted });
    }
  }

  var after = {
    bookedCalls: (store.bookedCalls || []).length,
    closedDeals: (store.closedDeals || []).length,
    eodReports: (store.eodReports || []).length,
  };

  return {
    committed: !!commit,
    reps: emails.length,
    totalGranted: total,
    perRep: perRep,
    unbackedMetrics: unbacked,
    recordCounts: {
      before: before,
      after: after,
      unchanged: before.bookedCalls === after.bookedCalls
        && before.closedDeals === after.closedDeals
        && before.eodReports === after.eodReports,
    },
  };
}

export async function GET(req) {
  await initStore();
  try {
    var access = await resolveAccess(req);
    if (!access.canSeeAll) return NextResponse.json({ error: 'Operator access required' }, { status: 403 });
    return NextResponse.json(Object.assign({ success: true, dryRun: true }, await plan(false)));
  } catch (e) {
    console.error('[backfill-awards]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  await initStore();
  try {
    var access = await resolveAccess(req);
    if (!access.canSeeAll) return NextResponse.json({ error: 'Operator access required' }, { status: 403 });
    var body = await req.json().catch(function() { return {}; });
    if (body.confirm !== 'backfill') {
      return NextResponse.json({ error: 'Send {"confirm":"backfill"} to write.' }, { status: 400 });
    }
    return NextResponse.json(Object.assign({ success: true, dryRun: false }, await plan(true)));
  } catch (e) {
    console.error('[backfill-awards POST]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
