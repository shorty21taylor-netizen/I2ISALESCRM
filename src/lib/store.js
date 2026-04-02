// In-memory data store — persists while the server is running
// Resets on deploy/restart. Replace with database later.

var store = {
  bookedCalls: [],
  closedDeals: [],
  eodReports: [],
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
    leadName: data.leadName || '',
    dealValue: parseFloat(data.dealValue) || 0,
    paymentMethod: data.paymentMethod || 'full-pay',
    leadSource: data.leadSource || 'inbound',
    fathomUrl: data.fathomUrl || '',
    notes: data.notes || '',
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

  // Get unique closers who submitted today
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

    // Trends (0 until we have multi-day data)
    revenueTrend: 0,
    closesTrend: 0,
    closeRateTrend: 0,
    dialsTrend: 0,
    dealValueTrend: 0,
    cashPerCallTrend: 0,
    oneCallCloseTrend: 0,
    offerRateTrend: 0,
    bookedCallsTrend: 0,
    showRateTrend: 0,
    pipelineValueTrend: 0,
    daysToCloseTrend: 0,
    refundRateTrend: 0,
    netRetainedTrend: 0,
    dialsPerHourTrend: 0,
  };
}

// Initialize
recalcOverview();

export function getOverview() {
  if (!overview) recalcOverview();
  return overview;
}

// Get closer-level breakdown
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

// Get all submissions for the activity feed
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
