import { NextResponse } from 'next/server';
import { getLeaderboard, getLeaderboardTotals, initStore, getWorkspaces } from '@/lib/store';
import { effectiveReadWorkspace } from '@/lib/access';

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
    var workspaceId = await effectiveReadWorkspace(req, url.searchParams.get('workspace'));

    var reps = getLeaderboard(start, end, workspaceId);

    return NextResponse.json({
      success: true,
      reps: reps,
      totals: getLeaderboardTotals(reps),
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
