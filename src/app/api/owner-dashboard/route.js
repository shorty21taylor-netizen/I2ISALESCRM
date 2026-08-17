import { NextResponse } from 'next/server';
import { initStore, getOwnerRollup, getWorkspaces } from '@/lib/store';

export var dynamic = 'force-dynamic';

// Company-wide rollup: every offer across every workspace, with revenue, cash
// collected and commissions. The client chooses which offers to include.
export async function GET(req) {
  await initStore();
  try {
    var url = new URL(req.url);
    var rollup = getOwnerRollup(url.searchParams.get('start'), url.searchParams.get('end'));
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
