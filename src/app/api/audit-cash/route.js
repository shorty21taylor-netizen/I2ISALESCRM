import { NextResponse } from 'next/server';
import { initStore, getStore, getFilteredOverview } from '@/lib/store';
import { todayInReportTimezone, toReportDay } from '@/lib/report-date';

export async function GET(request) {
  await initStore();

  var url = new URL(request.url);
  var start = url.searchParams.get('start') || todayInReportTimezone();
  var end = url.searchParams.get('end') || todayInReportTimezone();

  var overview = getFilteredOverview(start, end);

  var storeData = getStore();
  var allEODs = storeData.eodReports || [];
  var allDeals = storeData.closedDeals || [];

  var rangeEODs = allEODs.filter(function(e) {
    var d = e.date ? toReportDay(e.date) : toReportDay(e.submittedAt);
    return d >= start && d <= end;
  });

  var rangeDeals = allDeals.filter(function(d) {
    var dt = toReportDay(d.submittedAt);
    return dt >= start && dt <= end;
  });

  // EOD cash: MYFM + I2I
  var eodCashMYFM = 0;
  var eodCashI2I = 0;
  var eodRevenueOnDay = 0;
  rangeEODs.forEach(function(e) {
    eodCashMYFM += parseFloat(e.cashCollectedMYFM) || 0;
    eodCashI2I += parseFloat(e.cashCollectedI2I) || 0;
    eodRevenueOnDay += parseFloat(e.revenueOnDay) || 0;
  });
  var eodCashTotal = eodCashMYFM + eodCashI2I;

  // Deal cash
  var dealCashTotal = 0;
  rangeDeals.forEach(function(d) {
    dealCashTotal += parseFloat(d.cashCollected) || parseFloat(d.dealValue) || 0;
  });

  // Canonical total (should match overview)
  var canonicalTotal = Math.max(dealCashTotal, eodCashTotal, eodRevenueOnDay);

  return NextResponse.json({
    success: true,
    dateRange: { start: start, end: end },
    sources: {
      eodCashMYFM: Math.round(eodCashMYFM * 100) / 100,
      eodCashI2I: Math.round(eodCashI2I * 100) / 100,
      eodCashTotal: Math.round(eodCashTotal * 100) / 100,
      eodRevenueOnDay: Math.round(eodRevenueOnDay * 100) / 100,
      dealCashTotal: Math.round(dealCashTotal * 100) / 100,
    },
    canonical: {
      totalRevenue: Math.round(canonicalTotal * 100) / 100,
      method: 'Math.max(dealCashTotal, eodCashTotal, eodRevenueOnDay)',
    },
    overviewMatch: {
      overviewTotalRevenue: overview.totalRevenue,
      matches: Math.abs(overview.totalRevenue - Math.round(canonicalTotal * 100) / 100) < 0.01,
    },
    counts: {
      eodReports: rangeEODs.length,
      closedDeals: rangeDeals.length,
    },
    perEOD: rangeEODs.map(function(e) {
      return {
        id: e.id,
        date: e.date,
        salesRep: e.salesRep,
        cashMYFM: parseFloat(e.cashCollectedMYFM) || 0,
        cashI2I: parseFloat(e.cashCollectedI2I) || 0,
        revenueOnDay: parseFloat(e.revenueOnDay) || 0,
      };
    }),
    perDeal: rangeDeals.map(function(d) {
      return {
        id: d.id,
        program: d.program,
        closer: d.closer,
        cashCollected: parseFloat(d.cashCollected) || 0,
        dealValue: parseFloat(d.dealValue) || 0,
      };
    }),
  });
}
