// In-memory data store with PostgreSQL persistence.
// On startup, data loads from DB. Every write saves to both memory AND DB.
// Graceful fallback: works without DATABASE_URL in memory-only mode.

import { initDatabase, loadFromDatabase, saveBookedCall, saveClosedDeal, saveEODReport, saveCloserProfile, saveCommissionRate, updateDealInDB } from '@/lib/db';

var store = {
  bookedCalls: [],
  closedDeals: [],
  eodReports: [],
  commissionRates: {},
  closerProfiles: {},
};

// ============================================
// DATABASE INIT — call from every API route
// ============================================

var dbLoaded = false;

export async function initStore() {
  if (dbLoaded) return;
  dbLoaded = true;

  try {
    var dbReady = await initDatabase();
    if (!dbReady) {
      console.error('============================================================');
      console.error('WARNING: DATABASE_URL NOT SET — RUNNING IN MEMORY-ONLY MODE');
      console.error('ALL DATA WILL BE LOST ON RESTART/REDEPLOY!');
      console.error('Fix: Railway Dashboard → CRM Service → Variables → Add Reference → PostgreSQL DATABASE_URL');
      console.error('============================================================');
      return;
    }

    var data = await loadFromDatabase();
    if (data) {
      store.bookedCalls = data.bookedCalls || [];
      store.closedDeals = data.closedDeals || [];
      store.eodReports = data.eodReports || [];
      store.closerProfiles = data.closerProfiles || {};
      store.commissionRates = data.commissionRates || {};
      console.log('[Store] Loaded from DB:',
        store.bookedCalls.length, 'booked,',
        store.closedDeals.length, 'deals,',
        store.eodReports.length, 'EODs,',
        Object.keys(store.closerProfiles).length, 'closers'
      );
      recalcOverview();
    }
  } catch (e) {
    console.error('[Store] Init error:', e.message);
  }
}

export function getStore() {
  return store;
}

// ============================================
// BOOK A CALL — new fields
// ============================================

export function addBookedCall(data) {
  var entry = {
    id: 'book-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
    leadsName: data.leadsName || '',
    leadsPhone: data.leadsPhone || '',
    program: data.program || '',
    qualified: data.qualified || 'yes',
    bookedDay: data.bookedDay || '',
    bookedTime: data.bookedTime || '',
    notes: data.notes || '',
    setter: data.setter || '',
    closer: data.closer || '',
    outboundInbound: data.outboundInbound || 'inbound',
    submittedAt: new Date().toISOString(),
  };
  store.bookedCalls.unshift(entry);
  if (store.bookedCalls.length > 500) store.bookedCalls = store.bookedCalls.slice(0, 500);
  saveBookedCall(entry).catch(function(e) { console.error('[DB] Save booked call error:', e.message); });
  recalcOverview();
  saveBookedCall(entry).catch(function(e) { console.error('[DB] Save booked call error:', e.message); });
  return entry;
}

// ============================================
// CLOSE A DEAL — new fields
// ============================================

export function addClosedDeal(data) {
  var entry = {
    id: 'close-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
    leadsName: data.leadsName || '',
    leadsPhone: data.leadsPhone || '',
    leadsEmail: data.leadsEmail || '',
    program: data.program || '',
    paymentDetails: data.paymentDetails || '',
    paymentProcessor: data.paymentProcessor || '',
    paymentAgreement: data.paymentAgreement || '',
    cashCollected: parseFloat(data.cashCollected) || 0,
    setter: data.setter || '',
    closer: data.closer || '',
    closerEmail: data.closerEmail || '',
    commissionStatus: 'pending',
    submittedAt: new Date().toISOString(),
  };
  store.closedDeals.unshift(entry);
  if (store.closedDeals.length > 500) store.closedDeals = store.closedDeals.slice(0, 500);
  saveClosedDeal(entry).catch(function(e) { console.error('[DB] Save closed deal error:', e.message); });
  recalcOverview();
  saveClosedDeal(entry).catch(function(e) { console.error('[DB] Save deal error:', e.message); });
  return entry;
}

// ============================================
// EOD REPORT — new fields
// ============================================

export function addEODReport(data) {
  var entry = {
    id: 'eod-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
    salesRep: data.salesRep || '',
    date: data.date || new Date().toISOString().split('T')[0],
    netNewCallsBooked: parseInt(data.netNewCallsBooked) || 0,
    callsOnCalendar: parseInt(data.callsOnCalendar) || 0,
    callsTaken: parseInt(data.callsTaken) || 0,
    callsNoShowed: parseInt(data.callsNoShowed) || 0,
    callsCanceled: parseInt(data.callsCanceled) || 0,
    callsRescheduled: parseInt(data.callsRescheduled) || 0,
    callsTakenAndPitched: parseInt(data.callsTakenAndPitched) || 0,
    closes: parseInt(data.closes) || 0,
    outboundDials: parseInt(data.outboundDials) || 0,
    cashCollectedMYFM: parseFloat(data.cashCollectedMYFM) || 0,
    cashCollectedI2I: parseFloat(data.cashCollectedI2I) || 0,
    revenueOnDay: parseFloat(data.revenueOnDay) || 0,
    improvementPlan: data.improvementPlan || '',
    submittedAt: new Date().toISOString(),
    status: 'submitted',
  };
  store.eodReports.unshift(entry);
  if (store.eodReports.length > 500) store.eodReports = store.eodReports.slice(0, 500);
  saveEODReport(entry).catch(function(e) { console.error('[DB] Save EOD error:', e.message); });
  recalcOverview();
  saveEODReport(entry).catch(function(e) { console.error('[DB] Save EOD error:', e.message); });
  return entry;
}

// ============================================
// COMPUTED OVERVIEW
// ============================================

var overview = null;

function recalcOverview() {
  var today = new Date().toISOString().split('T')[0];
  overview = computeOverviewForRange(today, today);
}

function computeOverviewForRange(startDate, endDate) {
  var today = new Date().toISOString().split('T')[0];
  var start = startDate || today;
  var end = endDate || today;

  var rangeEODs = store.eodReports.filter(function(e) {
    var d = e.date || (e.submittedAt ? e.submittedAt.split('T')[0] : '');
    return d >= start && d <= end;
  });

  var rangeDeals = store.closedDeals.filter(function(d) {
    var dt = d.submittedAt ? d.submittedAt.split('T')[0] : '';
    return dt >= start && dt <= end;
  });

  var rangeBooked = store.bookedCalls.filter(function(b) {
    var dt = b.submittedAt ? b.submittedAt.split('T')[0] : '';
    return dt >= start && dt <= end;
  });

  // DIALS
  var totalDials = rangeEODs.reduce(function(s, e) {
    return s + (parseInt(e.outboundDials) || parseInt(e.totalDials) || 0);
  }, 0);

  // CALLS TAKEN
  var totalCallsTaken = rangeEODs.reduce(function(s, e) {
    return s + (parseInt(e.callsTaken) || parseInt(e.connects) || 0);
  }, 0);

  // CALLS PITCHED
  var totalCallsPitched = rangeEODs.reduce(function(s, e) {
    return s + (parseInt(e.callsTakenAndPitched) || 0);
  }, 0);

  // NEW CALLS BOOKED (from EOD)
  var totalNewBooked = rangeEODs.reduce(function(s, e) {
    return s + (parseInt(e.netNewCallsBooked) || parseInt(e.callsBooked) || 0);
  }, 0);

  // CALLS ON CALENDAR
  var totalCallsOnCalendar = rangeEODs.reduce(function(s, e) {
    return s + (parseInt(e.callsOnCalendar) || 0);
  }, 0);

  // NO SHOWS
  var totalNoShows = rangeEODs.reduce(function(s, e) {
    return s + (parseInt(e.callsNoShowed) || 0);
  }, 0);

  // CANCELED
  var totalCanceled = rangeEODs.reduce(function(s, e) {
    return s + (parseInt(e.callsCanceled) || 0);
  }, 0);

  // RESCHEDULED
  var totalRescheduled = rangeEODs.reduce(function(s, e) {
    return s + (parseInt(e.callsRescheduled) || 0);
  }, 0);

  // CLOSES from EOD
  var eodCloses = rangeEODs.reduce(function(s, e) {
    return s + (parseInt(e.closes) || 0);
  }, 0);

  // CLOSES from deals
  var dealCloses = rangeDeals.length;

  // Use the HIGHER of EOD-reported closes vs actual deals logged
  var totalCloses = Math.max(eodCloses, dealCloses);

  // CASH from EOD reports (MYFM + I2I)
  var cashMYFM = rangeEODs.reduce(function(s, e) {
    return s + (parseFloat(e.cashCollectedMYFM) || 0);
  }, 0);

  var cashI2I = rangeEODs.reduce(function(s, e) {
    return s + (parseFloat(e.cashCollectedI2I) || 0);
  }, 0);

  var eodCashTotal = cashMYFM + cashI2I;

  // CASH from closed deal entries
  var dealCashTotal = rangeDeals.reduce(function(s, d) {
    return s + (parseFloat(d.cashCollected) || parseFloat(d.dealValue) || 0);
  }, 0);

  // REVENUE from EOD revenueOnDay field
  var eodRevenue = rangeEODs.reduce(function(s, e) {
    return s + (parseFloat(e.revenueOnDay) || 0);
  }, 0);

  // Use the HIGHER of EOD-reported revenue vs deal-reported revenue
  var totalRevenue = Math.max(eodRevenue, dealCashTotal);
  var totalCash = Math.max(eodCashTotal, dealCashTotal);

  // RATES
  var closeRate = totalCallsTaken > 0 ? Math.round((totalCloses / totalCallsTaken) * 1000) / 10 : 0;
  var avgDealValue = totalCloses > 0 ? Math.round(totalRevenue / totalCloses) : 0;
  var cashPerCall = totalCallsTaken > 0 ? Math.round(totalRevenue / totalCallsTaken) : 0;
  var offerRate = totalCallsTaken > 0 ? Math.round((totalCallsPitched / totalCallsTaken) * 1000) / 10 : 0;
  var showRate = totalCallsOnCalendar > 0 ? Math.round((totalCallsTaken / totalCallsOnCalendar) * 1000) / 10 : 0;

  // ACTIVE CLOSERS
  var closerNames = {};
  rangeEODs.forEach(function(e) {
    var name = e.salesRep || e.closerName;
    if (name) closerNames[name] = true;
  });
  rangeDeals.forEach(function(d) {
    var name = d.closer || d.closerName;
    if (name) closerNames[name] = true;
  });
  var activeClosers = Object.keys(closerNames).length;

  // EOD COMPLIANCE
  var totalRegistered = Object.keys(store.closerProfiles || {}).length;
  var eodSubmitters = {};
  rangeEODs.forEach(function(e) {
    var name = e.salesRep || e.closerName;
    if (name) eodSubmitters[name] = true;
  });
  var eodComplianceRate = totalRegistered > 0 ? Math.round((Object.keys(eodSubmitters).length / totalRegistered) * 1000) / 10 : 0;

  // DIALS PER HOUR (estimate: 8 hour work day)
  var workDays = {};
  rangeEODs.forEach(function(e) { if (e.date) workDays[e.date] = true; });
  var totalWorkHours = Object.keys(workDays).length * 8;
  var avgDialsPerHour = totalWorkHours > 0 ? Math.round((totalDials / totalWorkHours) * 10) / 10 : 0;

  // INBOUND / OUTBOUND split
  var inboundRevenue = rangeDeals.filter(function(d) {
    var src = (d.leadSource || d.outboundInbound || '').toLowerCase();
    return src === 'inbound';
  }).reduce(function(s, d) { return s + (parseFloat(d.cashCollected) || parseFloat(d.dealValue) || 0); }, 0);
  var outboundRevenue = totalRevenue - inboundRevenue;

  return {
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalCloses: totalCloses,
    teamCloseRate: closeRate,
    totalDials: totalDials,
    avgDealValue: avgDealValue,
    cashPerCallTaken: cashPerCall,
    offerRate: offerRate,
    oneCallCloseRate: 0,
    inboundRevenue: Math.round(inboundRevenue * 100) / 100,
    outboundRevenue: Math.round(outboundRevenue * 100) / 100,
    activeClosers: activeClosers,
    eodComplianceRate: eodComplianceRate,
    bookedCallsThisWeek: rangeBooked.length + totalNewBooked,
    showRate: showRate,
    pipelineValue: 0,
    avgDaysToClose: 0,
    refundRate: 0,
    netRevenueRetained30d: Math.round(totalRevenue * 100) / 100,
    avgDialsPerHour: avgDialsPerHour,
    teamDialTarget: 150,
    totalCallsTaken: totalCallsTaken,
    totalCallsPitched: totalCallsPitched,
    totalNewBooked: totalNewBooked,
    totalNoShows: totalNoShows,
    totalCanceled: totalCanceled,
    totalRescheduled: totalRescheduled,
    cashMYFM: Math.round(cashMYFM * 100) / 100,
    cashI2I: Math.round(cashI2I * 100) / 100,
    totalCash: Math.round(totalCash * 100) / 100,
    todayCash: Math.round(totalCash * 100) / 100,
    todayCloses: totalCloses,
    todayDials: totalDials,
    todayBooked: rangeBooked.length,
    eodReportsCount: rangeEODs.length,
    dateRange: { start: start, end: end },
    revenueTrend: 0, closesTrend: 0, closeRateTrend: 0, dialsTrend: 0,
    dealValueTrend: 0, cashPerCallTrend: 0, oneCallCloseTrend: 0, offerRateTrend: 0,
    bookedCallsTrend: 0, showRateTrend: 0, pipelineValueTrend: 0, daysToCloseTrend: 0,
    refundRateTrend: 0, netRetainedTrend: 0, dialsPerHourTrend: 0,
  };
}

recalcOverview();

export function getOverview() {
  if (!overview) recalcOverview();
  return overview;
}

export function getFilteredOverview(startDate, endDate) {
  return computeOverviewForRange(startDate, endDate);
}

export function getCloserBreakdown(startDate, endDate) {
  var today = new Date().toISOString().split('T')[0];
  var start = startDate || today;
  var end = endDate || today;
  var closerMap = {};

  store.eodReports.filter(function(e) {
    var d = e.date || (e.submittedAt ? e.submittedAt.split('T')[0] : '');
    return d >= start && d <= end;
  }).forEach(function(eod) {
    var name = eod.salesRep || eod.closerName;
    if (!name) return;
    if (!closerMap[name]) {
      closerMap[name] = { name: name, dials: 0, connects: 0, callsBooked: 0, callsTaken: 0, pitched: 0, closes: 0, cash: 0, cashMYFM: 0, cashI2I: 0, revenue: 0, noShows: 0, confidence: 0, eodCount: 0 };
    }
    var c = closerMap[name];
    c.dials += (parseInt(eod.outboundDials) || parseInt(eod.totalDials) || 0);
    c.callsTaken += (parseInt(eod.callsTaken) || parseInt(eod.connects) || 0);
    c.pitched += (parseInt(eod.callsTakenAndPitched) || 0);
    c.callsBooked += (parseInt(eod.netNewCallsBooked) || parseInt(eod.callsBooked) || 0);
    c.closes += (parseInt(eod.closes) || 0);
    c.cashMYFM += (parseFloat(eod.cashCollectedMYFM) || 0);
    c.cashI2I += (parseFloat(eod.cashCollectedI2I) || 0);
    c.cash += (parseFloat(eod.cashCollectedMYFM) || 0) + (parseFloat(eod.cashCollectedI2I) || 0);
    c.revenue += (parseFloat(eod.revenueOnDay) || 0);
    c.noShows += (parseInt(eod.callsNoShowed) || 0);
    c.eodCount++;
    if (eod.confidenceScore) c.confidence = parseInt(eod.confidenceScore) || 0;
  });

  store.closedDeals.filter(function(d) {
    var dt = d.submittedAt ? d.submittedAt.split('T')[0] : '';
    return dt >= start && dt <= end;
  }).forEach(function(deal) {
    var name = deal.closer || deal.closerName;
    if (!name) return;
    if (!closerMap[name]) {
      closerMap[name] = { name: name, dials: 0, connects: 0, callsBooked: 0, callsTaken: 0, pitched: 0, closes: 0, cash: 0, cashMYFM: 0, cashI2I: 0, revenue: 0, noShows: 0, confidence: 0, eodCount: 0 };
    }
    closerMap[name].cash += (parseFloat(deal.cashCollected) || parseFloat(deal.dealValue) || 0);
  });

  return Object.values(closerMap).sort(function(a, b) { return b.cash - a.cash; });
}

export function getRecentActivity(limit) {
  var all = [];

  store.bookedCalls.forEach(function(b) {
    all.push({
      id: b.id,
      type: 'book-call',
      closerName: b.closer || b.setter || '',
      detail: (b.leadsName || b.leadName || '') + ' — ' + (b.program || 'N/A') + ' — ' + (b.bookedDay || 'TBD'),
      submittedAt: b.submittedAt,
    });
  });

  store.closedDeals.forEach(function(d) {
    all.push({
      id: d.id,
      type: 'close-deal',
      closerName: d.closer || d.closerName || '',
      detail: (d.leadsName || d.leadName || '') + ' — $' + Number(d.cashCollected || d.dealValue || 0).toLocaleString() + ' — ' + (d.program || 'N/A'),
      submittedAt: d.submittedAt,
    });
  });

  store.eodReports.forEach(function(e) {
    var dials = e.outboundDials || e.totalDials || 0;
    var closes = e.closes || 0;
    var cash = (parseFloat(e.cashCollectedMYFM) || 0) + (parseFloat(e.cashCollectedI2I) || 0) || (parseFloat(e.cashCollected) || 0);
    all.push({
      id: e.id,
      type: 'eod-report',
      closerName: e.salesRep || e.closerName || '',
      detail: dials + ' dials, ' + closes + ' closes, $' + cash.toLocaleString(),
      submittedAt: e.submittedAt,
    });
  });

  all.sort(function(a, b) { return new Date(b.submittedAt) - new Date(a.submittedAt); });
  return all.slice(0, limit || 50);
}

// ============================================
// DAILY SUMMARY + MORNING DIGEST helpers
// ============================================

export function getDailyTeamSummary(dateStr) {
  var date = dateStr || new Date().toISOString().split('T')[0];

  var dayEODs = store.eodReports.filter(function(e) { return e.date === date; });
  var dayDeals = store.closedDeals.filter(function(d) { return d.submittedAt && d.submittedAt.startsWith(date); });

  var totalRevenue = dayEODs.reduce(function(s, e) { return s + (e.revenueOnDay || 0); }, 0);
  var dealCash = dayDeals.reduce(function(s, d) { return s + (d.cashCollected || 0); }, 0);
  var totalCloses = dayEODs.reduce(function(s, e) { return s + (e.closes || 0); }, 0);
  var totalDials = dayEODs.reduce(function(s, e) { return s + (e.outboundDials || 0); }, 0);
  var cashMYFM = dayEODs.reduce(function(s, e) { return s + (e.cashCollectedMYFM || 0); }, 0);
  var cashI2I = dayEODs.reduce(function(s, e) { return s + (e.cashCollectedI2I || 0); }, 0);

  // Detailed per-closer breakdown
  var closerMap = {};
  dayEODs.forEach(function(e) {
    var name = e.salesRep || e.closerName || 'Unknown';
    if (!closerMap[name]) {
      closerMap[name] = {
        name: name,
        outboundDials: 0,
        callsTaken: 0,
        takenPitched: 0,
        closes: 0,
        cashMYFM: 0,
        cashI2I: 0,
        revenue: 0,
        noShows: 0,
        netNewBooked: 0,
        canceled: 0,
        rescheduled: 0,
        improvement: '',
        dials: 0,
      };
    }
    var c = closerMap[name];
    c.outboundDials += (e.outboundDials || 0);
    c.dials += (e.outboundDials || 0);
    c.callsTaken += (e.callsTaken || 0);
    c.takenPitched += (e.callsTakenAndPitched || 0);
    c.closes += (e.closes || 0);
    c.cashMYFM += (e.cashCollectedMYFM || 0);
    c.cashI2I += (e.cashCollectedI2I || 0);
    c.revenue += (e.revenueOnDay || 0);
    c.noShows += (e.callsNoShowed || 0);
    c.netNewBooked += (e.netNewCallsBooked || 0);
    c.canceled += (e.callsCanceled || 0);
    c.rescheduled += (e.callsRescheduled || 0);
    if (e.improvementPlan) c.improvement = e.improvementPlan;
  });
  dayDeals.forEach(function(d) {
    var name = d.closer || d.closerName || 'Unknown';
    if (!closerMap[name]) {
      closerMap[name] = {
        name: name,
        outboundDials: 0, callsTaken: 0, takenPitched: 0, closes: 0,
        cashMYFM: 0, cashI2I: 0, revenue: 0, noShows: 0,
        netNewBooked: 0, canceled: 0, rescheduled: 0, improvement: '', dials: 0,
      };
    }
    closerMap[name].revenue += (d.cashCollected || 0);
  });

  var closers = Object.values(closerMap).sort(function(a, b) { return b.revenue - a.revenue; });

  // Aggregated totals
  var totalCallsTaken = dayEODs.reduce(function(s, e) { return s + (e.callsTaken || 0); }, 0);
  var totalNoShows = dayEODs.reduce(function(s, e) { return s + (e.callsNoShowed || 0); }, 0);
  var totalNewBooked = dayEODs.reduce(function(s, e) { return s + (e.netNewCallsBooked || 0); }, 0);

  return {
    totalRevenue: totalRevenue || dealCash,
    totalCloses: totalCloses || dayDeals.length,
    totalDials: totalDials,
    eodCount: dayEODs.length,
    cashMYFM: cashMYFM,
    cashI2I: cashI2I,
    closers: closers,
    totals: {
      totalReps: closers.length,
      totalDials: totalDials,
      totalCallsTaken: totalCallsTaken,
      totalCloses: totalCloses || dayDeals.length,
      totalRevenue: totalRevenue || dealCash,
      totalCashMYFM: cashMYFM,
      totalCashI2I: cashI2I,
      totalNoShows: totalNoShows,
      totalNewBooked: totalNewBooked,
    },
  };
}

export function getBookedCallsForDate(dateStr) {
  var date = dateStr || new Date().toISOString().split('T')[0];
  return store.bookedCalls.filter(function(b) {
    return b.bookedDay === date || (b.submittedAt && b.submittedAt.startsWith(date));
  });
}

// ============================================
// COMMISSION FUNCTIONS
// ============================================

export function setCommissionRate(email, rate, name) {
  var key = email.toLowerCase();
  store.commissionRates[key] = {
    rate: parseFloat(rate) || 0.10,
    name: name || email,
    updatedAt: new Date().toISOString(),
  };
  saveCommissionRate(key, store.commissionRates[key]).catch(function(e) { console.error('[DB] Save commission rate error:', e.message); });
}

export function getCommissionRate(email) {
  var entry = store.commissionRates[email.toLowerCase()];
  return entry ? entry.rate : 0.10;
}

export function getAllCommissionRates() {
  return store.commissionRates;
}

export function getCommissionsForCloser(closerName) {
  if (!closerName) return { deals: [], summary: getEmptyCommissionSummary() };

  var closerDeals = store.closedDeals.filter(function(d) {
    return d.closer && d.closer.toLowerCase() === closerName.toLowerCase();
  });

  var rate = 0.10;
  var keys = Object.keys(store.commissionRates);
  for (var i = 0; i < keys.length; i++) {
    if (store.commissionRates[keys[i]].name && store.commissionRates[keys[i]].name.toLowerCase() === closerName.toLowerCase()) {
      rate = store.commissionRates[keys[i]].rate;
      break;
    }
  }

  var deals = closerDeals.map(function(deal) {
    var commission = deal.cashCollected * rate;
    return {
      id: deal.id,
      leadName: deal.leadsName,
      dealValue: deal.cashCollected,
      commissionRate: rate,
      commissionAmount: Math.round(commission * 100) / 100,
      paymentProcessor: deal.paymentProcessor,
      program: deal.program,
      status: deal.commissionStatus || 'pending',
      closedAt: deal.submittedAt,
    };
  });

  var totalDeals = deals.length;
  var totalRevenue = deals.reduce(function(s, d) { return s + d.dealValue; }, 0);
  var totalCommission = deals.reduce(function(s, d) { return s + d.commissionAmount; }, 0);
  var pendingCommission = deals.filter(function(d) { return d.status === 'pending'; }).reduce(function(s, d) { return s + d.commissionAmount; }, 0);
  var approvedCommission = deals.filter(function(d) { return d.status === 'approved'; }).reduce(function(s, d) { return s + d.commissionAmount; }, 0);
  var paidCommission = deals.filter(function(d) { return d.status === 'paid'; }).reduce(function(s, d) { return s + d.commissionAmount; }, 0);

  var months = {};
  deals.forEach(function(deal) {
    var monthKey = deal.closedAt ? deal.closedAt.substring(0, 7) : 'unknown';
    if (!months[monthKey]) {
      months[monthKey] = { month: monthKey, deals: 0, revenue: 0, commission: 0 };
    }
    months[monthKey].deals++;
    months[monthKey].revenue += deal.dealValue;
    months[monthKey].commission += deal.commissionAmount;
  });

  var monthlyBreakdown = Object.values(months).sort(function(a, b) {
    return b.month.localeCompare(a.month);
  });

  return {
    deals: deals,
    summary: {
      totalDeals: totalDeals,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalCommission: Math.round(totalCommission * 100) / 100,
      pendingCommission: Math.round(pendingCommission * 100) / 100,
      approvedCommission: Math.round(approvedCommission * 100) / 100,
      paidCommission: Math.round(paidCommission * 100) / 100,
      commissionRate: rate,
      avgDealValue: totalDeals > 0 ? Math.round(totalRevenue / totalDeals) : 0,
      avgCommission: totalDeals > 0 ? Math.round(totalCommission / totalDeals) : 0,
    },
    monthlyBreakdown: monthlyBreakdown,
  };
}

function getEmptyCommissionSummary() {
  return {
    totalDeals: 0, totalRevenue: 0, totalCommission: 0,
    pendingCommission: 0, approvedCommission: 0, paidCommission: 0,
    commissionRate: 0.10, avgDealValue: 0, avgCommission: 0,
  };
}

export function getAllCommissions() {
  var closerNames = {};
  store.closedDeals.forEach(function(d) {
    if (d.closer) closerNames[d.closer] = true;
  });

  return Object.keys(closerNames).map(function(name) {
    return {
      closerName: name,
      data: getCommissionsForCloser(name),
    };
  }).sort(function(a, b) {
    return b.data.summary.totalCommission - a.data.summary.totalCommission;
  });
}

export function updateCommissionStatus(dealId, status) {
  for (var i = 0; i < store.closedDeals.length; i++) {
    if (store.closedDeals[i].id === dealId) {
      store.closedDeals[i].commissionStatus = status;
      updateDealInDB(store.closedDeals[i]).catch(function(e) { console.error('[DB] Update deal error:', e.message); });
      return store.closedDeals[i];
    }
  }
  return null;
}

// ============================================
// CLOSER PROFILE FUNCTIONS
// ============================================

export function registerCloser(email, name) {
  if (!email) return;
  var key = email.toLowerCase().trim();
  if (store.closerProfiles[key]) {
    // Update existing profile login time and name if provided
    store.closerProfiles[key].lastLogin = new Date().toISOString();
    if (name) store.closerProfiles[key].name = name;
  } else {
    store.closerProfiles[key] = {
      name: name || email,
      email: key,
      registeredAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
    };
  }
  if (!store.commissionRates[key]) {
    store.commissionRates[key] = {
      rate: 0.10,
      name: name || email,
      updatedAt: new Date().toISOString(),
    };
    saveCommissionRate(key, store.commissionRates[key]).catch(function(e) { console.error('[DB] Save commission rate error:', e.message); });
  }
  saveCloserProfile(key, store.closerProfiles[key]).catch(function(e) { console.error('[DB] Save closer profile error:', e.message); });
  console.log('[Store] Registered closer:', name, '(' + key + ')');
  saveCloserProfile(key, store.closerProfiles[key]).catch(function(e) { console.error('[DB] Save profile error:', e.message); });
  if (store.commissionRates[key]) {
    saveCommissionRate(key, store.commissionRates[key]).catch(function(e) { console.error('[DB] Save rate error:', e.message); });
  }
  return store.closerProfiles[key];
}

export function updateCloserLogin(email) {
  if (!email) return;
  var key = email.toLowerCase().trim();
  if (store.closerProfiles[key]) {
    store.closerProfiles[key].lastLogin = new Date().toISOString();
  }
}

export function getCloserNameByEmail(email) {
  if (!email) return null;
  var profile = store.closerProfiles[email.toLowerCase().trim()];
  return profile ? profile.name : null;
}

export function getCloserEmailByName(name) {
  if (!name) return null;
  var keys = Object.keys(store.closerProfiles);
  for (var i = 0; i < keys.length; i++) {
    if (store.closerProfiles[keys[i]].name && store.closerProfiles[keys[i]].name.toLowerCase() === name.toLowerCase()) {
      return keys[i];
    }
  }
  return null;
}

export function getAllCloserProfiles() {
  return store.closerProfiles;
}
