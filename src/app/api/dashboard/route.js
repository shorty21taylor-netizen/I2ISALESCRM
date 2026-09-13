import { NextResponse } from 'next/server';
import { getOverview, getFilteredOverview, getCloserBreakdown, getRecentActivity, getStore, initStore, getWorkspaces, ALL_WORKSPACES } from '@/lib/store';
import { initScheduler } from '@/lib/scheduler';
import { effectiveReadWorkspace, matchesWorkspace, ALL_WORKSPACES as ACCESS_ALL } from '@/lib/access';
import { repScope } from '@/lib/rep-scope';
import { computeSalesReport } from '@/lib/sales-report';
import { computeSetterBoard } from '@/lib/dedupe-deals';

export var dynamic = 'force-dynamic';

export async function GET(req) {
  await initStore();
  try {
    var host = req.headers.get('host');
    var proto = req.headers.get('x-forwarded-proto') || 'https';
    if (host) initScheduler(proto + '://' + host);
    var url = new URL(req.url);
    var start = url.searchParams.get('start');
    var end = url.searchParams.get('end');

    // A member is pinned to their own workspace regardless of the query string.
    var workspaceId = await effectiveReadWorkspace(req, url.searchParams.get('workspace'));

    // This payload is team-wide by construction — overview, every closer's
    // breakdown, the whole activity feed. There is no honest way to hand a
    // subset of it to a rep, so they are sent to their own dashboard instead.
    var scope = await repScope(req);
    if (scope) {
      return NextResponse.json({ success: true, scopedToSelf: true, redirect: '/me' });
    }
    var isAll = workspaceId === ACCESS_ALL;

    // getOverview() is the cached, unscoped today view, so a scoped request always
    // goes through the filtered path.
    var overview = (start && end)
      ? getFilteredOverview(start, end, workspaceId)
      : (isAll ? getOverview() : getFilteredOverview(null, null, workspaceId));
    var closers = getCloserBreakdown(start || undefined, end || undefined, workspaceId);
    var activity = getRecentActivity(20, workspaceId);
    var store = getStore();

    function countIn(list) {
      if (isAll) return list.length;
      return list.filter(function(r) { return matchesWorkspace(r, workspaceId); }).length;
    }

    // The two boards the team dashboard is actually read for. Both come out of
    // the same engine the printed report uses, so a number here can never
    // disagree with the same number on the report or on a rep's own page.
    var report = computeSalesReport({
      eods: store.eodReports.filter(function(r) { return matchesWorkspace(r, workspaceId); }),
      deals: store.closedDeals.filter(function(r) { return matchesWorkspace(r, workspaceId); }),
      booked: store.bookedCalls.filter(function(r) { return matchesWorkspace(r, workspaceId); }),
      afterCalls: (store.afterCallReports || []).filter(function(r) { return matchesWorkspace(r, workspaceId); }),
      start: start || null,
      end: end || null,
    });

    var setterBoard = computeSetterBoard(
      store.closedDeals.filter(function(r) { return matchesWorkspace(r, workspaceId); }),
      store.bookedCalls.filter(function(r) { return matchesWorkspace(r, workspaceId); })
    );
    var setterTotals = (setterBoard || []).reduce(function(acc, row) {
      acc.booked += row.booked || 0;
      acc.closed += row.closes || 0;
      acc.cash += row.cash || 0;
      return acc;
    }, { booked: 0, closed: 0, cash: 0 });

    // Revenue is what reps report as booked on the day, which is a different
    // figure from cash collected and is not something the report engine rolls
    // up — so it is summed here from the same EODs, over the same range.
    var reportedRevenue = store.eodReports
      .filter(function(r) { return matchesWorkspace(r, workspaceId); })
      .filter(function(e) {
        var day = e.date || '';
        if (start && day && day < start) return false;
        if (end && day && day > end) return false;
        return true;
      })
      .reduce(function(sum, e) {
        var x = parseFloat(e.revenueOnDay);
        return sum + (isFinite(x) ? x : 0);
      }, 0);

    var v = report.volume;
    var r = report.rates;
    var c = report.cash;

    return NextResponse.json({
      success: true,
      metrics: {
        closers: {
          taken: v.taken,
          onCalendar: v.onCalendar,
          sets: v.sets,
          noShowed: v.noShowed,
          canceled: v.canceled,
          rescheduled: v.rescheduled,
          pitched: v.pitched,
          closes: v.closes,
          offeredNoClose: v.offeredNoClose,
          cashCollected: c.collected,
          revenue: Math.round(reportedRevenue),
          cashPerCall: c.perShow,
          cashPerOffer: c.perOffer,
          showRate: r.showRate,
          closeRate: r.closeRateOfOffers,
        },
        setters: {
          dials: v.dials,
          conversations: v.conversations,
          liveCalls: v.liveCalls,
          sets: v.sets,
          followUps: v.followUps,
          booked: setterTotals.booked,
          closed: setterTotals.closed,
          cash: Math.round(setterTotals.cash),
          shows: v.taken,
          noShowed: v.noShowed,
          dialToConversation: r.dialToConversation,
          conversationToSet: r.conversationToSet,
          setToClose: v.sets ? Math.round((setterTotals.closed / v.sets) * 1000) / 10 : null,
        },
        // Asked for, but nothing captures it: no form has a disqualification
        // field, so there is no honest number to print. Reporting 0 would read
        // as "nobody was disqualified" rather than "we do not ask".
        missing: ['disqualifications'],
        daysReported: report.range.daysReported,
        repsReporting: report.range.repsReporting,
      },
      overview: overview,
      closers: closers,
      activity: activity,
      workspaceId: workspaceId,
      workspaces: getWorkspaces(),
      counts: {
        bookedCalls: countIn(store.bookedCalls),
        closedDeals: countIn(store.closedDeals),
        eodReports: countIn(store.eodReports),
      },
      dateRange: { start: start, end: end },
      lastUpdated: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[Dashboard API Error]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
