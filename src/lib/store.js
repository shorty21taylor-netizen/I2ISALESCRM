// In-memory data store — persists while the server is running
// Resets on deploy/restart. Replace with database later.

var store = {
  bookedCalls: [],
  closedDeals: [],
  eodReports: [],
  commissionRates: {},    // { "email@example.com": { rate: 0.10, name: "Marcus" } }
  closerProfiles: {},     // { "email": { name: "Marcus Johnson", email: "marcus@gmail.com", registeredAt: "..." } }
};

export function getStore() {
  return store;
}

export function addBookedCall(data) {
  var entry = {
    id: 'book-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
    closerName: data.closerName || '',
    leadName: data.leadName || '',
    leadPhone: data.leadPhone || '',
    leadEmail: data.leadEmail || '',
    leadSource: data.leadSource || 'inbound',
    channel: data.channel || '',
    callDateTime: data.callDateTime || '',
    notes: data.notes || '',
    submittedAt: new Date().toISOString(),
  };
  store.bookedCalls.unshift(entry);
  if (store.bookedCalls.length > 500) store.bookedCalls = store.bookedCalls.slice(0, 500);
  recalcOverview();
  return entry;
}

export function addClosedDeal(data) {
  var entry = {
    id: 'close-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
    closerName: data.closerName || '',
    closerEmail: data.closerEmail || '',
    leadName: data.leadName || '',
    dealValue: parseFloat(data.dealValue) || 0,
    paymentMethod: data.paymentMethod || 'full-pay',
    leadSource: data.leadSource || 'inbound',
    fathomUrl: data.fathomUrl || '',
    notes: data.notes || '',
    commissionStatus: 'pending',
    submittedAt: new Date().toISOString(),
  };
  store.closedDeals.unshift(entry);
  if (store.closedDeals.length > 500) store.closedDeals = store.closedDeals.slice(0, 500);
  recalcOverview();
  return entry;
}

export function addEODReport(data) {
  var entry = {
    id: 'eod-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
    closerName: data.closerName || '',
    date: data.date || new Date().toISOString().split('T')[0],
    totalDials: parseInt(data.totalDials) || 0,
    connects: parseInt(data.connects) || 0,
    callsBooked: parseInt(data.callsBooked) || 0,
    callsTaken: parseInt(data.callsTaken) || 0,
    closes: parseInt(data.closes) || 0,
    cashCollected: parseFloat(data.cashCollected) || 0,
    pipelineNotes: data.pipelineNotes || '',
    biggestWin: data.biggestWin || '',
    biggestLoss: data.biggestLoss || '',
    confidenceScore: parseInt(data.confidenceScore) || 0,
    submittedAt: new Date().toISOString(),
    status: 'submitted',
  };
  store.eodReports.unshift(entry);
  if (store.eodReports.length > 500) store.eodReports = store.eodReports.slice(0, 500);
  recalcOverview();
  return entry;
}

// Computed overview — recalculated on every new entry
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

  var totalDials = todayEODs.reduce(function(s, e) { return s + e.totalDials; }, 0);
  var totalConnects = todayEODs.reduce(function(s, e) { return s + e.connects; }, 0);
  var totalCallsTaken = todayEODs.reduce(function(s, e) { return s + e.callsTaken; }, 0);
  var totalCloses = todayDeals.length;
  var totalRevenue = todayDeals.reduce(function(s, d) { return s + d.dealValue; }, 0);
  var totalCash = todayEODs.reduce(function(s, e) { return s + e.cashCollected; }, 0);

  var inboundRevenue = todayDeals.filter(function(d) { return d.leadSource === 'inbound'; }).reduce(function(s, d) { return s + d.dealValue; }, 0);
  var outboundRevenue = todayDeals.filter(function(d) { return d.leadSource === 'outbound'; }).reduce(function(s, d) { return s + d.dealValue; }, 0);

  var closeRate = totalCallsTaken > 0 ? Math.round((totalCloses / totalCallsTaken) * 1000) / 10 : 0;
  var avgDealValue = totalCloses > 0 ? Math.round(totalRevenue / totalCloses) : 0;
  var cashPerCall = totalCallsTaken > 0 ? Math.round(totalRevenue / totalCallsTaken) : 0;
  var offerRate = totalCallsTaken > 0 ? Math.round((totalCloses / totalCallsTaken) * 1000) / 10 : 0;

  var closerNames = {};
  todayEODs.forEach(function(e) { closerNames[e.closerName] = true; });
  todayDeals.forEach(function(d) { closerNames[d.closerName] = true; });
  var activeClosers = Object.keys(closerNames).length;

  overview = {
    totalRevenue: totalRevenue,
    totalCloses: totalCloses,
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
    bookedCallsThisWeek: todayBooked.length,
    showRate: 0,
    pipelineValue: 0,
    avgDaysToClose: 0,
    refundRate: 0,
    netRevenueRetained30d: totalRevenue,
    avgDialsPerHour: 0,
    teamDialTarget: 150,
    todayCash: totalCash || totalRevenue,
    todayCloses: totalCloses,
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
    if (!closerMap[eod.closerName]) {
      closerMap[eod.closerName] = { name: eod.closerName, dials: 0, connects: 0, callsBooked: 0, callsTaken: 0, closes: 0, cash: 0, confidence: 0, eodCount: 0 };
    }
    var c = closerMap[eod.closerName];
    c.dials += eod.totalDials;
    c.connects += eod.connects;
    c.callsBooked += eod.callsBooked;
    c.callsTaken += eod.callsTaken;
    c.closes += eod.closes;
    c.cash += eod.cashCollected;
    c.confidence = eod.confidenceScore;
    c.eodCount++;
  });

  store.closedDeals.filter(function(d) { return d.submittedAt && d.submittedAt.startsWith(today); }).forEach(function(deal) {
    if (!closerMap[deal.closerName]) {
      closerMap[deal.closerName] = { name: deal.closerName, dials: 0, connects: 0, callsBooked: 0, callsTaken: 0, closes: 0, cash: 0, confidence: 0, eodCount: 0 };
    }
    closerMap[deal.closerName].cash += deal.dealValue;
  });

  return Object.values(closerMap).sort(function(a, b) { return b.cash - a.cash; });
}

export function getRecentActivity(limit) {
  var all = [];

  store.bookedCalls.forEach(function(b) {
    all.push({ id: b.id, type: 'book-call', closerName: b.closerName, detail: b.leadName + ' \u2014 ' + (b.callDateTime || 'TBD'), submittedAt: b.submittedAt });
  });

  store.closedDeals.forEach(function(d) {
    all.push({ id: d.id, type: 'close-deal', closerName: d.closerName, detail: d.leadName + ' \u2014 $' + d.dealValue.toLocaleString(), submittedAt: d.submittedAt });
  });

  store.eodReports.forEach(function(e) {
    all.push({ id: e.id, type: 'eod-report', closerName: e.closerName, detail: e.totalDials + ' dials, ' + e.closes + ' closes, $' + e.cashCollected.toLocaleString(), submittedAt: e.submittedAt });
  });

  all.sort(function(a, b) { return new Date(b.submittedAt) - new Date(a.submittedAt); });
  return all.slice(0, limit || 50);
}

// ============================================
// COMMISSION FUNCTIONS
// ============================================

export function setCommissionRate(email, rate, name) {
  store.commissionRates[email.toLowerCase()] = {
    rate: parseFloat(rate) || 0.10,
    name: name || email,
    updatedAt: new Date().toISOString(),
  };
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
    return d.closerName && d.closerName.toLowerCase() === closerName.toLowerCase();
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
    var commission = deal.dealValue * rate;
    return {
      id: deal.id,
      leadName: deal.leadName,
      dealValue: deal.dealValue,
      commissionRate: rate,
      commissionAmount: Math.round(commission * 100) / 100,
      paymentMethod: deal.paymentMethod,
      leadSource: deal.leadSource,
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
    if (d.closerName) closerNames[d.closerName] = true;
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
  store.closerProfiles[email.toLowerCase()] = {
    name: name,
    email: email.toLowerCase(),
    registeredAt: new Date().toISOString(),
  };
  if (!store.commissionRates[email.toLowerCase()]) {
    store.commissionRates[email.toLowerCase()] = {
      rate: 0.10,
      name: name,
      updatedAt: new Date().toISOString(),
    };
  }
}

export function getCloserNameByEmail(email) {
  if (!email) return null;
  var profile = store.closerProfiles[email.toLowerCase()];
  return profile ? profile.name : null;
}

export function getAllCloserProfiles() {
  return store.closerProfiles;
}
