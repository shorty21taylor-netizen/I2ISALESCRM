// In-memory data store with PostgreSQL persistence.
// On startup, data loads from DB. Every write saves to both memory AND DB.
// Graceful fallback: works without DATABASE_URL in memory-only mode.

import { initDatabase, loadFromDatabase, saveBookedCall, saveClosedDeal, saveEODReport, saveCloserProfile, saveCommissionRate, updateDealInDB, deleteBookedCall as dbDeleteBookedCall, deleteClosedDeal as dbDeleteClosedDeal, deleteEODReport as dbDeleteEODReport, deleteCloserProfile as dbDeleteCloserProfile, loadWorkspaces, saveWorkspace, deleteWorkspaceDB, backfillWorkspaces } from '@/lib/db';
import { DEFAULT_WORKSPACES, ALL_WORKSPACES, recordInWorkspace, resolveWorkspaceId, workspaceIdForProgram, canonicalOffer, findWorkspace, offerColor } from '@/lib/workspaces';

var store = {
  workspaces: DEFAULT_WORKSPACES.map(function(w) { return JSON.parse(JSON.stringify(w)); }),
  bookedCalls: [],
  closedDeals: [],
  eodReports: [],
  commissionRates: {},
  closerProfiles: {},
  whatsappConfig: {
    assistroApiUrl: '',
    assistroApiKey: '',
    bookedCallGroupId: '',
    bookedCallEnabled: true,
    closedDealGroupId: '',
    closedDealEnabled: true,
    eodReportGroupId: '',
    eodReportEnabled: true,
  },
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

    // Workspaces must exist before records load, so scoping has something to resolve against.
    var wsRows = await loadWorkspaces();
    if (wsRows && wsRows.length) {
      store.workspaces = wsRows;
    } else {
      for (var w = 0; w < store.workspaces.length; w++) {
        await saveWorkspace(store.workspaces[w]).catch(function(e) { console.error('[DB] Seed workspace error:', e.message); });
      }
      console.log('[Store] Seeded', store.workspaces.length, 'default workspaces');
    }

    var myfmWs = findWorkspace(store.workspaces, 'myfm');
    var fallbackWs = store.workspaces[0];
    if (myfmWs && fallbackWs) {
      var myfmPrograms = ['myfm coaching offer', 'myfm', 'saas', 'fund2grow', 'saas (fund2grow)'];
      await backfillWorkspaces(myfmPrograms, myfmWs.id, fallbackWs.id);
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
// WORKSPACES — tenant registry + scoping
// ============================================

export function getWorkspaces() {
  return store.workspaces;
}

export function getWorkspace(id) {
  return findWorkspace(store.workspaces, id);
}

export function addWorkspace(ws) {
  if (!ws || !ws.id || !ws.name) throw new Error('Workspace needs an id and a name');
  if (findWorkspace(store.workspaces, ws.id)) throw new Error('A workspace with id "' + ws.id + '" already exists');
  var entry = {
    id: ws.id,
    name: ws.name,
    shortName: ws.shortName || ws.name,
    commissionRate: typeof ws.commissionRate === 'number' ? ws.commissionRate : 0.10,
    eodCashField: ws.eodCashField || '',
    offers: Array.isArray(ws.offers) ? ws.offers : [],
    builtIn: false,
    createdAt: new Date().toISOString(),
  };
  store.workspaces.push(entry);
  saveWorkspace(entry).catch(function(e) { console.error('[DB] Save workspace error:', e.message); });
  return entry;
}

export function updateWorkspace(id, patch) {
  var ws = findWorkspace(store.workspaces, id);
  if (!ws) throw new Error('Workspace not found: ' + id);
  if (patch.name !== undefined) ws.name = patch.name;
  if (patch.shortName !== undefined) ws.shortName = patch.shortName;
  if (patch.commissionRate !== undefined) ws.commissionRate = parseFloat(patch.commissionRate) || 0;
  if (patch.eodCashField !== undefined) ws.eodCashField = patch.eodCashField;
  if (patch.offers !== undefined && Array.isArray(patch.offers)) ws.offers = patch.offers;
  saveWorkspace(ws).catch(function(e) { console.error('[DB] Update workspace error:', e.message); });
  return ws;
}

export function deleteWorkspace(id) {
  var ws = findWorkspace(store.workspaces, id);
  if (!ws) throw new Error('Workspace not found: ' + id);
  if (ws.builtIn) throw new Error('Built-in workspaces cannot be deleted');
  if (store.workspaces.length <= 1) throw new Error('At least one workspace must remain');

  // Records are re-homed rather than deleted, so removing a workspace never loses data.
  var fallback = store.workspaces.filter(function(w) { return w.id !== id; })[0];
  var moved = 0;
  ['bookedCalls', 'closedDeals', 'eodReports'].forEach(function(key) {
    store[key].forEach(function(r) {
      if (r.workspaceId === id) { r.workspaceId = fallback.id; moved++; }
    });
  });

  store.workspaces = store.workspaces.filter(function(w) { return w.id !== id; });
  deleteWorkspaceDB(id).catch(function(e) { console.error('[DB] Delete workspace error:', e.message); });
  recalcOverview();
  return { success: true, movedRecords: moved, movedTo: fallback.id };
}

// Filter any record list down to one workspace. ALL_WORKSPACES / null returns everything.
function scoped(list, workspaceId) {
  if (!workspaceId || workspaceId === ALL_WORKSPACES) return list;
  return list.filter(function(r) { return recordInWorkspace(r, workspaceId, store.workspaces); });
}

// Cash on an EOD report attributable to a given workspace. Workspaces mapped to a
// brand-specific EOD field use it; anything else falls back to the report total.
function eodCashForWorkspace(eod, workspaceId) {
  // Legacy reports split cash across two brand fields; newer ones use the generic
  // bucket. They are alternative shapes, never both, so prefer the brand split.
  var brandTotal = (parseFloat(eod.cashCollectedMYFM) || 0) + (parseFloat(eod.cashCollectedI2I) || 0);
  var reportTotal = brandTotal || (parseFloat(eod.cashCollected) || 0);

  if (!workspaceId || workspaceId === ALL_WORKSPACES) return reportTotal;

  var ws = findWorkspace(store.workspaces, workspaceId);
  // A workspace mapped to a brand field takes only its own column, so one report
  // covering both companies never leaks cash into the wrong dashboard.
  if (ws && ws.eodCashField) return parseFloat(eod[ws.eodCashField]) || 0;
  return reportTotal;
}

// ============================================
// WHATSAPP CONFIG — server-side per-form config
// ============================================

export function getWhatsappConfig() {
  return store.whatsappConfig || {};
}

export function setWhatsappConfig(c) {
  if (!c) return;
  var wc = store.whatsappConfig;
  if (c.assistroApiUrl !== undefined) wc.assistroApiUrl = c.assistroApiUrl;
  if (c.assistroApiKey !== undefined) wc.assistroApiKey = c.assistroApiKey;
  if (c.bookedCallGroupId !== undefined) wc.bookedCallGroupId = c.bookedCallGroupId;
  if (c.bookedCallEnabled !== undefined) wc.bookedCallEnabled = c.bookedCallEnabled;
  if (c.closedDealGroupId !== undefined) wc.closedDealGroupId = c.closedDealGroupId;
  if (c.closedDealEnabled !== undefined) wc.closedDealEnabled = c.closedDealEnabled;
  if (c.eodReportGroupId !== undefined) wc.eodReportGroupId = c.eodReportGroupId;
  if (c.eodReportEnabled !== undefined) wc.eodReportEnabled = c.eodReportEnabled;
  // Legacy fallback: if whatsappGroupId set but per-form IDs empty, fill them
  if (c.whatsappGroupId) {
    if (!wc.bookedCallGroupId) wc.bookedCallGroupId = c.whatsappGroupId;
    if (!wc.closedDealGroupId) wc.closedDealGroupId = c.whatsappGroupId;
    if (!wc.eodReportGroupId) wc.eodReportGroupId = c.whatsappGroupId;
  }
  console.log('[Store] WA config set — api:', !!wc.assistroApiUrl, 'booked:', !!wc.bookedCallGroupId, 'deal:', !!wc.closedDealGroupId, 'eod:', !!wc.eodReportGroupId);
}

// ============================================
// BOOK A CALL — new fields
// ============================================

export function addBookedCall(data) {
  var entry = {
    id: 'book-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
    workspaceId: data.workspaceId || workspaceIdForProgram(data.program, store.workspaces) || store.workspaces[0].id,
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
  return entry;
}

// ============================================
// CLOSE A DEAL — new fields
// ============================================

export function addClosedDeal(data) {
  var entry = {
    id: 'close-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
    workspaceId: data.workspaceId || workspaceIdForProgram(data.program, store.workspaces) || store.workspaces[0].id,
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
    outboundInbound: data.outboundInbound || data.leadSource || '',
    commissionStatus: 'pending',
    submittedAt: new Date().toISOString(),
  };
  entry.closedAt = entry.submittedAt;
  store.closedDeals.unshift(entry);
  if (store.closedDeals.length > 500) store.closedDeals = store.closedDeals.slice(0, 500);
  saveClosedDeal(entry).catch(function(e) { console.error('[DB] Save closed deal error:', e.message); });
  recalcOverview();
  return entry;
}

// ============================================
// EOD REPORT — new fields
// ============================================

export function addEODReport(data) {
  var entry = {
    id: 'eod-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
    workspaceId: data.workspaceId || store.workspaces[0].id,
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
    // Generic cash bucket for workspaces that aren't mapped to a brand-specific field.
    cashCollected: parseFloat(data.cashCollected) || 0,
    revenueOnDay: parseFloat(data.revenueOnDay) || 0,
    improvementPlan: data.improvementPlan || '',
    submittedAt: new Date().toISOString(),
    status: 'submitted',
  };
  store.eodReports.unshift(entry);
  if (store.eodReports.length > 500) store.eodReports = store.eodReports.slice(0, 500);
  saveEODReport(entry).catch(function(e) { console.error('[DB] Save EOD error:', e.message); });
  recalcOverview();
  return entry;
}

// ============================================
// DELETE RECORDS (admin only — single record by ID)
// ============================================

export async function removeBookedCall(id) {
  store.bookedCalls = store.bookedCalls.filter(function(b) { return b.id !== id; });
  await dbDeleteBookedCall(id).catch(function(e) { console.error('[DB delete]', e.message); });
  recalcOverview();
  return { success: true };
}

export async function removeClosedDeal(id) {
  store.closedDeals = store.closedDeals.filter(function(d) { return d.id !== id; });
  await dbDeleteClosedDeal(id).catch(function(e) { console.error('[DB delete]', e.message); });
  recalcOverview();
  return { success: true };
}

export async function removeEODReport(id) {
  store.eodReports = store.eodReports.filter(function(e) { return e.id !== id; });
  await dbDeleteEODReport(id).catch(function(e) { console.error('[DB delete]', e.message); });
  recalcOverview();
  return { success: true };
}

export async function removeCloserProfile(email) {
  var key = email.toLowerCase();
  delete store.closerProfiles[key];
  await dbDeleteCloserProfile(key).catch(function(e) { console.error('[DB delete]', e.message); });
  return { success: true };
}

// ============================================
// COMPUTED OVERVIEW
// ============================================

var overview = null;

export function recalcOverview() {
  var today = new Date().toISOString().split('T')[0];
  overview = computeOverviewForRange(today, today);
}

function computeOverviewForRange(startDate, endDate, workspaceId) {
  var today = new Date().toISOString().split('T')[0];
  var start = startDate || today;
  var end = endDate || today;

  var rangeEODs = scoped(store.eodReports, workspaceId).filter(function(e) {
    var d = e.date || (e.submittedAt ? e.submittedAt.split('T')[0] : '');
    return d >= start && d <= end;
  });

  var rangeDeals = scoped(store.closedDeals, workspaceId).filter(function(d) {
    var dt = d.submittedAt ? d.submittedAt.split('T')[0] : '';
    return dt >= start && dt <= end;
  });

  var rangeBooked = scoped(store.bookedCalls, workspaceId).filter(function(b) {
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

  // A single EOD report can carry cash for more than one company, so a scoped view
  // takes only the portion belonging to that workspace — otherwise one company's
  // dashboard would include another's cash.
  var eodCashTotal = rangeEODs.reduce(function(s, e) {
    return s + eodCashForWorkspace(e, workspaceId);
  }, 0);

  // CASH from closed deal entries
  var dealCashTotal = rangeDeals.reduce(function(s, d) {
    return s + (parseFloat(d.cashCollected) || parseFloat(d.dealValue) || 0);
  }, 0);

  // REVENUE from EOD revenueOnDay field
  var eodRevenue = rangeEODs.reduce(function(s, e) {
    return s + (parseFloat(e.revenueOnDay) || 0);
  }, 0);

  // Canonical cash: highest of the three sources (EOD MYFM+I2I, closed deals, EOD revenueOnDay)
  var totalCash = Math.max(dealCashTotal, eodCashTotal, eodRevenue);
  var totalRevenue = totalCash;

  console.log('[Overview] Range:', start, '→', end, '| Deals:', rangeDeals.length, '(eodCloses:', eodCloses, ') → totalCloses:', totalCloses, '| Revenue: $' + Math.round(totalRevenue), '| eodCash:', Math.round(eodCashTotal), '| dealCash:', Math.round(dealCashTotal), '| eodRev:', Math.round(eodRevenue));

  // RATES
  // CLOSE RATE = closes / calls taken & pitched (true closing skill), capped at 100%
  var closeRateRaw = totalCallsPitched > 0 ? (totalCloses / totalCallsPitched) * 100 : 0;
  var closeRate = Math.min(Math.round(closeRateRaw * 10) / 10, 100);
  var avgDealValue = totalCloses > 0 ? Math.round(totalRevenue / totalCloses) : 0;
  var cashPerCall = totalCallsTaken > 0 ? Math.round(totalRevenue / totalCallsTaken) : 0;
  var offerRate = totalCallsTaken > 0 ? Math.round((totalCallsPitched / totalCallsTaken) * 1000) / 10 : 0;
  var showRateRaw = totalCallsOnCalendar > 0 ? (totalCallsTaken / totalCallsOnCalendar) * 100 : 0;
  var showRate = Math.min(Math.round(showRateRaw * 10) / 10, 100);
  if (showRateRaw > 100) {
    console.log('[Show Rate] Capped from', showRateRaw.toFixed(1) + '% to 100% — taken:', totalCallsTaken, 'calendar:', totalCallsOnCalendar, '(EOD reps may be filling callsTaken without callsOnCalendar)');
  }
  // DIAL TO BOOK RATE = booked / dials (cold outreach efficiency)
  var dialToBookRate = totalDials > 0 ? Math.round((totalNewBooked / totalDials) * 1000) / 10 : 0;
  // OVERALL CONVERSION = closes / dials (full funnel)
  var overallConversion = totalDials > 0 ? Math.round((totalCloses / totalDials) * 10000) / 100 : 0;

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

  // PER-OFFER BREAKDOWN (5 offers)
  function getOfferBucket(program) {
    var p = (program || '').toLowerCase().trim();
    if (p === 'dfy funding' || p === 'dfy-funding') return 'dfy-funding';
    if (p === 'inner circle mentorship' || p === 'inner circle' || p === 'dfy funding (inner circle)') return 'inner-circle';
    if (p === 'coaching digital offer' || p === 'coaching' || p === 'coaching (digital programs)' || p === 'digital programs') return 'coaching-digital';
    if (p === 'coaching funding offer') return 'coaching-funding';
    if (p === 'myfm coaching offer' || p === 'myfm' || p === 'saas' || p === 'fund2grow' || p === 'saas (fund2grow)') return 'myfm';
    return 'other';
  }

  // Greyscale ramp — offers stay distinguishable without reintroducing brand color.
  var offerBreakdown = {
    'dfy-funding':      { key: 'dfy-funding',      label: 'DFY Funding',            subtitle: 'Funding-for-Hire',       booked: 0, closes: 0, revenue: 0, color: offerColor(0) },
    'coaching-digital': { key: 'coaching-digital',  label: 'Coaching Digital Offer',  subtitle: 'Digital Programs',       booked: 0, closes: 0, revenue: 0, color: offerColor(1) },
    'coaching-funding': { key: 'coaching-funding',  label: 'Coaching Funding Offer',  subtitle: 'Funding Coaching',       booked: 0, closes: 0, revenue: 0, color: offerColor(2) },
    'inner-circle':     { key: 'inner-circle',      label: 'Inner Circle Mentorship', subtitle: 'Mentorship',             booked: 0, closes: 0, revenue: 0, color: offerColor(3) },
    'myfm':             { key: 'myfm',              label: 'MYFM Coaching Offer',     subtitle: 'Make Your First Million', booked: 0, closes: 0, revenue: 0, color: offerColor(4) },
  };

  rangeBooked.forEach(function(b) {
    var bucket = getOfferBucket(b.program);
    if (offerBreakdown[bucket]) offerBreakdown[bucket].booked++;
  });

  rangeDeals.forEach(function(d) {
    var bucket = getOfferBucket(d.program);
    var cash = parseFloat(d.cashCollected) || parseFloat(d.dealValue) || 0;
    if (offerBreakdown[bucket]) {
      offerBreakdown[bucket].closes++;
      offerBreakdown[bucket].revenue += cash;
    }
  });

  // Payment type breakdown (Full Pay vs Payment Plan)
  var paymentBreakdown = {
    fullPay: { deals: 0, revenue: 0 },
    paymentPlan: { deals: 0, revenue: 0 },
  };

  rangeDeals.forEach(function(d) {
    var cash = parseFloat(d.cashCollected) || parseFloat(d.dealValue) || 0;
    var pt = (d.paymentDetails || '').toLowerCase();
    if (pt === 'full pay') {
      paymentBreakdown.fullPay.deals++;
      paymentBreakdown.fullPay.revenue += cash;
    } else if (pt) {
      paymentBreakdown.paymentPlan.deals++;
      paymentBreakdown.paymentPlan.revenue += cash;
    }
  });

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
    dialToBookRate: dialToBookRate,
    overallConversion: overallConversion,
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
    dealCashTotal: Math.round(dealCashTotal * 100) / 100,
    eodCashTotal: Math.round(eodCashTotal * 100) / 100,
    eodRevenueOnDay: Math.round(eodRevenue * 100) / 100,
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
    offerBreakdown: offerBreakdown,
    paymentBreakdown: paymentBreakdown,
  };
}

recalcOverview();

export function getOverview() {
  if (!overview) recalcOverview();
  return overview;
}

export function getFilteredOverview(startDate, endDate, workspaceId) {
  return computeOverviewForRange(startDate, endDate, workspaceId);
}

export function getCloserBreakdown(startDate, endDate, workspaceId) {
  var today = new Date().toISOString().split('T')[0];
  var start = startDate || today;
  var end = endDate || today;
  var closerMap = {};

  scoped(store.eodReports, workspaceId).filter(function(e) {
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

  scoped(store.closedDeals, workspaceId).filter(function(d) {
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

export function getRecentActivity(limit, workspaceId) {
  var all = [];

  scoped(store.bookedCalls, workspaceId).forEach(function(b) {
    all.push({
      id: b.id,
      type: 'book-call',
      closerName: b.closer || b.setter || '',
      detail: (b.leadsName || b.leadName || '') + ' — ' + (b.program || 'N/A') + ' — ' + (b.bookedDay || 'TBD'),
      submittedAt: b.submittedAt,
    });
  });

  scoped(store.closedDeals, workspaceId).forEach(function(d) {
    all.push({
      id: d.id,
      type: 'close-deal',
      closerName: d.closer || d.closerName || '',
      detail: (d.leadsName || d.leadName || '') + ' — $' + Number(d.cashCollected || d.dealValue || 0).toLocaleString() + ' — ' + (d.program || 'N/A'),
      submittedAt: d.submittedAt,
    });
  });

  scoped(store.eodReports, workspaceId).forEach(function(e) {
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

// The owning workspace sets the rate, so adding a company no longer needs a code change.
function getCommissionRateForDeal(deal) {
  var ws = findWorkspace(store.workspaces, resolveWorkspaceId(deal, store.workspaces));
  if (ws && typeof ws.commissionRate === 'number') return ws.commissionRate;
  return 0.10;
}

function getBrandForDeal(deal) {
  var ws = findWorkspace(store.workspaces, resolveWorkspaceId(deal, store.workspaces));
  return ws ? (ws.shortName || ws.name) : 'Unassigned';
}

export function getCommissionsForCloser(closerName, workspaceId) {
  if (!closerName) return { deals: [], summary: getEmptyCommissionSummary() };

  var closerDeals = scoped(store.closedDeals, workspaceId).filter(function(d) {
    return d.closer && d.closer.toLowerCase() === closerName.toLowerCase();
  });

  var deals = closerDeals.map(function(deal) {
    var rate = getCommissionRateForDeal(deal);
    var commission = (parseFloat(deal.cashCollected) || parseFloat(deal.dealValue) || 0) * rate;
    var brandLabel = getBrandForDeal(deal);
    return {
      id: deal.id,
      leadName: deal.leadsName || deal.leadName || '',
      dealValue: parseFloat(deal.cashCollected) || parseFloat(deal.dealValue) || 0,
      commissionRate: rate,
      commissionAmount: Math.round(commission * 100) / 100,
      brand: brandLabel,
      program: deal.program || '',
      paymentProcessor: deal.paymentProcessor,
      paymentMethod: deal.paymentDetails || deal.paymentMethod || '',
      leadSource: deal.leadSource || deal.outboundInbound || '',
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

  // Per-brand breakdown
  var i2iCommission = deals.filter(function(d) { return d.brand === 'I2I'; }).reduce(function(s, d) { return s + d.commissionAmount; }, 0);
  var myfmCommission = deals.filter(function(d) { return d.brand === 'MYFM'; }).reduce(function(s, d) { return s + d.commissionAmount; }, 0);
  var i2iRevenue = deals.filter(function(d) { return d.brand === 'I2I'; }).reduce(function(s, d) { return s + d.dealValue; }, 0);
  var myfmRevenue = deals.filter(function(d) { return d.brand === 'MYFM'; }).reduce(function(s, d) { return s + d.dealValue; }, 0);
  var i2iDeals = deals.filter(function(d) { return d.brand === 'I2I'; }).length;
  var myfmDeals = deals.filter(function(d) { return d.brand === 'MYFM'; }).length;

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
      avgDealValue: totalDeals > 0 ? Math.round(totalRevenue / totalDeals) : 0,
      avgCommission: totalDeals > 0 ? Math.round(totalCommission / totalDeals) : 0,
      i2i: { deals: i2iDeals, revenue: Math.round(i2iRevenue * 100) / 100, commission: Math.round(i2iCommission * 100) / 100, rate: 0.10 },
      myfm: { deals: myfmDeals, revenue: Math.round(myfmRevenue * 100) / 100, commission: Math.round(myfmCommission * 100) / 100, rate: 0.075 },
    },
    monthlyBreakdown: monthlyBreakdown,
  };
}

function getEmptyCommissionSummary() {
  return {
    totalDeals: 0, totalRevenue: 0, totalCommission: 0,
    pendingCommission: 0, approvedCommission: 0, paidCommission: 0,
    avgDealValue: 0, avgCommission: 0,
    i2i: { deals: 0, revenue: 0, commission: 0, rate: 0.10 },
    myfm: { deals: 0, revenue: 0, commission: 0, rate: 0.075 },
  };
}

export function getAllCommissions(workspaceId) {
  var closerNames = {};
  scoped(store.closedDeals, workspaceId).forEach(function(d) {
    if (d.closer) closerNames[d.closer] = true;
  });

  return Object.keys(closerNames).map(function(name) {
    return {
      closerName: name,
      data: getCommissionsForCloser(name, workspaceId),
    };
  }).sort(function(a, b) {
    return b.data.summary.totalCommission - a.data.summary.totalCommission;
  });
}

// ============================================
// OWNER ROLLUP — every offer across every company
// ============================================
//
// Revenue and commission come from closed deals (the per-offer source of truth).
// Cash collected is reported per company on EOD reports, which have no offer
// breakdown, so a company's EOD cash is apportioned across its offers by each
// offer's share of deal revenue. When a company has EOD cash but no deals in the
// range, that cash is reported at company level as `unattributedCash` rather than
// being silently dropped.

export function getOwnerRollup(startDate, endDate) {
  var today = new Date().toISOString().split('T')[0];
  var start = startDate || today;
  var end = endDate || today;

  var rangeDeals = store.closedDeals.filter(function(d) {
    var dt = d.submittedAt ? d.submittedAt.split('T')[0] : '';
    return dt >= start && dt <= end;
  });

  var rangeEODs = store.eodReports.filter(function(e) {
    var d = e.date || (e.submittedAt ? e.submittedAt.split('T')[0] : '');
    return d >= start && d <= end;
  });

  var rangeBooked = store.bookedCalls.filter(function(b) {
    var dt = b.submittedAt ? b.submittedAt.split('T')[0] : '';
    return dt >= start && dt <= end;
  });

  // Seed every declared offer so an offer with no activity still shows up at zero.
  var offers = {};
  var companies = {};

  store.workspaces.forEach(function(ws) {
    companies[ws.id] = {
      workspaceId: ws.id,
      name: ws.name,
      shortName: ws.shortName || ws.name,
      commissionRate: ws.commissionRate,
      revenue: 0,
      cashCollected: 0,
      unattributedCash: 0,
      commission: 0,
      deals: 0,
      booked: 0,
      offers: [],
    };
    (ws.offers || []).forEach(function(offerName) {
      var key = ws.id + '::' + canonicalOffer(offerName);
      offers[key] = {
        key: key,
        offer: offerName,
        workspaceId: ws.id,
        workspaceName: ws.name,
        workspaceShortName: ws.shortName || ws.name,
        commissionRate: ws.commissionRate,
        revenue: 0,
        cashCollected: 0,
        commission: 0,
        deals: 0,
        booked: 0,
      };
    });
  });

  function offerBucket(record) {
    var wsId = resolveWorkspaceId(record, store.workspaces);
    var offer = canonicalOffer(record.program) || 'Unspecified';
    var key = wsId + '::' + offer;
    if (!offers[key]) {
      // An offer seen in the data but not declared on the workspace — surface it
      // rather than folding it into a bucket it does not belong to.
      var ws = findWorkspace(store.workspaces, wsId);
      offers[key] = {
        key: key,
        offer: offer,
        workspaceId: wsId,
        workspaceName: ws ? ws.name : 'Unassigned',
        workspaceShortName: ws ? (ws.shortName || ws.name) : 'Unassigned',
        commissionRate: ws && typeof ws.commissionRate === 'number' ? ws.commissionRate : 0.10,
        revenue: 0, cashCollected: 0, commission: 0, deals: 0, booked: 0,
        undeclared: true,
      };
    }
    return offers[key];
  }

  rangeDeals.forEach(function(deal) {
    var value = parseFloat(deal.cashCollected) || parseFloat(deal.dealValue) || 0;
    var rate = getCommissionRateForDeal(deal);
    var bucket = offerBucket(deal);
    bucket.revenue += value;
    bucket.commission += value * rate;
    bucket.deals++;

    var co = companies[bucket.workspaceId];
    if (co) {
      co.revenue += value;
      co.commission += value * rate;
      co.deals++;
    }
  });

  rangeBooked.forEach(function(b) {
    var bucket = offerBucket(b);
    bucket.booked++;
    var co = companies[bucket.workspaceId];
    if (co) co.booked++;
  });

  // EOD cash -> company, then apportioned to that company's offers by revenue share.
  store.workspaces.forEach(function(ws) {
    var co = companies[ws.id];
    if (!co) return;
    var cash = rangeEODs.reduce(function(sum, e) {
      if (ws.eodCashField) return sum + (parseFloat(e[ws.eodCashField]) || 0);
      return recordInWorkspace(e, ws.id, store.workspaces) ? sum + eodCashForWorkspace(e, ws.id) : sum;
    }, 0);
    co.cashCollected = cash;

    var wsOffers = Object.keys(offers).map(function(k) { return offers[k]; }).filter(function(o) { return o.workspaceId === ws.id; });
    var totalRev = wsOffers.reduce(function(sum, o) { return sum + o.revenue; }, 0);
    if (totalRev > 0) {
      wsOffers.forEach(function(o) { o.cashCollected = cash * (o.revenue / totalRev); });
    } else {
      co.unattributedCash = cash;
    }
  });

  function round(n) { return Math.round(n * 100) / 100; }

  var offerList = Object.keys(offers).map(function(k) {
    var o = offers[k];
    return {
      key: o.key,
      offer: o.offer,
      workspaceId: o.workspaceId,
      workspaceName: o.workspaceName,
      workspaceShortName: o.workspaceShortName,
      commissionRate: o.commissionRate,
      revenue: round(o.revenue),
      cashCollected: round(o.cashCollected),
      commission: round(o.commission),
      deals: o.deals,
      booked: o.booked,
      undeclared: !!o.undeclared,
    };
  }).sort(function(a, b) { return b.revenue - a.revenue; });

  var companyList = Object.keys(companies).map(function(k) {
    var c = companies[k];
    c.offers = offerList.filter(function(o) { return o.workspaceId === c.workspaceId; }).map(function(o) { return o.key; });
    return {
      workspaceId: c.workspaceId,
      name: c.name,
      shortName: c.shortName,
      commissionRate: c.commissionRate,
      revenue: round(c.revenue),
      cashCollected: round(c.cashCollected),
      unattributedCash: round(c.unattributedCash),
      commission: round(c.commission),
      deals: c.deals,
      booked: c.booked,
      offers: c.offers,
    };
  }).sort(function(a, b) { return b.revenue - a.revenue; });

  return {
    dateRange: { start: start, end: end },
    offers: offerList,
    companies: companyList,
    totals: {
      revenue: round(companyList.reduce(function(s, c) { return s + c.revenue; }, 0)),
      cashCollected: round(companyList.reduce(function(s, c) { return s + c.cashCollected; }, 0)),
      commission: round(companyList.reduce(function(s, c) { return s + c.commission; }, 0)),
      deals: companyList.reduce(function(s, c) { return s + c.deals; }, 0),
      booked: companyList.reduce(function(s, c) { return s + c.booked; }, 0),
    },
  };
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
  if (!email) {
    console.warn('[Store] registerCloser called without email — skipping');
    return;
  }
  var key = email.toLowerCase().trim();
  if (store.closerProfiles[key]) {
    store.closerProfiles[key].lastLogin = new Date().toISOString();
    // Only update name if profile has no name or name is just the email
    if (name && (!store.closerProfiles[key].name || store.closerProfiles[key].name === key)) {
      store.closerProfiles[key].name = name;
    }
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
  console.log('[Store] Registered closer:', store.closerProfiles[key].name, '(' + key + ')');
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
