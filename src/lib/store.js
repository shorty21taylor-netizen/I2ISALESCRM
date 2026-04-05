// In-memory data store with PostgreSQL persistence
// Data is cached in memory for fast reads, written to DB on every write
// On server start, data is loaded from DB into memory

import { initDatabase, loadFromDatabase, saveBookedCall, saveClosedDeal, saveEODReport, saveCloserProfile, saveCommissionRate, updateDealInDB } from '@/lib/db';
import { loadCustomMessagesFromDB } from '@/lib/scheduler';

var store = {
  bookedCalls: [],
  closedDeals: [],
  eodReports: [],
  commissionRates: {},    // { "email@example.com": { rate: 0.10, name: "Marcus" } }
  closerProfiles: {},     // { "email": { name: "Marcus Johnson", email: "marcus@gmail.com", registeredAt: "..." } }
};

var dbLoaded = false;

export async function initStore() {
  if (dbLoaded) return;
  dbLoaded = true;

  var dbReady = await initDatabase();
  if (!dbReady) {
    console.error('============================================================');
    console.error('WARNING: DATABASE_URL NOT SET — RUNNING IN MEMORY-ONLY MODE');
    console.error('ALL DATA WILL BE LOST ON RESTART/REDEPLOY!');
    console.error('Set DATABASE_URL in Railway: Service → Variables → Add Reference');
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

    console.log('[Store] Loaded from database:',
      store.bookedCalls.length, 'booked calls,',
      store.closedDeals.length, 'deals,',
      store.eodReports.length, 'EODs,',
      Object.keys(store.closerProfiles).length, 'closers'
    );

    recalcOverview();

    // Load custom messages into scheduler
    if (data.customMessages && data.customMessages.length > 0) {
      loadCustomMessagesFromDB(data.customMessages);
    }
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

  var todayEODs = store.eodReports.filter(function(e) { return e.date === today; });
  var todayDeals = store.closedDeals.filter(function(d) {
    return d.submittedAt && d.submittedAt.startsWith(today);
  });
  var todayBooked = store.bookedCalls.filter(function(b) {
    return b.submittedAt && b.submittedAt.startsWith(today);
  });

  var totalDials = todayEODs.reduce(function(s, e) { return s + e.outboundDials; }, 0);
  var totalCallsTaken = todayEODs.reduce(function(s, e) { return s + e.callsTakenAndPitched; }, 0);
  var totalCloses = todayDeals.length;
  var totalRevenue = todayEODs.reduce(function(s, e) { return s + e.revenueOnDay; }, 0);
  var totalCashMYFM = todayEODs.reduce(function(s, e) { return s + e.cashCollectedMYFM; }, 0);
  var totalCashI2I = todayEODs.reduce(function(s, e) { return s + e.cashCollectedI2I; }, 0);
  var totalCash = totalCashMYFM + totalCashI2I;
  var eodCloses = todayEODs.reduce(function(s, e) { return s + e.closes; }, 0);

  var dealCash = todayDeals.reduce(function(s, d) { return s + d.cashCollected; }, 0);

  var inboundRevenue = todayDeals.filter(function(d) { return d.program && d.program.toLowerCase().indexOf('inbound') !== -1; }).reduce(function(s, d) { return s + d.cashCollected; }, 0);
  var outboundRevenue = todayDeals.filter(function(d) { return d.program && d.program.toLowerCase().indexOf('outbound') !== -1; }).reduce(function(s, d) { return s + d.cashCollected; }, 0);

  var closeRate = totalCallsTaken > 0 ? Math.round((eodCloses / totalCallsTaken) * 1000) / 10 : 0;
  var avgDealValue = totalCloses > 0 ? Math.round(dealCash / totalCloses) : 0;
  var cashPerCall = totalCallsTaken > 0 ? Math.round((totalCash || dealCash) / totalCallsTaken) : 0;
  var offerRate = totalCallsTaken > 0 ? Math.round((eodCloses / totalCallsTaken) * 1000) / 10 : 0;

  var closerNames = {};
  todayEODs.forEach(function(e) { closerNames[e.salesRep] = true; });
  todayDeals.forEach(function(d) { closerNames[d.closer] = true; });
  // Remove empty key
  delete closerNames[''];
  var activeClosers = Object.keys(closerNames).length;

  var netNewBooked = todayEODs.reduce(function(s, e) { return s + e.netNewCallsBooked; }, 0);

  overview = {
    totalRevenue: totalRevenue || dealCash,
    totalCloses: eodCloses || totalCloses,
    teamCloseRate: closeRate,
    totalDials: totalDials,
    avgDealValue: avgDealValue,
    cashPerCallTaken: cashPerCall,
    offerRate: offerRate,
    oneCallCloseRate: 0,
    inboundRevenue: inboundRevenue,
    outboundRevenue: outboundRevenue,
    activeClosers: activeClosers,
    eodComplianceRate: 0,
    bookedCallsThisWeek: todayBooked.length + netNewBooked,
    showRate: 0,
    pipelineValue: 0,
    avgDaysToClose: 0,
    refundRate: 0,
    netRevenueRetained30d: totalRevenue || dealCash,
    avgDialsPerHour: 0,
    teamDialTarget: 150,
    todayCash: totalCash || dealCash,
    todayCloses: eodCloses || totalCloses,
    todayDials: totalDials,
    todayBooked: todayBooked.length,
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

export function getCloserBreakdown() {
  var today = new Date().toISOString().split('T')[0];
  var closerMap = {};

  store.eodReports.filter(function(e) { return e.date === today; }).forEach(function(eod) {
    var name = eod.salesRep;
    if (!name) return;
    if (!closerMap[name]) {
      closerMap[name] = { name: name, dials: 0, connects: 0, callsBooked: 0, callsTaken: 0, closes: 0, cash: 0, confidence: 0, eodCount: 0 };
    }
    var c = closerMap[name];
    c.dials += eod.outboundDials;
    c.callsBooked += eod.netNewCallsBooked;
    c.callsTaken += eod.callsTakenAndPitched;
    c.closes += eod.closes;
    c.cash += eod.cashCollectedMYFM + eod.cashCollectedI2I;
    c.eodCount++;
  });

  store.closedDeals.filter(function(d) { return d.submittedAt && d.submittedAt.startsWith(today); }).forEach(function(deal) {
    var name = deal.closer;
    if (!name) return;
    if (!closerMap[name]) {
      closerMap[name] = { name: name, dials: 0, connects: 0, callsBooked: 0, callsTaken: 0, closes: 0, cash: 0, confidence: 0, eodCount: 0 };
    }
    closerMap[name].cash += deal.cashCollected;
  });

  return Object.values(closerMap).sort(function(a, b) { return b.cash - a.cash; });
}

export function getRecentActivity(limit) {
  var all = [];

  store.bookedCalls.forEach(function(b) {
    all.push({ id: b.id, type: 'book-call', closerName: b.closer || b.setter, detail: b.leadsName + ' — ' + (b.program || 'N/A') + ' — ' + (b.bookedDay || 'TBD'), submittedAt: b.submittedAt });
  });

  store.closedDeals.forEach(function(d) {
    all.push({ id: d.id, type: 'close-deal', closerName: d.closer, detail: d.leadsName + ' — $' + d.cashCollected.toLocaleString() + ' — ' + (d.program || 'N/A'), submittedAt: d.submittedAt });
  });

  store.eodReports.forEach(function(e) {
    var totalCash = e.cashCollectedMYFM + e.cashCollectedI2I;
    all.push({ id: e.id, type: 'eod-report', closerName: e.salesRep, detail: e.outboundDials + ' dials, ' + e.closes + ' closes, $' + totalCash.toLocaleString(), submittedAt: e.submittedAt });
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
  saveCommissionRate(email, store.commissionRates[key]).catch(function(e) { console.error('[DB] Save rate error:', e.message); });
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
  }
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
