import { NextResponse } from 'next/server';
import { getOverview, getCloserBreakdown, getRecentActivity, getStore, initStore } from '@/lib/store';

export var dynamic = 'force-dynamic';

export async function GET() {
  try {
    await initStore();
    var overview = getOverview();
    var closers = getCloserBreakdown();
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
      lastUpdated: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[Dashboard API Error]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
