import { NextResponse } from 'next/server';
import { getOverview, getFilteredOverview, getCloserBreakdown, getRecentActivity, getStore, initStore, getWorkspaces, getSetterExclusions, classifyOffer, ALL_WORKSPACES } from '@/lib/store';
import { initScheduler } from '@/lib/scheduler';
import { effectiveReadWorkspace, matchesWorkspace, ALL_WORKSPACES as ACCESS_ALL } from '@/lib/access';
import { repScope } from '@/lib/rep-scope';
import { computeSalesReport } from '@/lib/sales-report';
import { computeSetterBoard, dedupeDeals } from '@/lib/dedupe-deals';
import { setterBreakdown } from '@/lib/setter-breakdown';
import { toReportDay } from '@/lib/report-date';

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
    // Partner business is left out of the closer metrics for the same reason it
    // is left out of the tiles above them: it is somebody else's offer sold
    // through this floor, it has its own box, and a Cash Collected tile reading
    // $50,000 above a Cash collected metric reading $125,000 is the confusion
    // this split exists to end.
    var ourDeals = store.closedDeals.filter(function(r) {
      return matchesWorkspace(r, workspaceId) && classifyOffer(r.program) !== 'partner';
    });

    var report = computeSalesReport({
      eods: store.eodReports.filter(function(r) { return matchesWorkspace(r, workspaceId); }),
      deals: ourDeals,
      booked: store.bookedCalls.filter(function(r) { return matchesWorkspace(r, workspaceId); }),
      afterCalls: (store.afterCallReports || []).filter(function(r) { return matchesWorkspace(r, workspaceId); }),
      start: start || null,
      end: end || null,
    });

    // The setter board, over the SAME range as everything else on the page.
    //
    // This used to be handed the entire store: every deal and every booking since
    // the install, with no date filter at all. "Sets closed 9 / Cash from sets
    // $32,047" then sat underneath a header that said Today, next to a Total sets
    // of 0 — the two halves of one row describing different periods. It also
    // skipped the dedupe and the setter exclusions the leaderboard applies, so a
    // deal filed twice counted twice here and nowhere else.
    function inDashboardRange(record) {
      if (!matchesWorkspace(record, workspaceId)) return false;
      var day = toReportDay(record.submittedAt);
      if (!day) return false;
      if (start && day < start) return false;
      if (end && day > end) return false;
      return true;
    }

    var rangedDeals = dedupeDeals(store.closedDeals.filter(inDashboardRange)).deals;
    var rangedCalls = store.bookedCalls.filter(inDashboardRange);
    var setterBoard = computeSetterBoard(rangedDeals, rangedCalls, getSetterExclusions());
    var setterTotals = (setterBoard || []).reduce(function(acc, row) {
      acc.booked += row.booked || 0;
      acc.closed += row.closes || 0;
      acc.cash += row.cash || 0;
      return acc;
    }, { booked: 0, closed: 0, cash: 0 });

    // Revenue, summed from the per-closer rows rather than straight off the EODs.
    //
    // A raw sum of revenueOnDay is what put "$209,056 cash collected" next to
    // "$42,595 revenue" on this page — revenue below the cash paid against it,
    // which is impossible. "Revenue on Day" is an optional box on the EOD form
    // and most reps skip it, so summing it raw measures how many people filled
    // in a box, not what the floor sold.
    //
    // getCloserBreakdown settles each rep-day at the larger of the revenue they
    // reported and the cash they actually collected, so taking the total from
    // there both fixes the floor and makes this tile equal the sum of the Revenue
    // column underneath it.
    var rowRevenue = (closers || []).reduce(function(sum, row) {
      var x = parseFloat(row && row.revenue);
      return sum + (isFinite(x) ? x : 0);
    }, 0);

    var v = report.volume;
    var r = report.rates;
    var c = report.cash;

    // One last floor, against the cash figure actually printed beside it.
    //
    // The per-closer rows skip a deal filed with no closer name, and the cash
    // tile does not, so an unattributed deal could still leave revenue reading
    // below cash. Whatever else is true, the tile must never claim the floor
    // sold less than it was paid.
    var reportedRevenue = Math.max(rowRevenue, c.collected || 0);
    // Booked-call forms filed in the range. Already range-filtered by the report
    // engine, so it describes the same period as every other figure here.
    var bookedFormsFiled = (report.reporting && report.reporting.bookedForms
      && report.reporting.bookedForms.filed) || 0;

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
          // What "total sets" means, in order of how much we trust it.
          //
          // `sets` was the EOD self-report alone, which is filed at the END of the
          // day — so a setter who booked four calls this morning showed as 0 until
          // they wrote their EOD that evening. The booked-call forms are already in
          // hand by then. Both numbers are sent so the tile can say which it used;
          // the headline takes whichever is higher rather than adding them, because
          // a rep who both files an EOD and submits the forms would otherwise have
          // every set counted twice — the same rule bookedOn() and cashOn() use.
          sets: Math.max(v.sets, bookedFormsFiled),
          setsReported: v.sets,
          setsFromForms: bookedFormsFiled,
          followUps: v.followUps,
          booked: setterTotals.booked,
          closed: setterTotals.closed,
          cash: Math.round(setterTotals.cash),
          shows: v.taken,
          noShowed: v.noShowed,
          dialToConversation: r.dialToConversation,
          conversationToSet: r.conversationToSet,
          // Divided by the combined set count above, not the EOD-only one — the
          // numerator is the ranged board, so the denominator has to be the same
          // period or the rate is two different weeks divided by each other.
          setToClose: Math.max(v.sets, bookedFormsFiled)
            ? Math.round((setterTotals.closed / Math.max(v.sets, bookedFormsFiled)) * 1000) / 10
            : null,
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
      // The same ranged, deduped board the setter tiles are totalled from, so a
      // per-setter page and the team dashboard can never disagree about a row —
      // joined to the EOD side, which is the only place dials and conversations
      // are recorded.
      setters: setterBreakdown(
        store.eodReports.filter(function(r) {
          if (!matchesWorkspace(r, workspaceId)) return false;
          var day = r.date || '';
          if (start && day && day < start) return false;
          if (end && day && day > end) return false;
          return true;
        }),
        setterBoard
      ),
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
