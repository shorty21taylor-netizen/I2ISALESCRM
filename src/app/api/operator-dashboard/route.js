import { NextResponse } from 'next/server';
import { initStore, getOperatorRollup, getWorkspaces, getStore } from '@/lib/store';
import { resolveAccess } from '@/lib/access';
import { publicWorkspace } from '@/lib/workspace-public';
import { computeCommandMetrics } from '@/lib/command-metrics';

export var dynamic = 'force-dynamic';

// Company-wide rollup: every offer across every workspace, with revenue, cash
// collected and commissions. The client chooses which offers to include.
export async function GET(req) {
  await initStore();
  try {
    // The combined cross-client view belongs to the operator alone.
    var access = await resolveAccess(req);
    if (!access.canSeeAll) {
      return NextResponse.json({ error: 'Operator access required' }, { status: 403 });
    }

    var url = new URL(req.url);
    var start = url.searchParams.get('start');
    var end = url.searchParams.get('end');
    var rollup = getOperatorRollup(start, end);
    var workspaces = getWorkspaces();

    // The company's own numbers, added up across every workspace. The whole store
    // goes in on purpose: the report filters each record type on its own date
    // field, so pre-filtering here on one of them would drop the others.
    var st = getStore();
    var metrics = computeCommandMetrics({
      start: rollup.dateRange ? rollup.dateRange.start : start,
      end: rollup.dateRange ? rollup.dateRange.end : end,
      workspaces: workspaces,
      deals: st.closedDeals || [],
      eods: st.eodReports || [],
      booked: st.bookedCalls || [],
      afterCalls: st.afterCallReports || [],
    });

    return NextResponse.json({
      success: true,
      // Stripped: the raw records carry teamPasswordSalt and teamPasswordHash,
      // and this route was serialising them whole to the browser.
      workspaces: workspaces.map(publicWorkspace),
      metrics: metrics,
      offers: rollup.offers,
      companies: rollup.companies,
      totals: rollup.totals,
      dateRange: rollup.dateRange,
    });
  } catch (e) {
    console.error('[Operator Dashboard API]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
