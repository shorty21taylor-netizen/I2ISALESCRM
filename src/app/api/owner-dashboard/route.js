import { NextResponse } from 'next/server';
import { initStore, getOwnerRollup, getWorkspaces } from '@/lib/store';

export var dynamic = 'force-dynamic';

// Company-wide rollup: every offer across every workspace, with revenue,
// cash collected and commission owed. The client decides which offers to include.
export async function GET(req) {
  await initStore();
  try {
    var url = new URL(req.url);
    var start = url.searchParams.get('start');
    var end = url.searchParams.get('end');

    var rollup = getOwnerRollup(start, end);

    return NextResponse.json({
      success: true,
      workspaces: getWorkspaces(),
      offers: rollup.offers,
      companies: rollup.companies,
      totals: rollup.totals,
      dateRange: rollup.dateRange,
    });
  } catch (e) {
    console.error('[Owner Dashboard API]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
