import { NextResponse } from 'next/server';
import { getOverview, getFilteredOverview, getCloserBreakdown, getRecentActivity, getStore } from '@/lib/store';

export var dynamic = 'force-dynamic';

export async function GET(req) {
  try {
    var url = new URL(req.url);
    var start = url.searchParams.get('start');
    var end = url.searchParams.get('end');

    var overview = (start && end) ? getFilteredOverview(start, end) : getOverview();
    var closers = getCloserBreakdown(start || undefined, end || undefined);
    var activity = getRecentActivity(20);
    var store = getStore();

    return NextResponse.json({
      success: true,
      overview: overview,
      closers: closers,
      activity: activity,
      counts: {
        bookedCalls: store.bookedCalls.length,
        closedDeals: store.closedDeals.length,
        eodReports: store.eodReports.length,
      },
      dateRange: { start: start, end: end },
      lastUpdated: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[Dashboard API Error]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
