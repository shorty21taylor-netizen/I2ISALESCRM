import { NextResponse } from 'next/server';
import { initStore, getOwnerRollup, getWorkspaces } from '@/lib/store';
import { resolveAccess } from '@/lib/access';

export var dynamic = 'force-dynamic';

// Company-wide rollup: every offer across every workspace, with revenue, cash
// collected and commissions. The client chooses which offers to include.
export async function GET(req) {
  await initStore();
  try {
    // The combined cross-client view belongs to the owner alone.
    var access = await resolveAccess(req);
    if (!access.canSeeAll) {
      return NextResponse.json({ error: 'Owner access required' }, { status: 403 });
    }

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
