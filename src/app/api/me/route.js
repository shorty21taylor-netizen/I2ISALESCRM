import { NextResponse } from 'next/server';
import {
  initStore, getStore, getCloserProfile, updateCloserProfile,
  getCommissionsForCloser, canonicalRep,
} from '@/lib/store';
import { callerEmail, effectiveReadWorkspace, matchesWorkspace } from '@/lib/access';
import { dedupeDeals } from '@/lib/dedupe-deals';
import { toReportDay, todayInReportTimezone } from '@/lib/report-date';
import { computeRepStats, repIdentity } from '@/lib/rep-stats';

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
    var email = callerEmail(req);
    if (!email) return NextResponse.json({ error: 'Sign in to see your stats' }, { status: 401 });

    var url = new URL(req.url);
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

    return NextResponse.json({
      success: true,
      profile: {
        name: identity.name,
        email: identity.email,
        avatarUrl: (profile && profile.avatarUrl) || '',
        tagline: (profile && profile.tagline) || '',
        joinedAt: (profile && profile.registeredAt) || '',
      },
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
    var email = callerEmail(req);
    if (!email) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });

    var body = await req.json();
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

    var result = updateCloserProfile(email, patch);
    if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ success: true, profile: result.profile });
  } catch (err) {
    console.error('[api/me POST]', err);
    return NextResponse.json({ error: 'Could not save your profile' }, { status: 500 });
  }
}
