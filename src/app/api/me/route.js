import { NextResponse } from 'next/server';
import {
  initStore, getStore, getCloserProfile, updateCloserProfile,
  getCommissionsForCloser, canonicalRep,
} from '@/lib/store';
import { callerEmail, effectiveReadWorkspace, matchesWorkspace, resolveAccess } from '@/lib/access';
import { dedupeDeals } from '@/lib/dedupe-deals';
import { toReportDay, todayInReportTimezone } from '@/lib/report-date';
import { computeRepStats, repIdentity, computeGoalPace } from '@/lib/rep-stats';

export var dynamic = 'force-dynamic';

var MAX_AVATAR_BYTES = 400 * 1024;

// Who finished each month on top, used for the "Top of the Board" award.
function leadersByMonth(deals) {
  var months = {};
  deals.forEach(function(d) {
    var month = toReportDay(d.submittedAt).slice(0, 7);
    var name = canonicalRep(d.closer) || d.closer;
    if (!name) return;
    if (!months[month]) months[month] = {};
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

// Where this rep sits on the board, without handing them anyone else's numbers.
function standing(deals, identity, start, end) {
  var totals = {};
  deals.forEach(function(d) {
    var day = toReportDay(d.submittedAt);
    if (day < start || day > end) return;
    var name = canonicalRep(d.closer) || d.closer;
    if (!name) return;
    totals[name] = (totals[name] || 0) + (parseFloat(d.cashCollected) || 0);
  });
  var rows = Object.keys(totals).map(function(name) { return { name: name, cash: totals[name] }; })
    .sort(function(a, b) { return b.cash - a.cash; });
  var index = -1;
  for (var i = 0; i < rows.length; i++) {
    if (identity.matches(rows[i].name)) { index = i; break; }
  }
  return {
    rank: index === -1 ? null : index + 1,
    of: rows.length,
    // The gap to the rep above, which is the only other rep's figure they see,
    // and only as a distance from their own.
    behindBy: index > 0 ? Math.round(rows[index - 1].cash - rows[index].cash) : 0,
  };
}

export async function GET(req) {
  await initStore();
  try {
    var viewer = callerEmail(req);
    if (!viewer) return NextResponse.json({ error: 'Sign in to see your stats' }, { status: 401 });

    var url = new URL(req.url);
    // ?rep= lets a manager open someone else's page. A rep asking for another
    // rep gets their own, not a 403 — there is nothing to leak and nothing to
    // explain.
    var access = await resolveAccess(req);
    var requested = (url.searchParams.get('rep') || '').trim().toLowerCase();
    var email = (access.canSeeTeam && requested) ? requested : viewer;
    var viewingSomeoneElse = email !== viewer;
    var end = url.searchParams.get('end') || todayInReportTimezone();
    var start = url.searchParams.get('start');
    if (!start) {
      var d = new Date(end + 'T12:00:00');
      d.setDate(d.getDate() - 29);
      start = d.toISOString().slice(0, 10);
    }

    var workspaceId = await effectiveReadWorkspace(req, url.searchParams.get('workspace'));
    var store = getStore();
    function mine(list) {
      return (list || []).filter(function(r) { return matchesWorkspace(r, workspaceId); });
    }

    var profile = getCloserProfile(email);
    var identity = repIdentity(profile, email);
    var deals = mine(store.closedDeals);
    var deduped = dedupeDeals(deals).deals;

    var stats = computeRepStats({
      identity: identity,
      start: start,
      end: end,
      today: todayInReportTimezone(),
      eods: mine(store.eodReports),
      deals: deals,
      booked: mine(store.bookedCalls),
      afterCalls: mine(store.afterCallReports),
      monthlyLeaders: leadersByMonth(deduped),
    });

    var commissions = getCommissionsForCloser(identity.name, workspaceId);
    var myDeals = deduped.filter(function(d) { return identity.owns(d, 'closerEmail', 'closer'); });
    var goal = computeGoalPace(profile && profile.monthlyGoal, myDeals, todayInReportTimezone());

    return NextResponse.json({
      success: true,
      viewingSomeoneElse: viewingSomeoneElse,
      canEdit: !viewingSomeoneElse,
      profile: {
        name: (profile && profile.displayName) || identity.name,
        recordName: identity.name,
        email: identity.email,
        avatarUrl: (profile && profile.avatarUrl) || '',
        tagline: (profile && profile.tagline) || '',
        monthlyGoal: (profile && profile.monthlyGoal) || 0,
        onboarded: !!(profile && profile.onboardedAt),
        joinedAt: (profile && profile.registeredAt) || '',
      },
      goal: goal,
      stats: stats,
      standing: standing(deduped, identity, start, end),
      commissions: {
        rate: commissions.summary ? commissions.summary.rate : null,
        summary: commissions.summary,
        monthly: (commissions.summary && commissions.summary.monthlyBreakdown) || [],
      },
    });
  } catch (err) {
    console.error('[api/me]', err);
    return NextResponse.json({ error: 'Could not load your stats' }, { status: 500 });
  }
}

// A rep edits their own profile and nobody else's.
export async function POST(req) {
  await initStore();
  try {
    var viewer = callerEmail(req);
    if (!viewer) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });

    var body = await req.json();
    var access = await resolveAccess(req);
    var target = (body.rep || '').trim().toLowerCase();
    // Only a manager may write to someone else's profile, and then only their goal.
    // A rep naming someone else is refused outright rather than having the change
    // quietly applied to their own record.
    if (target && target !== viewer && !access.canSeeTeam) {
      return NextResponse.json({ error: 'You can only change your own profile' }, { status: 403 });
    }
    var email = (access.canSeeTeam && target) ? target : viewer;
    var editingSomeoneElse = email !== viewer;
    var patch = {};

    if (typeof body.avatarUrl === 'string') {
      if (body.avatarUrl.length > MAX_AVATAR_BYTES) {
        return NextResponse.json({ error: 'That photo is too large. Keep it under 400KB.' }, { status: 413 });
      }
      var ok = body.avatarUrl === ''
        || body.avatarUrl.indexOf('data:image/') === 0
        || body.avatarUrl.indexOf('https://') === 0;
      if (!ok) return NextResponse.json({ error: 'Photo must be an uploaded image or an https link' }, { status: 400 });
      patch.avatarUrl = body.avatarUrl;
    }
    if (typeof body.tagline === 'string') patch.tagline = body.tagline.slice(0, 90);
    if (typeof body.displayName === 'string') patch.displayName = body.displayName.trim().slice(0, 60);
    if (body.monthlyGoal !== undefined) {
      var goalValue = Math.max(0, Math.round(parseFloat(body.monthlyGoal) || 0));
      if (goalValue > 100000000) {
        return NextResponse.json({ error: 'That target is not a number of dollars' }, { status: 400 });
      }
      patch.monthlyGoal = goalValue;
    }
    if (body.onboarded) patch.onboardedAt = new Date().toISOString();

    if (editingSomeoneElse) {
      // A manager sets targets. Someone's photo and how they introduce
      // themselves are theirs alone.
      patch = Object.prototype.hasOwnProperty.call(patch, 'monthlyGoal')
        ? { monthlyGoal: patch.monthlyGoal }
        : {};
      if (!Object.keys(patch).length) {
        return NextResponse.json({ error: 'You can only set this rep\'s target' }, { status: 403 });
      }
    }

    var result = updateCloserProfile(email, patch);
    if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ success: true, profile: result.profile });
  } catch (err) {
    console.error('[api/me POST]', err);
    return NextResponse.json({ error: 'Could not save your profile' }, { status: 500 });
  }
}
