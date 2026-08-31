import { NextResponse } from 'next/server';
import { initStore, getMessageLog } from '@/lib/store';
import { effectiveReadWorkspace } from '@/lib/access';
import { toReportDay, todayInReportTimezone } from '@/lib/report-date';

var KINDS = ['book-call', 'close-deal', 'eod-report', 'after-call', 'scheduled'];

// Days the team can see at a glance, bucketed in their own timezone rather than the
// server's — the same rule the leaderboard and EOD tracker settle on.
function dailySeries(rows, days) {
  var today = todayInReportTimezone();
  var order = [];
  var byDay = {};
  var cursor = new Date(today + 'T12:00:00Z');
  for (var i = days - 1; i >= 0; i--) {
    var d = new Date(cursor);
    d.setUTCDate(d.getUTCDate() - i);
    var key = d.toISOString().split('T')[0];
    order.push(key);
    byDay[key] = { date: key, count: 0, sent: 0, failed: 0 };
  }
  rows.forEach(function(r) {
    var day = toReportDay(r.sentAt);
    if (!byDay[day]) return;
    byDay[day].count++;
    if (r.status === 'failed') byDay[day].failed++;
    else byDay[day].sent++;
  });
  return order.map(function(k) { return byDay[k]; });
}

// Consecutive days, counting back from today, on which something went out. The one
// number on this page that rewards keeping the team's activity unbroken.
function currentStreak(rows) {
  var seen = {};
  rows.forEach(function(r) { seen[toReportDay(r.sentAt)] = true; });
  var day = new Date(todayInReportTimezone() + 'T12:00:00Z');
  // Today not being logged yet shouldn't break a streak that is still alive.
  if (!seen[day.toISOString().split('T')[0]]) day.setUTCDate(day.getUTCDate() - 1);
  var streak = 0;
  while (seen[day.toISOString().split('T')[0]]) {
    streak++;
    day.setUTCDate(day.getUTCDate() - 1);
  }
  return streak;
}

// Read-only view of every WhatsApp notification the CRM has attempted.
export async function GET(req) {
  await initStore();
  try {
    var url = new URL(req.url);
    var workspaceId = await effectiveReadWorkspace(req, url.searchParams.get('workspace'));
    var kind = url.searchParams.get('kind') || '';
    var status = url.searchParams.get('status') || '';
    var limit = parseInt(url.searchParams.get('limit'), 10) || 100;

    var all = getMessageLog(workspaceId);

    // Headline figures and the filter pills are computed before filtering, so the
    // page's numbers hold still while you narrow the feed underneath them.
    var counts = { sent: 0, failed: 0, skipped: 0, external: 0 };
    var byKind = {};
    KINDS.forEach(function(k) { byKind[k] = 0; });
    all.forEach(function(r) {
      if (counts[r.status] !== undefined) counts[r.status]++;
      if (byKind[r.kind] !== undefined) byKind[r.kind]++;
    });

    var today = todayInReportTimezone();
    var daily = dailySeries(all, 14);
    var todayCount = 0;
    var yesterdayCount = 0;
    if (daily.length) {
      todayCount = daily[daily.length - 1].count;
      yesterdayCount = daily.length > 1 ? daily[daily.length - 2].count : 0;
    }

    var best = daily.reduce(function(a, b) { return b.count > a.count ? b : a; }, { date: '', count: 0 });
    var delivered = counts.sent + counts.external;
    var attempted = delivered + counts.failed;

    var rows = all;
    if (kind) rows = rows.filter(function(r) { return r.kind === kind; });
    if (status) rows = rows.filter(function(r) { return r.status === status; });

    return NextResponse.json({
      success: true,
      counts: counts,
      total: rows.length,
      stats: {
        logged: all.length,
        today: todayCount,
        yesterday: yesterdayCount,
        todayDate: today,
        // Only counts attempts the CRM actually made; a notification n8n sent is
        // delivered, and one that was never configured to send is neither.
        deliveryRate: attempted > 0 ? Math.round((delivered / attempted) * 100) : 100,
        attempted: attempted,
        streak: currentStreak(all),
        bestDay: best,
        byKind: byKind,
        daily: daily,
      },
      data: rows.slice(0, limit),
    });
  } catch (e) {
    console.error('[Message Log Error]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
