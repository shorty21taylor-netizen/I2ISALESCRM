import { NextResponse } from 'next/server';
import { getLeaderboard, getLeaderboardTotals, getPartnerLeaderboard, getSetterLeaderboard, initStore, getWorkspaces } from '@/lib/store';
import { effectiveReadWorkspace, resolveAccess, onboardingOwed } from '@/lib/access';
import { getOnboardingSteps } from '@/lib/store';

export var dynamic = 'force-dynamic';

// Standings for every rep who has submitted a close or an EOD, ranked by cash
// collected. ?start / ?end are inclusive 'YYYY-MM-DD'; omit both for all time.
export async function GET(req) {
  await initStore();
  try {
    var url = new URL(req.url);
    var start = url.searchParams.get('start');
    var end = url.searchParams.get('end');

    // A member is pinned to their own workspace regardless of the query string.
    // The board is what a new rep is told they get once they are through
    // onboarding, so it is the thing that actually stays shut until then.
    // Their own dashboard and the submit forms stay open throughout — a gate
    // that stopped someone working would cost the company money to make a point.
    var access = await resolveAccess(req);
    if (onboardingOwed(access, getOnboardingSteps(access.email))) {
      return NextResponse.json({
        error: 'The leaderboard opens when your onboarding is finished.',
        onboardingRequired: true,
      }, { status: 403 });
    }

    var workspaceId = await effectiveReadWorkspace(req, url.searchParams.get('workspace'));

    var reps = getLeaderboard(start, end, workspaceId);
    var partner = getPartnerLeaderboard(start, end, workspaceId);
    var setters = getSetterLeaderboard(start, end, workspaceId);

    return NextResponse.json({
      success: true,
      reps: reps,
      totals: getLeaderboardTotals(reps),
      partner: partner,
      setters: setters,
      workspaceId: workspaceId,
      workspaces: getWorkspaces(),
      dateRange: { start: start, end: end },
      lastUpdated: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[Leaderboard API Error]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
