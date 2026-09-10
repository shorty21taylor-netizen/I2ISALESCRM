import { NextResponse } from 'next/server';
import { getStore, initStore, getWorkspace } from '@/lib/store';
import { effectiveReadWorkspace, matchesWorkspace } from '@/lib/access';
import { computeSalesReport } from '@/lib/sales-report';
import { generateNarrative } from '@/lib/report-narrative';
import { todayInReportTimezone } from '@/lib/report-date';

export var dynamic = 'force-dynamic';

// Everything the printed Summit Closing Group report needs, for one date range,
// in one request: the metrics and the written summary that goes under them.
export async function GET(req) {
  await initStore();
  try {
    var url = new URL(req.url);
    var end = url.searchParams.get('end') || todayInReportTimezone();
    var start = url.searchParams.get('start');
    if (!start) {
      var d = new Date(end + 'T12:00:00');
      d.setDate(d.getDate() - 29);
      start = d.toISOString().slice(0, 10);
    }
    if (start > end) {
      return NextResponse.json({ error: 'start must be on or before end' }, { status: 400 });
    }

    var workspaceId = await effectiveReadWorkspace(req, url.searchParams.get('workspace'));
    var store = getStore();
    function mine(list) {
      return (list || []).filter(function(r) { return matchesWorkspace(r, workspaceId); });
    }

    var metrics = computeSalesReport({
      start: start,
      end: end,
      eods: mine(store.eodReports),
      deals: mine(store.closedDeals),
      booked: mine(store.bookedCalls),
      afterCalls: mine(store.afterCallReports),
    });

    // ?narrative=skip keeps the analytics page snappy; only the printed report
    // pays for the written summary.
    var summary = url.searchParams.get('narrative') === 'skip'
      ? { text: '', source: 'skipped' }
      : await generateNarrative(metrics);

    var ws = workspaceId && workspaceId !== '__all__' ? getWorkspace(workspaceId) : null;

    return NextResponse.json({
      success: true,
      workspaceId: workspaceId || null,
      brand: {
        name: (ws && ws.name) || 'Summit Closing Group',
        tagline: 'Sales Performance Report',
      },
      metrics: metrics,
      summary: summary,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[api/reports/sales]', err);
    return NextResponse.json({ error: 'Could not build the report' }, { status: 500 });
  }
}
