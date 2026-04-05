import { NextResponse } from 'next/server';
import { initStore, getStore } from '@/lib/store';
import { initScheduler } from '@/lib/scheduler';
import { query } from '@/lib/db';

export async function GET(req) {
  await initStore();

  var protocol = req.headers.get('x-forwarded-proto') || 'http';
  var host = req.headers.get('host') || 'localhost:3000';
  initScheduler(protocol + '://' + host);

  var dbStatus = 'NOT CONNECTED';
  var dbError = null;
  var dbCounts = null;
  var hasDbUrl = !!process.env.DATABASE_URL;

  if (hasDbUrl) {
    try {
      var result = await query('SELECT 1 as ok');
      if (result) {
        dbStatus = 'CONNECTED';
        var bc = await query('SELECT COUNT(*) as c FROM booked_calls');
        var cd = await query('SELECT COUNT(*) as c FROM closed_deals');
        var eod = await query('SELECT COUNT(*) as c FROM eod_reports');
        dbCounts = {
          bookedCalls: bc ? parseInt(bc.rows[0].c) : 0,
          closedDeals: cd ? parseInt(cd.rows[0].c) : 0,
          eodReports: eod ? parseInt(eod.rows[0].c) : 0,
        };
      }
    } catch (e) {
      dbStatus = 'ERROR';
      dbError = e.message;
    }
  }

  var s = getStore();

  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: {
      status: dbStatus,
      hasUrl: hasDbUrl,
      error: dbError,
      dbRecords: dbCounts,
      memoryRecords: {
        bookedCalls: s.bookedCalls.length,
        closedDeals: s.closedDeals.length,
        eodReports: s.eodReports.length,
        closerProfiles: Object.keys(s.closerProfiles).length,
      },
    },
    warning: !hasDbUrl ? 'DATABASE_URL is NOT SET — data will be lost on every restart/redeploy!' : null,
  });
}
