import { NextResponse } from 'next/server';
import { effectiveReadWorkspace, resolveAccess } from '@/lib/access';
import { repScope } from '@/lib/rep-scope';
import { getCommissionsForCloser, getAllCommissions, getAllCommissionRates, initStore, getAllCloserProfiles, getWorkspaceUserList, getDisplayNameState } from '@/lib/store';
import { todayInReportTimezone } from '@/lib/report-date';

export var dynamic = 'force-dynamic';

function getEmptyLikeSummary() {
  return {
    totalDeals: 0, totalRevenue: 0, totalCommission: 0, pendingCommission: 0,
    approvedCommission: 0, paidCommission: 0, commissionRate: 0,
    avgDealValue: 0, avgCommission: 0,
  };
}

export async function GET(req) {
  await initStore();
  try {
    await initStore();
    var url = new URL(req.url);
    var closerName = url.searchParams.get('closer');
    var view = url.searchParams.get('view');
    var workspaceId = await effectiveReadWorkspace(req, url.searchParams.get('workspace'));

    // A rep can only ever ask about their own commissions, whatever they send.
    var scope = await repScope(req);
    if (scope) {
      closerName = scope.name;
      view = null;
    }

    // No name sent means "mine". The page used to send whatever name the browser
    // had stored, so anybody who had not confirmed a display name sent an empty
    // one and got a 400 — a commissions page stuck on "loading" forever. The
    // server knows who is asking; it does not need to be told.
    if (!closerName && view !== 'all') {
      var access = await resolveAccess(req);
      // The same name /api/auth/me reports, which is the one somebody confirmed
      // for themselves rather than whatever a form happened to stamp.
      closerName = (getDisplayNameState(access.email) || {}).displayName || '';
      if (!closerName) {
        var profiles = getAllCloserProfiles() || {};
        var mine = profiles[(access.email || '').toLowerCase()];
        closerName = (mine && mine.name) || '';
      }
      if (!closerName) {
        var members = await getWorkspaceUserList(workspaceId).catch(function() { return []; });
        var row = (members || []).filter(function(m) {
          return (m.email || '').toLowerCase() === (access.email || '').toLowerCase();
        })[0];
        closerName = (row && row.name) || '';
      }
    }

    if (view === 'all') {
      var all = getAllCommissions(workspaceId);
      var rates = getAllCommissionRates();
      return NextResponse.json({ success: true, closers: all, rates: rates });
    }

    if (closerName) {
      // Defaults to the month the team is standing in, not the server's.
      var month = url.searchParams.get('month') || todayInReportTimezone().slice(0, 7);
      if (month === 'all') month = '';
      var data = getCommissionsForCloser(closerName, workspaceId, month);
      return NextResponse.json({
        success: true,
        closerName: closerName,
        month: data.month,
        deals: data.deals,
        summary: data.summary,
        lifetime: data.lifetime,
        monthlyBreakdown: data.monthlyBreakdown,
      });
    }

    // Nothing to show rather than an error: a signed-in person with no closer
    // profile and no roster row has simply never closed anything.
    return NextResponse.json({
      success: true, closerName: '', month: '', deals: [],
      summary: getEmptyLikeSummary(), lifetime: getEmptyLikeSummary(), monthlyBreakdown: [],
    });
  } catch (e) {
    console.error('[Commissions API Error]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
