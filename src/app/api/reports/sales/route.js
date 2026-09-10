import { NextResponse } from 'next/server';
import { getStore, initStore, getWorkspace, getWorkspaces } from '@/lib/store';
import { effectiveReadWorkspace, matchesWorkspace } from '@/lib/access';
import { repScope, scopeList } from '@/lib/rep-scope';
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
    // A rep asking for analytics gets a report on themselves, not on the floor.
    var scope = await repScope(req);
    function mine(list, kind) {
      var rows = (list || []).filter(function(r) { return matchesWorkspace(r, workspaceId); });
      return scopeList(scope, rows, kind);
    }

    var metrics = computeSalesReport({
      start: start,
      end: end,
      eods: mine(store.eodReports, 'eod'),
      deals: mine(store.closedDeals, 'deal'),
      booked: mine(store.bookedCalls, 'booked'),
      afterCalls: mine(store.afterCallReports, 'afterCall'),
    });

    // ?narrative=skip keeps the analytics page snappy; only the printed report
    // pays for the written summary.
    var summary = url.searchParams.get('narrative') === 'skip'
      ? { text: '', source: 'skipped' }
      : await generateNarrative(metrics);

    // Viewing every workspace at once still needs a letterhead; fall back to the
    // first workspace, which on a single-client install is the only one.
    var ws = (workspaceId && workspaceId !== '__all__' && getWorkspace(workspaceId)) || getWorkspaces()[0] || null;

    return NextResponse.json({
      success: true,
      workspaceId: workspaceId || null,
      scopedToSelf: !!scope,
      scopedTo: scope ? scope.name : '',
      brand: {
        name: (ws && ws.branding && ws.branding.reportName) || (ws && ws.name) || 'Sales Report',
        tagline: 'Sales Performance Report',
        logoUrl: (ws && ws.branding && ws.branding.logoUrl) || '',
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
