import { NextResponse } from 'next/server';
import { getOverview, getFilteredOverview, getCloserBreakdown, getRecentActivity, getStore, initStore, getWorkspaces, ALL_WORKSPACES } from '@/lib/store';
import { initScheduler } from '@/lib/scheduler';

export var dynamic = 'force-dynamic';

export async function GET(req) {
  await initStore();
  try {
    var host = req.headers.get('host');
    var proto = req.headers.get('x-forwarded-proto') || 'https';
    if (host) initScheduler(proto + '://' + host);
    var url = new URL(req.url);
    var start = url.searchParams.get('start');
    var end = url.searchParams.get('end');

    var workspaceId = url.searchParams.get('workspace') || ALL_WORKSPACES;
    var isAll = workspaceId === ALL_WORKSPACES;

    // getOverview() is the cached, unscoped today view, so a scoped request always
    // goes through the filtered path.
    var overview = (start && end)
      ? getFilteredOverview(start, end, workspaceId)
      : (isAll ? getOverview() : getFilteredOverview(null, null, workspaceId));
    var closers = getCloserBreakdown(start || undefined, end || undefined, workspaceId);
    var activity = getRecentActivity(20, workspaceId);
    var store = getStore();

    function countIn(list) {
      if (isAll) return list.length;
      return list.filter(function(r) { return (r.workspaceId || 'default') === workspaceId; }).length;
    }

    return NextResponse.json({
      success: true,
      overview: overview,
      closers: closers,
      activity: activity,
      workspaceId: workspaceId,
      workspaces: getWorkspaces(),
      counts: {
        bookedCalls: countIn(store.bookedCalls),
        closedDeals: countIn(store.closedDeals),
        eodReports: countIn(store.eodReports),
      },
      dateRange: { start: start, end: end },
      lastUpdated: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[Dashboard API Error]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
