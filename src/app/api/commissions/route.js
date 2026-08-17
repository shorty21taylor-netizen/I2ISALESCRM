import { NextResponse } from 'next/server';
import { getCommissionsForCloser, getAllCommissions, getAllCommissionRates, initStore } from '@/lib/store';

export var dynamic = 'force-dynamic';

export async function GET(req) {
  await initStore();
  try {
    await initStore();
    var url = new URL(req.url);
    var closerName = url.searchParams.get('closer');
    var view = url.searchParams.get('view');
    var workspaceId = url.searchParams.get('workspace') || undefined;

    if (view === 'all') {
      var all = getAllCommissions(workspaceId);
      var rates = getAllCommissionRates();
      return NextResponse.json({ success: true, closers: all, rates: rates });
    }

    if (closerName) {
      var data = getCommissionsForCloser(closerName, workspaceId);
      return NextResponse.json({ success: true, closerName: closerName, deals: data.deals, summary: data.summary, monthlyBreakdown: data.monthlyBreakdown });
    }

    return NextResponse.json({ error: 'Provide ?closer=Name or ?view=all' }, { status: 400 });
  } catch (e) {
    console.error('[Commissions API Error]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
