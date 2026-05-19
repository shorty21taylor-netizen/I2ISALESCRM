import { NextResponse } from 'next/server';
import { getAllCloserProfiles, getStore, initStore } from '@/lib/store';

export async function GET() {
  await initStore();
  try {
    await initStore();
    var profiles = getAllCloserProfiles();
    var store = getStore();
    var today = new Date().toISOString().split('T')[0];

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

    // Deduplicate by email (safety net)
    var seenEmail = {};
    closers = closers.filter(function(c) {
      var e = (c.email || '').toLowerCase();
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
