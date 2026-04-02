import { NextResponse } from 'next/server';
import { getDailyTeamSummary, getStore, initStore } from '@/lib/store';

export async function POST(req) {
  try {
    await initStore();
    var body = await req.json();

    // Yesterday's date
    var yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    var yesterdayStr = yesterday.toISOString().split('T')[0];
    var yesterdayFormatted = yesterday.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    // Month-to-date range
    var today = new Date();
    var monthStart = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-01';
    var monthName = today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    // Get yesterday's summary
    var yesterdaySummary = getDailyTeamSummary(yesterdayStr);
    var yt = yesterdaySummary.totals;

    // Calculate month-to-date from stored data
    var store = getStore();
    var mtdEODs = store.eodReports.filter(function(e) { return e.date >= monthStart; });
    var mtdDeals = store.closedDeals.filter(function(d) { return d.submittedAt && d.submittedAt >= monthStart; });

    // MTD closer breakdown
    var mtdCloserMap = {};
    mtdEODs.forEach(function(eod) {
      var name = eod.salesRep || eod.closerName || 'Unknown';
      if (!mtdCloserMap[name]) {
        mtdCloserMap[name] = { name: name, dials: 0, callsTaken: 0, pitched: 0, closes: 0, cashMYFM: 0, cashI2I: 0, revenue: 0, noShows: 0, booked: 0, daysReported: 0 };
      }
      var c = mtdCloserMap[name];
      c.dials += (eod.outboundDials || 0);
      c.callsTaken += (eod.callsTaken || 0);
      c.pitched += (eod.callsTakenAndPitched || 0);
      c.closes += (eod.closes || 0);
      c.cashMYFM += (eod.cashCollectedMYFM || 0);
      c.cashI2I += (eod.cashCollectedI2I || 0);
      c.revenue += (eod.revenueOnDay || 0);
      c.noShows += (eod.callsNoShowed || 0);
      c.booked += (eod.netNewCallsBooked || 0);
      c.daysReported++;
    });

    mtdDeals.forEach(function(deal) {
      var name = deal.closer || deal.closerName || 'Unknown';
      if (!mtdCloserMap[name]) {
        mtdCloserMap[name] = { name: name, dials: 0, callsTaken: 0, pitched: 0, closes: 0, cashMYFM: 0, cashI2I: 0, revenue: 0, noShows: 0, booked: 0, daysReported: 0 };
      }
    });

    var mtdClosers = Object.values(mtdCloserMap).sort(function(a, b) { return b.revenue - a.revenue; });

    // MTD totals
    var mtdTotals = {
      dials: mtdClosers.reduce(function(s, c) { return s + c.dials; }, 0),
      callsTaken: mtdClosers.reduce(function(s, c) { return s + c.callsTaken; }, 0),
      pitched: mtdClosers.reduce(function(s, c) { return s + c.pitched; }, 0),
      closes: mtdClosers.reduce(function(s, c) { return s + c.closes; }, 0),
      cashMYFM: mtdClosers.reduce(function(s, c) { return s + c.cashMYFM; }, 0),
      cashI2I: mtdClosers.reduce(function(s, c) { return s + c.cashI2I; }, 0),
      revenue: mtdClosers.reduce(function(s, c) { return s + c.revenue; }, 0),
      noShows: mtdClosers.reduce(function(s, c) { return s + c.noShows; }, 0),
      booked: mtdClosers.reduce(function(s, c) { return s + c.booked; }, 0),
      deals: mtdDeals.length,
      dealValue: mtdDeals.reduce(function(s, d) { return s + (d.cashCollected || d.dealValue || 0); }, 0),
      reps: mtdClosers.length,
    };

    // Build the message
    var msg = 'DAILY ADMIN REPORT \uD83D\uDCCA\n'
      + '\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n\n';

    // SECTION 1: Yesterday's combined EOD
    msg += '\uD83D\uDCCB YESTERDAY\'S TEAM EOD\n'
      + yesterdayFormatted + '\n'
      + '\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n';

    if (yesterdaySummary.closers.length === 0) {
      msg += 'No EOD reports submitted yesterday.\n';
    } else {
      msg += 'Reps Reported: ' + yt.totalReps + '\n'
        + 'Outbound Dials: ' + yt.totalDials + '\n'
        + 'Calls Taken: ' + yt.totalCallsTaken + '\n'
        + 'No Shows: ' + yt.totalNoShows + '\n'
        + 'New Calls Booked: ' + yt.totalNewBooked + '\n'
        + 'Closes: ' + yt.totalCloses + '\n'
        + 'Cash (MYFM): $' + yt.totalCashMYFM.toLocaleString() + '\n'
        + 'Cash (I2I): $' + yt.totalCashI2I.toLocaleString() + '\n'
        + 'Total Revenue: $' + yt.totalRevenue.toLocaleString() + '\n';

      msg += '\nIndividual:\n';
      yesterdaySummary.closers.forEach(function(c, i) {
        msg += '\n' + (i + 1) + '. ' + c.name.toUpperCase() + '\n'
          + '   Dials: ' + c.outboundDials + ' | Taken: ' + c.callsTaken + ' | Pitched: ' + c.takenPitched + '\n'
          + '   Closes: ' + c.closes + ' | Booked: ' + c.netNewBooked + ' | No Shows: ' + c.noShows + '\n'
          + '   MYFM: $' + c.cashMYFM.toLocaleString() + ' | I2I: $' + c.cashI2I.toLocaleString() + ' | Rev: $' + c.revenue.toLocaleString() + '\n';
        if (c.improvement) msg += '   Focus: ' + c.improvement + '\n';
      });
    }

    // SECTION 2: Month-to-Date
    msg += '\n\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n'
      + '\uD83D\uDCC8 MONTH TO DATE\n'
      + monthName + '\n'
      + '\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n';

    if (mtdClosers.length === 0) {
      msg += 'No data for this month yet.\n';
    } else {
      msg += 'Active Reps: ' + mtdTotals.reps + '\n'
        + 'Total Outbound Dials: ' + mtdTotals.dials.toLocaleString() + '\n'
        + 'Total Calls Taken: ' + mtdTotals.callsTaken.toLocaleString() + '\n'
        + 'Total Calls Pitched: ' + mtdTotals.pitched.toLocaleString() + '\n'
        + 'Total Closes: ' + mtdTotals.closes + '\n'
        + 'Total No Shows: ' + mtdTotals.noShows + '\n'
        + 'Total New Calls Booked: ' + mtdTotals.booked + '\n'
        + 'Cash (MYFM): $' + mtdTotals.cashMYFM.toLocaleString() + '\n'
        + 'Cash (I2I): $' + mtdTotals.cashI2I.toLocaleString() + '\n'
        + 'Total Revenue: $' + mtdTotals.revenue.toLocaleString() + '\n'
        + 'Closed Deals: ' + mtdTotals.deals + ' ($' + mtdTotals.dealValue.toLocaleString() + ')\n';

      msg += '\nMTD by Closer:\n';
      mtdClosers.forEach(function(c, i) {
        msg += '\n' + (i + 1) + '. ' + c.name.toUpperCase() + ' (' + c.daysReported + ' days reported)\n'
          + '   Dials: ' + c.dials.toLocaleString() + ' | Taken: ' + c.callsTaken + ' | Pitched: ' + c.pitched + '\n'
          + '   Closes: ' + c.closes + ' | Booked: ' + c.booked + '\n'
          + '   MYFM: $' + c.cashMYFM.toLocaleString() + ' | I2I: $' + c.cashI2I.toLocaleString() + '\n'
          + '   Total Revenue: $' + c.revenue.toLocaleString() + '\n';
      });
    }

    msg += '\n\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n'
      + 'Generated by Summit CRM\n'
      + new Date().toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });

    // Send to admin via direct Assistro API call
    if (body.adminPhone && body.assistroApiUrl) {
      try {
        await fetch(body.assistroApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': body.assistroApiKey ? ('Bearer ' + body.assistroApiKey) : '',
          },
          body: JSON.stringify({ phone: body.adminPhone, body: msg, type: 1 }),
        });
      } catch (sendErr) {
        console.error('[Admin Report] Send error:', sendErr.message);
      }
    }

    return NextResponse.json({ success: true, message: msg });
  } catch (e) {
    console.error('[Admin Report Error]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
