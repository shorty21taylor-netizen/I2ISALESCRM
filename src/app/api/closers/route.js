import { NextResponse } from 'next/server';
import { getAllCloserProfiles, getStore, initStore, archiveCloser, restoreCloser } from '@/lib/store';
import { callerEmail, OWNER_EMAIL } from '@/lib/access';
import { todayInReportTimezone, toReportDay } from '@/lib/report-date';

// Remove a rep from the roster, or put them back. Records are never touched.
export async function POST(req) {
  await initStore();
  try {
    if (callerEmail(req) !== OWNER_EMAIL) {
      return NextResponse.json({ error: 'Operator access required' }, { status: 403 });
    }
    var body = await req.json();
    var action = body.action;
    if (!body.email) return NextResponse.json({ error: 'email required' }, { status: 400 });

    var result;
    if (action === 'archive') result = archiveCloser(body.email);
    else if (action === 'restore') result = restoreCloser(body.email);
    else return NextResponse.json({ error: "action must be 'archive' or 'restore'" }, { status: 400 });

    if (result.error) return NextResponse.json({ error: result.error }, { status: 404 });
    return NextResponse.json({ success: true, action: action, closer: result.profile });
  } catch (e) {
    console.error('[Closers POST Error]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET(req) {
  await initStore();
  try {
    await initStore();
    var profiles = getAllCloserProfiles();
    var store = getStore();
    var today = todayInReportTimezone();

    var closers = Object.values(profiles).map(function(profile) {
      var name = profile.name;

      var bookedCalls = store.bookedCalls.filter(function(b) { return b.closer === name; }).length;
      var closedDeals = store.closedDeals.filter(function(d) { return (d.closer || d.closerName) === name; });
      var eodReports = store.eodReports.filter(function(e) { return (e.salesRep || e.closerName) === name; });

      var totalRevenue = closedDeals.reduce(function(s, d) { return s + (d.cashCollected || d.dealValue || 0); }, 0);
      var totalDials = eodReports.reduce(function(s, e) { return s + (e.outboundDials || e.totalDials || 0); }, 0);
      var totalCloses = closedDeals.length;
      var totalCallsTaken = eodReports.reduce(function(s, e) { return s + (e.callsTaken || 0); }, 0);
      var closeRate = totalCallsTaken > 0 ? Math.round((totalCloses / totalCallsTaken) * 1000) / 10 : 0;

      // Today's stats
      var todayEODs = eodReports.filter(function(e) { return e.date === today; });
      var todayDials = todayEODs.reduce(function(s, e) { return s + (e.outboundDials || e.totalDials || 0); }, 0);
      var todayCloses = todayEODs.reduce(function(s, e) { return s + (e.closes || 0); }, 0);
      var todayCash = todayEODs.reduce(function(s, e) { return s + (e.cashCollectedMYFM || 0) + (e.cashCollectedI2I || 0); }, 0);

      // Last activity
      var allDates = []
        .concat(store.bookedCalls.filter(function(b) { return b.closer === name; }).map(function(b) { return b.submittedAt; }))
        .concat(closedDeals.map(function(d) { return d.submittedAt; }))
        .concat(eodReports.map(function(e) { return e.submittedAt; }))
        .filter(Boolean)
        .sort()
        .reverse();

      return {
        name: profile.name,
        email: profile.email,
        archived: !!profile.archived,
        archivedAt: profile.archivedAt || null,
        registeredAt: profile.registeredAt,
        lastLogin: profile.lastLogin,
        lastActivity: allDates[0] || null,
        stats: {
          bookedCalls: bookedCalls,
          closedDeals: totalCloses,
          eodReports: eodReports.length,
          totalRevenue: totalRevenue,
          totalDials: totalDials,
          closeRate: closeRate,
        },
        today: {
          dials: todayDials,
          closes: todayCloses,
          cash: todayCash,
        },
      };
    });

    // A removed rep drops off the roster but keeps every record they filed, so the
    // Closers page and the EOD compliance tracker stop expecting work from someone
    // who has left. ?includeArchived=1 brings them back for the "show removed" view.
    var includeArchived = false;
    try {
      includeArchived = new URL(req.url).searchParams.get('includeArchived') === '1';
    } catch (e) { includeArchived = false; }
    if (!includeArchived) {
      closers = closers.filter(function(c) { return !c.archived; });
    }

    // Deduplicate by normalized email (lowercase + trim).
    // Same email = same person; different/missing emails stay separate.
    var seenEmail = {};
    closers = closers.filter(function(c) {
      var e = (c.email || '').toLowerCase().trim();
      if (!e) return true;
      if (seenEmail[e]) return false;
      seenEmail[e] = true;
      return true;
    });

    closers.sort(function(a, b) { return b.stats.totalRevenue - a.stats.totalRevenue; });

    return NextResponse.json({ success: true, closers: closers, count: closers.length });
  } catch (e) {
    console.error('[Closers API Error]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
