import { NextResponse } from 'next/server';
import { initStore, getStore, getCloserProfile, markAwardsSeen, canonicalRep } from '@/lib/store';
import { callerEmail, resolveAccess, effectiveReadWorkspace, matchesWorkspace } from '@/lib/access';
import { getUser } from '@/lib/users';
import { dedupeDeals } from '@/lib/dedupe-deals';
import { toReportDay } from '@/lib/report-date';
import { repIdentity } from '@/lib/rep-stats';
import { summarise, evaluateAwards } from '@/lib/awards/evaluate';

export var dynamic = 'force-dynamic';

// Who led each month, for Rainmaker. Same shape the rep dashboard already uses.
function leadersByMonth(deals) {
  var months = {};
  deals.forEach(function(d) {
    var month = toReportDay(d.submittedAt).slice(0, 7);
    var name = canonicalRep(d.closer) || d.closer;
    if (!name || !month) return;
    months[month] = months[month] || {};
    months[month][name] = (months[month][name] || 0) + (parseFloat(d.cashCollected) || 0);
  });
  var leaders = {};
  Object.keys(months).forEach(function(month) {
    var best = null;
    Object.keys(months[month]).forEach(function(name) {
      if (!best || months[month][name] > best.cash) best = { name: name, cash: months[month][name] };
    });
    if (best) leaders[month] = best.name;
  });
  return leaders;
}

// This rep's own records, by the same ownership rule that decides every other
// figure on their dashboard: the filed name is deliberate, the email is ambient.
async function gather(req, email) {
  var url = new URL(req.url);
  var workspaceId = await effectiveReadWorkspace(req, url.searchParams.get('workspace'));
  var store = getStore();
  function mine(list) {
    return (list || []).filter(function(r) { return matchesWorkspace(r, workspaceId); });
  }

  var profile = getCloserProfile(email);
  var account = await getUser(email).catch(function() { return null; });
  var identity = repIdentity(profile, email, account && account.name);

  var allDeals = dedupeDeals(mine(store.closedDeals)).deals;

  return {
    email: email,
    role: (account && account.role) || (profile && profile.role) || 'closer',
    identity: identity,
    deals: allDeals.filter(function(d) { return identity.owns(d, 'closerEmail', 'closer'); }),
    eods: mine(store.eodReports).filter(function(e) { return identity.owns(e, 'closerEmail', 'salesRep'); }),
    bookings: mine(store.bookedCalls).filter(function(b) {
      return identity.owns(b, 'closerEmail', 'setter') || identity.owns(b, 'closerEmail', 'closer');
    }),
    monthlyLeaders: leadersByMonth(allDeals),
  };
}

export async function GET(req) {
  await initStore();
  try {
    var viewer = callerEmail(req);
    if (!viewer) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });

    var url = new URL(req.url);
    var access = await resolveAccess(req);
    var requested = (url.searchParams.get('rep') || '').trim().toLowerCase();
    var email = (access.canSeeTeam && requested) ? requested : viewer;

    var input = await gather(req, email);

    // One evaluation per dashboard load — not one per deal. Anything newly
    // earned is granted here so it is already on the wall by the time the panel
    // renders, and the unlock queue below picks it up in the same response.
    evaluateAwards(input);

    var summary = summarise(input);
    return NextResponse.json({
      success: true,
      viewingSomeoneElse: email !== viewer,
      track: summary.track,
      awards: summary.awards,
      earnedCount: summary.earnedCount,
      total: summary.total,
      nextUp: summary.nextUp,
      // Only the viewer's own unlocks animate. Nobody wants a manager's screen
      // celebrating on someone else's behalf.
      unseen: email === viewer ? summary.unseen : [],
      unbacked: summary.unbacked,
    });
  } catch (err) {
    console.error('[api/awards]', err);
    return NextResponse.json({ error: 'Could not load awards' }, { status: 500 });
  }
}

// Marking unlocks as watched. The client calls this as the animation starts, so
// a refresh part-way through cannot replay it.
export async function POST(req) {
  await initStore();
  try {
    var viewer = callerEmail(req);
    if (!viewer) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
    var body = await req.json();
    var ids = Array.isArray(body.awardIds) ? body.awardIds.slice(0, 40) : [];
    // Always the caller's own row — a seen stamp is not something one person
    // sets on another.
    var changed = markAwardsSeen(viewer, ids);
    return NextResponse.json({ success: true, marked: changed });
  } catch (err) {
    console.error('[api/awards POST]', err);
    return NextResponse.json({ error: 'Could not save that' }, { status: 500 });
  }
}
