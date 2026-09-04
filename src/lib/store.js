// In-memory data store with PostgreSQL persistence.
// On startup, data loads from DB. Every write saves to both memory AND DB.
// Graceful fallback: works without DATABASE_URL in memory-only mode.

import { recordDay, toReportDay, todayInReportTimezone } from '@/lib/report-date';
import { DEFAULT_STAGE, isStage, isCommunity, money } from '@/lib/skool';
import { initDatabase, loadFromDatabase, saveBookedCall, saveClosedDeal, saveEODReport, saveCloserProfile, saveCommissionRate, updateDealInDB, saveMessageLogEntry, saveAfterCallReport, saveSkoolLead, softDeleteRecord } from '@/lib/db';
import { saveWorkspace, loadWorkspaces, loadWorkspace, saveWorkspaceUser, findUserWorkspace, loadWorkspaceUsers, saveAppConfig, loadAppConfig } from '@/lib/db';

// The primary workspace every pre-workspace record belongs to. Seeded in SQL when a
// database is present, and kept here as well so the switcher still works in
// memory-only mode (no DATABASE_URL) instead of showing an empty list.
var DEFAULT_WORKSPACE = {
  id: 'default',
  name: 'Influence2Impact',
  slug: 'i2i',
  ownerEmail: 'shorty21taylor@gmail.com',
  branding: { primaryColor: '#a3a3a3', secondaryColor: '#22c55e', companyName: 'Influence2Impact' },
  active: true,
};

var store = {
  bookedCalls: [],
  closedDeals: [],
  eodReports: [],
  afterCallReports: [],
  skoolLeads: [],
  messageLog: [],
  commissionRates: {},
  closerProfiles: {},
  workspaces: [Object.assign({}, DEFAULT_WORKSPACE)],
  workspaceUsers: [],
  whatsappConfig: {
    assistroApiUrl: '',
    assistroApiKey: '',
    bookedCallGroupId: '',
    bookedCallEnabled: true,
    closedDealGroupId: '',
    closedDealEnabled: true,
    eodReportGroupId: '',
    eodReportEnabled: true,
    afterCallGroupId: '',
    afterCallEnabled: true,
  },
};

// ============================================
// DATABASE INIT — call from every API route
// ============================================

var dbLoaded = false;
var dbLoading = null;

export async function initStore() {
  if (dbLoaded) return;
  // Dedupe concurrent first-load attempts so we don't run N parallel DB loads.
  if (dbLoading) return dbLoading;

  dbLoading = (async function() {
    try {
      var dbReady = await initDatabase();
      if (!dbReady) {
        if (!process.env.DATABASE_URL) {
          // No database configured at all — genuine memory-only mode. Don't retry.
          console.error('============================================================');
          console.error('WARNING: DATABASE_URL NOT SET — RUNNING IN MEMORY-ONLY MODE');
          console.error('ALL DATA WILL BE LOST ON RESTART/REDEPLOY!');
          console.error('Fix: Railway Dashboard → CRM Service → Variables → Add Reference → PostgreSQL DATABASE_URL');
          console.error('============================================================');
          dbLoaded = true;
        } else {
          // DATABASE_URL is set but the DB was not reachable (cold start / transient).
          // Leave dbLoaded false so the NEXT request retries — never serve an empty
          // store permanently when the data is actually in Postgres.
          console.error('[Store] DB configured but not ready yet — will retry on next request');
        }
        return;
      }

      var data = await loadFromDatabase();
      if (data) {
        store.bookedCalls = data.bookedCalls || [];
        store.closedDeals = data.closedDeals || [];
        store.eodReports = data.eodReports || [];
        store.afterCallReports = data.afterCallReports || [];
        store.skoolLeads = data.skoolLeads || [];
        store.messageLog = data.messageLog || [];
        store.closerProfiles = data.closerProfiles || {};
        store.commissionRates = data.commissionRates || {};
        console.log('[Store] Loaded from DB:',
          store.bookedCalls.length, 'booked,',
          store.closedDeals.length, 'deals,',
          store.eodReports.length, 'EODs,',
          Object.keys(store.closerProfiles).length, 'closers'
        );
        canonicalizeRepNames();
        recalcOverview(); // after canonicalization, so the totals group on one spelling
        dbLoaded = true; // only mark loaded once the load actually succeeds
      } else {
        // loadFromDatabase returned null (query failed / connection blip).
        // Do NOT set dbLoaded — retry on the next request.
        console.error('[Store] DB load returned no data — will retry on next request');
      }

      try {
        var savedWa = await loadAppConfig('whatsapp');
        if (savedWa) {
          Object.keys(savedWa).forEach(function(k) { store.whatsappConfig[k] = savedWa[k]; });
          console.log('[Store] WhatsApp config restored from DB — api:', !!savedWa.assistroApiUrl,
            'booked:', !!savedWa.bookedCallGroupId, 'deal:', !!savedWa.closedDealGroupId, 'eod:', !!savedWa.eodReportGroupId);
        }
      } catch (e) { console.error('[Store] WA config load:', e.message); }

      try {
        var ws = await loadWorkspaces();
        if (ws && ws.length > 0) {
          var hasDefault = ws.some(function(w) { return w.id === 'default'; });
          store.workspaces = hasDefault ? ws : [Object.assign({}, DEFAULT_WORKSPACE)].concat(ws);
          console.log('[Store] Loaded', store.workspaces.length, 'workspaces');
        }
      } catch (e) { console.error('[Store] Workspace load:', e.message); }
    } catch (e) {
      console.error('[Store] Init error:', e.message);
      // leave dbLoaded false so the next request retries
    } finally {
      dbLoading = null;
    }
  })();

  return dbLoading;
}

export function getStore() {
  return store;
}

// ============================================
// WORKSPACE SCOPING
// ============================================

export var ALL_WORKSPACES = '__all__';

// Records written before a workspace was ever selected carry no stamp; they belong
// to the original 'default' workspace.
function recordWorkspace(r) {
  return (r && r.workspaceId) || 'default';
}

// Narrow a record list to one workspace, or to a set of them (for a person who
// belongs to several). Falsy / ALL_WORKSPACES means no filtering.
function scoped(list, workspaceId) {
  if (!workspaceId || workspaceId === ALL_WORKSPACES) return list;
  if (Array.isArray(workspaceId)) {
    if (workspaceId.length === 0) return [];
    return list.filter(function(r) { return workspaceId.indexOf(recordWorkspace(r)) !== -1; });
  }
  return list.filter(function(r) { return recordWorkspace(r) === workspaceId; });
}

// The workspace a new record should be stamped with. "All workspaces" is a viewing
// mode, not a destination, so writes made from it fall back to 'default'.
export function resolveWriteWorkspace(id) {
  if (!id || id === ALL_WORKSPACES) return 'default';
  return id;
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
    setter: canonicalRep(data.setter),
    closer: canonicalRep(data.closer),
    outboundInbound: data.outboundInbound || 'inbound',
    leadsEmail: data.leadsEmail || '',
    creditScore: data.creditScore || '',
    intentScore: data.intentScore || '',
    goal: data.goal || '',
    pain: data.pain || '',
    closerEmail: data.closerEmail || '',
    // Which form produced this record: 'crm' for the in-app form, 'n8n' for the
    // hosted forms. Lets the message log and any audit tie a row back to its origin.
    formSource: data.formSource || 'crm',
    extra: data.extra || {},
    workspaceId: resolveWriteWorkspace(data.workspaceId),
    submittedAt: new Date().toISOString(),
  };
  canonicalizeInto(entry, data, ['setter', 'closer']);
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
    leadsName: data.leadsName || '',
    leadsPhone: data.leadsPhone || '',
    leadsEmail: data.leadsEmail || '',
    program: data.program || '',
    paymentDetails: data.paymentDetails || '',
    paymentProcessor: data.paymentProcessor || '',
    paymentAgreement: data.paymentAgreement || '',
    cashCollected: parseFloat(data.cashCollected) || 0,
    setter: canonicalRep(data.setter),
    closer: canonicalRep(data.closer),
    closerEmail: data.closerEmail || '',
    commissionStatus: 'pending',
    outboundInbound: data.outboundInbound || '',
    notes: data.notes || '',
    formSource: data.formSource || 'crm',
    extra: data.extra || {},
    workspaceId: resolveWriteWorkspace(data.workspaceId),
    submittedAt: new Date().toISOString(),
  };
  canonicalizeInto(entry, data, ['setter', 'closer']);
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
    salesRep: canonicalRep(data.salesRep),
    date: data.date || todayInReportTimezone(),
    netNewCallsBooked: parseInt(data.netNewCallsBooked) || 0,
    callsOnCalendar: parseInt(data.callsOnCalendar) || 0,
    callsTaken: parseInt(data.callsTaken) || 0,
    callsNoShowed: parseInt(data.callsNoShowed) || 0,
    callsCanceled: parseInt(data.callsCanceled) || 0,
    callsRescheduled: parseInt(data.callsRescheduled) || 0,
    callsTakenAndPitched: parseInt(data.callsTakenAndPitched) || 0,
    closes: parseInt(data.closes) || 0,
    outboundDials: parseInt(data.outboundDials) || 0,
    // Setter branch of the EOD form. A closer's report leaves these at zero, and
    // `role` decides which set of tiles the EOD Logs page renders.
    position: data.position || '',
    role: data.role || '',
    conversations: parseInt(data.conversations) || 0,
    liveCalls: parseInt(data.liveCalls) || 0,
    talkTime: data.talkTime || '',
    sets: parseInt(data.sets) || 0,
    followUpsScheduled: parseInt(data.followUpsScheduled) || 0,
    selfRating: data.selfRating || '',
    cashCollectedMYFM: parseFloat(data.cashCollectedMYFM) || 0,
    cashCollectedI2I: parseFloat(data.cashCollectedI2I) || 0,
    revenueOnDay: parseFloat(data.revenueOnDay) || 0,
    improvementPlan: data.improvementPlan || '',
    leadsCalled: data.leadsCalled || '',
    callOutcomes: data.callOutcomes || '',
    closerName: canonicalRep(data.closerName),
    closerEmail: data.closerEmail || '',
    formSource: data.formSource || 'crm',
    extra: data.extra || {},
    workspaceId: resolveWriteWorkspace(data.workspaceId),
    submittedAt: new Date().toISOString(),
    status: 'submitted',
  };
  canonicalizeInto(entry, data, ['salesRep', 'closerName']);
  store.eodReports.unshift(entry);
  if (store.eodReports.length > 500) store.eodReports = store.eodReports.slice(0, 500);
  saveEODReport(entry).catch(function(e) { console.error('[DB] Save EOD error:', e.message); });
  recalcOverview();
  return entry;
}

// ============================================
// OFFER CLASSIFICATION (shared by dashboard + owner rollup)
// ============================================

var OFFER_META = {
  'myfm':             { label: 'MYFM',            subtitle: 'Coaching', color: '#fafafa' },
  'i2i-skool':        { label: 'Skool Sales',     subtitle: 'I2I',      color: '#d4d4d4' },
  'i2i-funding':      { label: 'Funding Program', subtitle: 'I2I',      color: '#a3a3a3' },
  'i2i-digital':      { label: 'Digital Program', subtitle: 'I2I',      color: '#8a8a8a' },
  'i2i-inner-circle': { label: 'Inner Circle',    subtitle: 'I2I',      color: '#6b6b6b' },
  'partner':          { label: 'Partner',         subtitle: 'External', color: '#525252' },
  'other':            { label: 'Other',           subtitle: '',         color: '#fafafa' },
};

export function classifyOffer(program) {
  var p = (program || '').toLowerCase().trim();

  // New program names
  if (p.startsWith('myfm')) return 'myfm';
  if (p.startsWith('i2i - skool')) return 'i2i-skool';
  if (p.startsWith('i2i - funding')) return 'i2i-funding';
  if (p.startsWith('i2i - digital')) return 'i2i-digital';
  if (p.startsWith('i2i - inner')) return 'i2i-inner-circle';
  if (p.startsWith('i2i')) return 'i2i-digital'; // catch-all I2I
  if (p.startsWith('partner')) return 'partner';

  // Legacy names
  if (p === 'saas' || p === 'fund2grow' || p === 'saas (fund2grow)') return 'myfm';
  if (p === 'coaching digital offer' || p === 'coaching' || p === 'coaching (digital programs)' || p === 'digital programs') return 'i2i-digital';
  if (p === 'coaching funding offer') return 'i2i-funding';
  if (p === 'dfy funding' || p === 'dfy-funding' || p === 'funding') return 'i2i-funding';
  if (p === 'inner circle' || p === 'inner circle mentorship' || p === 'dfy funding (inner circle)') return 'i2i-inner-circle';
  return 'other';
}

// Partner deals name the partner in the program string; keep them separable.
export function offerDisplayName(key, program) {
  if (key === 'partner') {
    var m = (program || '').split(' - ');
    if (m.length > 1 && m[1].trim()) return 'Partner — ' + m[1].trim();
  }
  return OFFER_META[key] ? OFFER_META[key].label : key;
}

// ============================================
// COMPUTED OVERVIEW
// ============================================

var overview = null;

function recalcOverview() {
  var today = todayInReportTimezone();
  overview = computeOverviewForRange(today, today);
}

function computeOverviewForRange(startDate, endDate, workspaceId) {
  var today = todayInReportTimezone();
  var start = startDate || today;
  var end = endDate || today;

  var rangeEODs = scoped(store.eodReports, workspaceId).filter(function(e) {
    var d = recordDay(e);
    return d >= start && d <= end;
  });

  var rangeDeals = scoped(store.closedDeals, workspaceId).filter(function(d) {
    var dt = toReportDay(d.submittedAt);
    return dt >= start && dt <= end;
  });

  var rangeBooked = scoped(store.bookedCalls, workspaceId).filter(function(b) {
    var dt = toReportDay(b.submittedAt);
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

  // Canonical cash: highest of the three sources (EOD MYFM+I2I, closed deals, EOD revenueOnDay)
  var totalCash = Math.max(dealCashTotal, eodCashTotal, eodRevenue);
  var totalRevenue = totalCash;

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

  // PER-OFFER BREAKDOWN
  var offerBreakdown = {
    'myfm':             { key: 'myfm',             label: 'MYFM',            subtitle: 'Coaching', booked: 0, closes: 0, revenue: 0, color: '#fafafa' },
    'i2i-skool':        { key: 'i2i-skool',        label: 'Skool Sales',     subtitle: 'I2I',      booked: 0, closes: 0, revenue: 0, color: '#d4d4d4' },
    'i2i-funding':      { key: 'i2i-funding',      label: 'Funding Program', subtitle: 'I2I',      booked: 0, closes: 0, revenue: 0, color: '#a3a3a3' },
    'i2i-digital':      { key: 'i2i-digital',      label: 'Digital Program', subtitle: 'I2I',      booked: 0, closes: 0, revenue: 0, color: '#8a8a8a' },
    'i2i-inner-circle': { key: 'i2i-inner-circle', label: 'Inner Circle',    subtitle: 'I2I',      booked: 0, closes: 0, revenue: 0, color: '#6b6b6b' },
    'partner':          { key: 'partner',          label: 'Partner',         subtitle: 'External', booked: 0, closes: 0, revenue: 0, color: '#525252' },
    'other':            { key: 'other',            label: 'Other',           subtitle: '',         booked: 0, closes: 0, revenue: 0, color: '#fafafa' },
  };

  rangeBooked.forEach(function(b) {
    offerBreakdown[classifyOffer(b.program)].booked++;
  });

  rangeDeals.forEach(function(d) {
    var key = classifyOffer(d.program);
    var cash = parseFloat(d.cashCollected) || parseFloat(d.dealValue) || 0;
    offerBreakdown[key].closes++;
    offerBreakdown[key].revenue += cash;
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
  var today = todayInReportTimezone();
  var start = startDate || today;
  var end = endDate || today;
  var closerMap = {};

  function dayCash(c, date) {
    if (!c.days[date]) c.days[date] = { dealCash: 0, eodCash: 0 };
    return c.days[date];
  }

  scoped(store.eodReports, workspaceId).filter(function(e) {
    var d = recordDay(e);
    return d >= start && d <= end;
  }).forEach(function(eod) {
    var name = eod.salesRep || eod.closerName;
    if (!name) return;
    if (!closerMap[name]) {
      closerMap[name] = { name: name, dials: 0, connects: 0, callsBooked: 0, callsTaken: 0, pitched: 0, closes: 0, cash: 0, cashMYFM: 0, cashI2I: 0, revenue: 0, noShows: 0, confidence: 0, eodCount: 0, days: {} };
    }
    var c = closerMap[name];
    c.dials += (parseInt(eod.outboundDials) || parseInt(eod.totalDials) || 0);
    c.callsTaken += (parseInt(eod.callsTaken) || parseInt(eod.connects) || 0);
    c.pitched += (parseInt(eod.callsTakenAndPitched) || 0);
    c.callsBooked += (parseInt(eod.netNewCallsBooked) || parseInt(eod.callsBooked) || 0);
    c.closes += (parseInt(eod.closes) || 0);
    c.cashMYFM += (parseFloat(eod.cashCollectedMYFM) || 0);
    c.cashI2I += (parseFloat(eod.cashCollectedI2I) || 0);
    // Cash is settled per day at the end, taking the larger of the two sources.
    // Adding both here counted the same money twice for anyone who logged a deal
    // and then reported that same cash in their EOD.
    dayCash(c, recordDay(eod)).eodCash += (parseFloat(eod.cashCollectedMYFM) || 0) + (parseFloat(eod.cashCollectedI2I) || 0);
    c.revenue += (parseFloat(eod.revenueOnDay) || 0);
    c.noShows += (parseInt(eod.callsNoShowed) || 0);
    c.eodCount++;
    if (eod.confidenceScore) c.confidence = parseInt(eod.confidenceScore) || 0;
  });

  scoped(store.closedDeals, workspaceId).filter(function(d) {
    var dt = toReportDay(d.submittedAt);
    return dt >= start && dt <= end;
  }).forEach(function(deal) {
    var name = deal.closer || deal.closerName;
    if (!name) return;
    if (!closerMap[name]) {
      closerMap[name] = { name: name, dials: 0, connects: 0, callsBooked: 0, callsTaken: 0, pitched: 0, closes: 0, cash: 0, cashMYFM: 0, cashI2I: 0, revenue: 0, noShows: 0, confidence: 0, eodCount: 0, days: {} };
    }
    dayCash(closerMap[name], toReportDay(deal.submittedAt)).dealCash += (parseFloat(deal.cashCollected) || parseFloat(deal.dealValue) || 0);
  });

  var closers = Object.values(closerMap);
  closers.forEach(function(c) {
    c.cash = 0;
    Object.keys(c.days).forEach(function(d) {
      c.cash += Math.max(c.days[d].dealCash, c.days[d].eodCash);
    });
    c.cash = Math.round(c.cash * 100) / 100;
    delete c.days;
  });

  return closers.sort(function(a, b) { return b.cash - a.cash; });
}

// ============================================
// LEADERBOARD — per-rep cash collected + revenue
// ============================================
//
// Reps report the same money twice: once per deal on the Close a Deal form
// (cashCollected) and once in the daily EOD (cashCollectedMYFM + cashCollectedI2I).
// Summing both would double-count, so cash is settled DAY BY DAY, taking the
// larger of the two sources for each rep-day. That keeps a day where someone
// logged deals but skipped their EOD (and vice versa) fully counted, while a day
// reported through both channels is only counted once — the same
// highest-source-wins rule computeOverviewForRange() uses for the team totals.
//
// Revenue is the EOD "Revenue on Day" field. When a rep leaves it blank it falls
// back to that day's cash, so revenue is never reported below cash collected.
//
// start/end are inclusive 'YYYY-MM-DD' strings; pass null for all time.

// ============================================
// REP NAME CANONICALIZATION
// ============================================
//
// Every record references a person by free-text name, and those names drifted:
// "Adeel"/"ADEEL", "Jarissa Bonifario"/"Bonifacio", "Issacar"/"Issacar JeanSimon",
// "ERNEST"/"ENREST", "Shorty Taylor"/"Anthony Taylor". Each variant became its own
// leaderboard row and its own commission row, and — worse — it reopened the
// per-rep-per-day cash dedupe through a different door: a deal filed as "Adeel" and
// the EOD reporting it as "ADEEL" are two different people to the rollups, so the
// same money counts twice again.
//
// Every canonical name below appears in the production data; none is invented. Add a
// line when a name is entered a new way; nothing else needs to change.
var REP_ALIASES = {
  'adeel': 'Adeel Fultang',
  'adeel fultang': 'Adeel Fultang',
  'anthony taylor': 'Anthony Taylor',
  'shorty': 'Anthony Taylor',
  'shorty taylor': 'Anthony Taylor',
  'cayden': 'Cayden Fleming',
  'cayden fleming': 'Cayden Fleming',
  'ernest': 'Ernest Simon',
  'enrest': 'Ernest Simon',            // transposition typo, 1 booked call
  'ernest simon': 'Ernest Simon',
  'issacar': 'Issacar JeanSimon',
  'issacar jeansimon': 'Issacar JeanSimon',
  'jarissa': 'Jarissa Bonifario',
  'jarissa bonifario': 'Jarissa Bonifario',
  'jarissa bonifacio': 'Jarissa Bonifario',  // misspelling, 2 deals
  'victor': 'Victor Ikharia',
  'victor ikharia': 'Victor Ikharia',
  'kadynce kratka': 'Kadynce Kratka',
  'rayan aljurhanni': 'Rayan Aljurhanni',
  'jake reilly': 'Jake Reilly',              // departed; history retained
  'ayah al-jurhanni': 'Ayah Al-Jurhanni',    // departed; history retained
};

export function canonicalRep(name) {
  var raw = String(name || '').trim().replace(/\s+/g, ' ');
  if (!raw) return '';
  return REP_ALIASES[raw.toLowerCase()] || raw;
}

// Canonicalize a set of name fields on a record being written, recording what was
// actually typed whenever it differs. Nothing a rep entered is ever discarded — if an
// alias turns out to be wrong, the original spelling is still on the record.
function canonicalizeInto(entry, data, fields) {
  fields.forEach(function(f) {
    var raw = data[f];
    var canonical = canonicalRep(raw);
    entry[f] = canonical;
    if (raw && canonical !== String(raw).trim()) {
      if (!entry.nameAsEntered) entry.nameAsEntered = {};
      entry.nameAsEntered[f] = raw;
    }
  });
  return entry;
}

// Rewrite the stored name so the dashboard, leaderboard and commissions all group on
// one spelling. Runs once after the DB load. What the rep actually typed is kept on
// the record as nameAsEntered — the point is to merge the history, not to erase how
// it was filed, and an alias entered in error stays recoverable.
export function canonicalizeRepNames() {
  var changed = 0;

  function touch(rows, fields, save) {
    (rows || []).forEach(function(r) {
      if (!r) return;
      var dirty = false;
      fields.forEach(function(f) {
        if (!r[f]) return;
        var c = canonicalRep(r[f]);
        if (c && c !== r[f]) {
          if (!r.nameAsEntered) r.nameAsEntered = {};
          if (r.nameAsEntered[f] === undefined) r.nameAsEntered[f] = r[f];
          r[f] = c;
          dirty = true;
        }
      });
      if (dirty) {
        changed++;
        if (save) save(r).catch(function(e) { console.error('[Store] canonicalize save:', e.message); });
      }
    });
  }

  touch(store.closedDeals, ['closer', 'closerName', 'setter'], saveClosedDeal);
  touch(store.eodReports, ['salesRep', 'closerName'], saveEODReport);
  touch(store.bookedCalls, ['setter', 'closer'], saveBookedCall);
  touch(store.afterCallReports, ['closer'], saveAfterCallReport);

  Object.keys(store.closerProfiles || {}).forEach(function(k) {
    var profile = store.closerProfiles[k];
    if (!profile || !profile.name) return;
    var c = canonicalRep(profile.name);
    if (c && c !== profile.name) {
      if (!profile.nameAsEntered) profile.nameAsEntered = profile.name;
      profile.name = c;
      changed++;
      saveCloserProfile(k, profile).catch(function(e) { console.error('[Store] canonicalize profile:', e.message); });
    }
  });

  if (changed) console.log('[Store] Canonicalized rep names on ' + changed + ' record(s)');
  return changed;
}

function repKey(name) {
  return canonicalRep(name).toLowerCase().trim().replace(/\s+/g, ' ');
}

function emptyRep(name) {
  return {
    name: name,
    email: '',
    cash: 0,
    revenue: 0,
    dealCash: 0,
    eodCash: 0,
    cashMYFM: 0,
    cashI2I: 0,
    reportedRevenue: 0,
    closes: 0,
    deals: 0,
    dials: 0,
    callsBooked: 0,
    callsTaken: 0,
    pitched: 0,
    noShows: 0,
    eodCount: 0,
    daysActive: 0,
    closeRate: 0,
    cashPerDial: 0,
    avgDealSize: 0,
    lastActivity: null,
    days: {},
  };
}

function repDay(rep, date) {
  if (!rep.days[date]) rep.days[date] = { dealCash: 0, eodCash: 0, eodRevenue: 0 };
  return rep.days[date];
}

function inRange(date, start, end) {
  if (!date) return false;
  if (start && date < start) return false;
  if (end && date > end) return false;
  return true;
}

function touchActivity(rep, iso) {
  if (!iso) return;
  if (!rep.lastActivity || iso > rep.lastActivity) rep.lastActivity = iso;
}

export function getLeaderboard(startDate, endDate, workspaceId) {
  var start = startDate || null;
  var end = endDate || null;
  var reps = {};

  function repFor(name) {
    var key = repKey(name);
    if (!key) return null;
    if (!reps[key]) reps[key] = emptyRep((name || '').trim());
    // Keep the most complete spelling we have seen for the display name.
    var seen = (name || '').trim();
    if (seen.length > reps[key].name.length) reps[key].name = seen;
    return reps[key];
  }

  scoped(store.eodReports, workspaceId).forEach(function(eod) {
    var date = recordDay(eod);
    if (!inRange(date, start, end)) return;
    var rep = repFor(eod.salesRep || eod.closerName);
    if (!rep) return;

    var myfm = parseFloat(eod.cashCollectedMYFM) || 0;
    var i2i = parseFloat(eod.cashCollectedI2I) || 0;
    var dayCash = myfm + i2i;
    var dayRevenue = parseFloat(eod.revenueOnDay) || 0;

    var day = repDay(rep, date);
    day.eodCash += dayCash;
    day.eodRevenue += dayRevenue;

    rep.cashMYFM += myfm;
    rep.cashI2I += i2i;
    rep.eodCash += dayCash;
    rep.reportedRevenue += dayRevenue;
    rep.closes += parseInt(eod.closes) || 0;
    rep.dials += parseInt(eod.outboundDials) || parseInt(eod.totalDials) || 0;
    rep.callsBooked += parseInt(eod.netNewCallsBooked) || parseInt(eod.callsBooked) || 0;
    rep.callsTaken += parseInt(eod.callsTaken) || parseInt(eod.connects) || 0;
    rep.pitched += parseInt(eod.callsTakenAndPitched) || 0;
    rep.noShows += parseInt(eod.callsNoShowed) || 0;
    rep.eodCount++;
    if (!rep.email && eod.closerEmail) rep.email = String(eod.closerEmail).toLowerCase().trim();
    touchActivity(rep, eod.submittedAt);
  });

  scoped(store.closedDeals, workspaceId).forEach(function(deal) {
    var date = toReportDay(deal.submittedAt);
    if (!inRange(date, start, end)) return;
    var rep = repFor(deal.closer || deal.closerName);
    if (!rep) return;

    var cash = parseFloat(deal.cashCollected) || parseFloat(deal.dealValue) || 0;
    repDay(rep, date).dealCash += cash;
    rep.dealCash += cash;
    rep.deals++;
    if (!rep.email && deal.closerEmail) rep.email = String(deal.closerEmail).toLowerCase().trim();
    touchActivity(rep, deal.submittedAt);
  });

  var profiles = store.closerProfiles || {};
  var profileByName = {};
  Object.keys(profiles).forEach(function(k) {
    var p = profiles[k];
    if (p && p.name) profileByName[repKey(p.name)] = p;
  });

  var rows = Object.keys(reps).map(function(key) {
    var rep = reps[key];

    Object.keys(rep.days).forEach(function(date) {
      var day = rep.days[date];
      var dayCash = Math.max(day.dealCash, day.eodCash);
      rep.cash += dayCash;
      rep.revenue += Math.max(day.eodRevenue, dayCash);
    });
    rep.daysActive = Object.keys(rep.days).length;
    delete rep.days;

    // A rep who logged deals but reported no closes in an EOD still closed them.
    rep.closes = Math.max(rep.closes, rep.deals);

    if (!rep.email && profileByName[key]) rep.email = profileByName[key].email || '';

    rep.cash = Math.round(rep.cash * 100) / 100;
    rep.revenue = Math.round(rep.revenue * 100) / 100;
    rep.dealCash = Math.round(rep.dealCash * 100) / 100;
    rep.eodCash = Math.round(rep.eodCash * 100) / 100;
    rep.cashMYFM = Math.round(rep.cashMYFM * 100) / 100;
    rep.cashI2I = Math.round(rep.cashI2I * 100) / 100;
    rep.reportedRevenue = Math.round(rep.reportedRevenue * 100) / 100;
    rep.closeRate = rep.pitched > 0 ? Math.round((rep.closes / rep.pitched) * 1000) / 10 : 0;
    rep.cashPerDial = rep.dials > 0 ? Math.round((rep.cash / rep.dials) * 100) / 100 : 0;
    rep.avgDealSize = rep.closes > 0 ? Math.round(rep.cash / rep.closes) : 0;
    return rep;
  });

  // Rank by cash collected, then revenue, then closes — a tie on money is broken
  // by the rep who worked more deals to get there.
  rows.sort(function(a, b) {
    return (b.cash - a.cash) || (b.revenue - a.revenue) || (b.closes - a.closes);
  });
  rows.forEach(function(rep, i) { rep.rank = i + 1; });

  return rows;
}

export function getLeaderboardTotals(rows) {
  var totals = { cash: 0, revenue: 0, closes: 0, deals: 0, dials: 0, callsTaken: 0, pitched: 0, eodCount: 0, reps: rows.length };
  rows.forEach(function(r) {
    totals.cash += r.cash;
    totals.revenue += r.revenue;
    totals.closes += r.closes;
    totals.deals += r.deals;
    totals.dials += r.dials;
    totals.callsTaken += r.callsTaken;
    totals.pitched += r.pitched;
    totals.eodCount += r.eodCount;
  });
  totals.cash = Math.round(totals.cash * 100) / 100;
  totals.revenue = Math.round(totals.revenue * 100) / 100;
  totals.closeRate = totals.pitched > 0 ? Math.round((totals.closes / totals.pitched) * 1000) / 10 : 0;
  return totals;
}

// ============================================
// PARTNER SALES LEADERBOARD
// ============================================
//
// Partner deals are stamped on the Close a Deal form as "Partner - <Brand>", so
// unlike the main board this one is deal-derived only — an EOD records the day's
// cash but never which brand it came from.
//
// These deals are ALSO part of the main standings, where cash is the rep's total
// take for the day. This board is a lens on that same money, not a slice carved
// out of it, so the two boards deliberately do not sum to a grand total.

export function getPartnerLeaderboard(startDate, endDate, workspaceId) {
  var start = startDate || null;
  var end = endDate || null;
  var reps = {};
  var partners = {};

  scoped(store.closedDeals, workspaceId).forEach(function(deal) {
    if (classifyOffer(deal.program) !== 'partner') return;
    var date = toReportDay(deal.submittedAt);
    if (!inRange(date, start, end)) return;

    var name = (deal.closer || deal.closerName || '').trim();
    var key = repKey(name);
    if (!key) return;

    var cash = parseFloat(deal.cashCollected) || parseFloat(deal.dealValue) || 0;
    var brand = offerDisplayName('partner', deal.program).replace(/^Partner — /, '');
    if (brand === 'Partner') brand = 'Unspecified';

    if (!reps[key]) {
      reps[key] = { name: name, email: '', cash: 0, deals: 0, avgDealSize: 0, brands: {}, topBrand: '', lastActivity: null };
    }
    var rep = reps[key];
    if (name.length > rep.name.length) rep.name = name;
    rep.cash += cash;
    rep.deals++;
    rep.brands[brand] = (rep.brands[brand] || 0) + cash;
    if (!rep.email && deal.closerEmail) rep.email = String(deal.closerEmail).toLowerCase().trim();
    touchActivity(rep, deal.submittedAt);

    if (!partners[brand]) partners[brand] = { name: brand, cash: 0, deals: 0, reps: {} };
    partners[brand].cash += cash;
    partners[brand].deals++;
    partners[brand].reps[key] = true;
  });

  var rows = Object.keys(reps).map(function(key) {
    var rep = reps[key];
    rep.cash = Math.round(rep.cash * 100) / 100;
    rep.avgDealSize = rep.deals > 0 ? Math.round(rep.cash / rep.deals) : 0;
    // Which brand this rep sells most of, so the row can say more than a number.
    var brandNames = Object.keys(rep.brands);
    rep.topBrand = brandNames.sort(function(a, b) { return rep.brands[b] - rep.brands[a]; })[0] || '';
    rep.brandCount = brandNames.length;
    rep.brands = brandNames.map(function(b) {
      return { name: b, cash: Math.round(rep.brands[b] * 100) / 100 };
    }).sort(function(a, b) { return b.cash - a.cash; });
    return rep;
  });

  rows.sort(function(a, b) { return (b.cash - a.cash) || (b.deals - a.deals); });
  rows.forEach(function(rep, i) { rep.rank = i + 1; });

  var brandRows = Object.keys(partners).map(function(b) {
    var p = partners[b];
    return {
      name: p.name,
      cash: Math.round(p.cash * 100) / 100,
      deals: p.deals,
      reps: Object.keys(p.reps).length,
      avgDealSize: p.deals > 0 ? Math.round(p.cash / p.deals) : 0,
    };
  }).sort(function(a, b) { return b.cash - a.cash; });

  var totalCash = rows.reduce(function(s, r) { return s + r.cash; }, 0);
  var totalDeals = rows.reduce(function(s, r) { return s + r.deals; }, 0);

  return {
    reps: rows,
    partners: brandRows,
    totals: {
      cash: Math.round(totalCash * 100) / 100,
      deals: totalDeals,
      reps: rows.length,
      partners: brandRows.length,
      avgDealSize: totalDeals > 0 ? Math.round(totalCash / totalDeals) : 0,
    },
  };
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
  var date = dateStr || todayInReportTimezone();

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
  var date = dateStr || todayInReportTimezone();
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

// Commission rates are stored per closer email, but deals reference the closer by
// name. Resolve by the stored display name, defaulting to 10%.
export function getCloserCommissionRate(closerName) {
  if (!closerName) return 0.10;
  var keys = Object.keys(store.commissionRates);
  for (var i = 0; i < keys.length; i++) {
    var entry = store.commissionRates[keys[i]];
    if (entry.name && entry.name.toLowerCase() === closerName.toLowerCase()) return entry.rate;
  }
  return 0.10;
}

export function getCommissionsForCloser(closerName, workspaceId) {
  if (!closerName) return { deals: [], summary: getEmptyCommissionSummary() };

  var closerDeals = scoped(store.closedDeals, workspaceId).filter(function(d) {
    return d.closer && d.closer.toLowerCase() === closerName.toLowerCase();
  });

  var rate = getCloserCommissionRate(closerName);

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

// ============================================
// OPERATOR ROLLUP — every offer across every workspace
// ============================================
//
// Revenue and commission come from closed deals, which carry the program and so
// are the only per-offer source. Cash collected is reported per company on EOD
// reports with no offer breakdown, so a workspace's EOD cash is apportioned across
// its offers by each offer's share of deal revenue. Cash that cannot be
// apportioned (cash reported with no deals in range) is surfaced as
// unattributedCash rather than dropped or misassigned.

export function getOperatorRollup(startDate, endDate) {
  var today = todayInReportTimezone();
  var start = startDate || today;
  var end = endDate || today;

  function inRange(dt) { return dt >= start && dt <= end; }

  var rangeDeals = store.closedDeals.filter(function(d) {
    return inRange(toReportDay(d.submittedAt));
  });
  var rangeBooked = store.bookedCalls.filter(function(b) {
    return inRange(toReportDay(b.submittedAt));
  });
  var rangeEODs = store.eodReports.filter(function(e) {
    return inRange(recordDay(e));
  });

  // Every known workspace, plus 'default' so pre-workspace data always has a home.
  var wsList = (store.workspaces || []).slice();
  if (!wsList.some(function(w) { return w.id === 'default'; })) {
    wsList.unshift({ id: 'default', name: 'Influence2Impact' });
  }

  var companies = {};
  wsList.forEach(function(w) {
    companies[w.id] = {
      workspaceId: w.id,
      name: w.name || w.id,
      revenue: 0, cashCollected: 0, unattributedCash: 0,
      commission: 0, deals: 0, booked: 0,
    };
  });

  function companyFor(id) {
    if (!companies[id]) {
      companies[id] = {
        workspaceId: id, name: id,
        revenue: 0, cashCollected: 0, unattributedCash: 0,
        commission: 0, deals: 0, booked: 0,
      };
    }
    return companies[id];
  }

  var offers = {};
  function offerFor(record) {
    var wsId = recordWorkspace(record);
    var key = classifyOffer(record.program);
    var name = offerDisplayName(key, record.program);
    var id = wsId + '::' + key + '::' + name;
    if (!offers[id]) {
      var co = companyFor(wsId);
      offers[id] = {
        key: id,
        offer: name,
        offerKey: key,
        color: (OFFER_META[key] || {}).color || '#a3a3a3',
        workspaceId: wsId,
        workspaceName: co.name,
        revenue: 0, cashCollected: 0, commission: 0, deals: 0, booked: 0,
      };
    }
    return offers[id];
  }

  rangeDeals.forEach(function(deal) {
    var value = parseFloat(deal.cashCollected) || parseFloat(deal.dealValue) || 0;
    var rate = getCloserCommissionRate(deal.closer || deal.closerName || '');
    var o = offerFor(deal);
    o.revenue += value;
    o.commission += value * rate;
    o.deals++;
    var co = companyFor(o.workspaceId);
    co.revenue += value;
    co.commission += value * rate;
    co.deals++;
  });

  rangeBooked.forEach(function(b) {
    var o = offerFor(b);
    o.booked++;
    companyFor(o.workspaceId).booked++;
  });

  // EOD cash lands on the company, then spreads across its offers by revenue share.
  rangeEODs.forEach(function(e) {
    var cash = (parseFloat(e.cashCollectedMYFM) || 0) + (parseFloat(e.cashCollectedI2I) || 0);
    if (!cash) cash = parseFloat(e.cashCollected) || 0;
    companyFor(recordWorkspace(e)).cashCollected += cash;
  });

  Object.keys(companies).forEach(function(wsId) {
    var co = companies[wsId];
    var own = Object.keys(offers).map(function(k) { return offers[k]; })
      .filter(function(o) { return o.workspaceId === wsId; });
    var totalRev = own.reduce(function(sum, o) { return sum + o.revenue; }, 0);
    if (totalRev > 0) {
      own.forEach(function(o) { o.cashCollected = co.cashCollected * (o.revenue / totalRev); });
    } else {
      co.unattributedCash = co.cashCollected;
    }
  });

  function round(n) { return Math.round(n * 100) / 100; }

  var offerList = Object.keys(offers).map(function(k) {
    var o = offers[k];
    o.revenue = round(o.revenue);
    o.cashCollected = round(o.cashCollected);
    o.commission = round(o.commission);
    return o;
  }).sort(function(a, b) { return b.revenue - a.revenue; });

  var companyList = Object.keys(companies).map(function(k) {
    var c = companies[k];
    return {
      workspaceId: c.workspaceId,
      name: c.name,
      revenue: round(c.revenue),
      cashCollected: round(c.cashCollected),
      unattributedCash: round(c.unattributedCash),
      commission: round(c.commission),
      deals: c.deals,
      booked: c.booked,
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
    },
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
    console.log('[Register] No email for closer:', name);
    return;
  }
  var key = email.toLowerCase().trim();
  var cleanName = canonicalRep(name) || (name || '').trim().split(' ').filter(Boolean).map(function(w) {
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  }).join(' ');
  if (store.closerProfiles[key]) {
    // Update existing profile login time and name if provided. An archived rep stays
    // archived — a late EOD from someone who has left should not put them back on the
    // roster; the operator restores them deliberately.
    store.closerProfiles[key].lastLogin = new Date().toISOString();
    if (cleanName && (!store.closerProfiles[key].name || store.closerProfiles[key].name === key)) {
      store.closerProfiles[key].name = cleanName;
    }
  } else {
    store.closerProfiles[key] = {
      name: cleanName || key,
      email: key,
      registeredAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
    };
  }
  if (!store.commissionRates[key]) {
    store.commissionRates[key] = {
      rate: 0.10,
      name: cleanName || key,
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

// Removing a rep from the roster is an archive, never a delete. Their deals, EODs
// and bookings are the company's record of money that was actually collected, so
// they stay exactly where they are and keep counting in every historical total.
// What changes is the roster: the rep stops appearing in the Closers list and stops
// being counted as "missed" on the EOD compliance tracker every day forever.
export function archiveCloser(email) {
  var key = (email || '').toLowerCase().trim();
  if (!key || !store.closerProfiles[key]) return { error: 'No closer with email ' + (email || '(blank)') };
  var profile = store.closerProfiles[key];
  if (profile.archived) return { error: profile.name + ' is already removed from the roster' };

  profile.archived = true;
  profile.archivedAt = new Date().toISOString();
  saveCloserProfile(key, profile).catch(function(e) { console.error('[DB] Archive closer error:', e.message); });
  console.log('[Store] Archived closer:', profile.name, '(' + key + ') — records kept');
  return { profile: profile };
}

export function restoreCloser(email) {
  var key = (email || '').toLowerCase().trim();
  if (!key || !store.closerProfiles[key]) return { error: 'No closer with email ' + (email || '(blank)') };
  var profile = store.closerProfiles[key];
  profile.archived = false;
  profile.archivedAt = null;
  saveCloserProfile(key, profile).catch(function(e) { console.error('[DB] Restore closer error:', e.message); });
  console.log('[Store] Restored closer:', profile.name, '(' + key + ')');
  return { profile: profile };
}

// ============================================
// WHATSAPP CONFIG — server-side, read by webhooks
// ============================================

// ============================================
// AFTER-CALL REPORT — what happened on the call
// ============================================

export function addAfterCallReport(data) {
  var entry = {
    id: 'call-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
    leadsName: data.leadsName || '',
    leadsPhone: data.leadsPhone || '',
    leadsEmail: data.leadsEmail || '',
    callNotes: data.callNotes || '',
    outcome: data.outcome || '',
    nextStep: data.nextStep || '',
    closer: canonicalRep(data.closer),
    closerEmail: data.closerEmail || '',
    formSource: data.formSource || 'n8n',
    extra: data.extra || {},
    workspaceId: resolveWriteWorkspace(data.workspaceId),
    submittedAt: new Date().toISOString(),
  };
  canonicalizeInto(entry, data, ['closer']);
  store.afterCallReports.unshift(entry);
  if (store.afterCallReports.length > 500) store.afterCallReports = store.afterCallReports.slice(0, 500);
  saveAfterCallReport(entry).catch(function(e) { console.error('[DB] Save after-call error:', e.message); });
  return entry;
}

export function getAfterCallReports(workspaceId) {
  return scoped(store.afterCallReports, workspaceId);
}

// ============================================
// SKOOL COMMUNITY PIPELINE
// ============================================
//
// One record per person a setter is working, in either the free or the paid Skool
// community. Money is kept in two columns rather than one, because "what has this
// setter collected" has two different answers worth telling apart: subscriptions
// from moving people into the paid group, and high-ticket cash from moving people
// onto a closer's calendar.

function skoolFields(data, existing) {
  var base = existing || {};
  var out = {
    name: data.name !== undefined ? String(data.name).trim() : (base.name || ''),
    handle: data.handle !== undefined ? String(data.handle).trim() : (base.handle || ''),
    email: data.email !== undefined ? String(data.email).trim().toLowerCase() : (base.email || ''),
    phone: data.phone !== undefined ? String(data.phone).trim() : (base.phone || ''),
    setter: data.setter !== undefined ? canonicalRep(data.setter) : (base.setter || ''),
    closer: data.closer !== undefined ? canonicalRep(data.closer) : (base.closer || ''),
    offer: data.offer !== undefined ? String(data.offer).trim() : (base.offer || ''),
    notes: data.notes !== undefined ? String(data.notes).trim() : (base.notes || ''),
    bookedFor: data.bookedFor !== undefined ? String(data.bookedFor).trim() : (base.bookedFor || ''),
    communityCash: data.communityCash !== undefined ? money(data.communityCash) : money(base.communityCash),
    highTicketCash: data.highTicketCash !== undefined ? money(data.highTicketCash) : money(base.highTicketCash),
  };

  var stage = data.stage !== undefined ? String(data.stage) : (base.stage || DEFAULT_STAGE);
  out.stage = isStage(stage) ? stage : DEFAULT_STAGE;

  var community = data.community !== undefined ? String(data.community) : (base.community || 'free');
  out.community = isCommunity(community) ? community : 'free';

  // Reaching the paid-community stage IS the upgrade: it moves them into the paid
  // section and stamps when it happened, so "people I moved up" stays countable
  // even after they go on to book a high-ticket call from inside the paid group.
  out.joinedPaidAt = base.joinedPaidAt || null;
  if (out.stage === 'paid-community' && !out.joinedPaidAt) {
    out.joinedPaidAt = new Date().toISOString();
  }
  if (out.joinedPaidAt) out.community = 'paid';

  return out;
}

export function addSkoolLead(data) {
  var entry = Object.assign({
    id: 'skool-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
  }, skoolFields(data || {}, null));

  entry.workspaceId = resolveWriteWorkspace(data && data.workspaceId);
  entry.createdAt = new Date().toISOString();
  entry.updatedAt = entry.createdAt;
  entry.stageHistory = [{ stage: entry.stage, at: entry.createdAt }];

  store.skoolLeads.unshift(entry);
  if (store.skoolLeads.length > 1000) store.skoolLeads = store.skoolLeads.slice(0, 1000);
  saveSkoolLead(entry).catch(function(e) { console.error('[DB] Save skool lead error:', e.message); });
  return entry;
}

export function updateSkoolLead(id, data) {
  var lead = null;
  for (var i = 0; i < store.skoolLeads.length; i++) {
    if (store.skoolLeads[i] && store.skoolLeads[i].id === id) { lead = store.skoolLeads[i]; break; }
  }
  if (!lead) return { error: 'No Skool lead with id ' + id };

  var previousStage = lead.stage;
  var previousCommunity = lead.community;
  var fields = skoolFields(data || {}, lead);

  // Moving someone from the free board into the paid one IS the upgrade, however it
  // was recorded — dragged across, or marked a paid member. Creating a lead straight
  // into the paid community is not: nobody moved them, that is where they started.
  if (previousCommunity === 'free' && fields.community === 'paid' && !fields.joinedPaidAt) {
    fields.joinedPaidAt = new Date().toISOString();
  }
  Object.keys(fields).forEach(function(k) { lead[k] = fields[k]; });
  lead.updatedAt = new Date().toISOString();

  // Keep the trail of how someone moved through the pipeline, not just where they
  // landed — it is the only way to see a stage was skipped or walked backwards.
  if (lead.stage !== previousStage) {
    if (!Array.isArray(lead.stageHistory)) lead.stageHistory = [];
    lead.stageHistory.push({ stage: lead.stage, at: lead.updatedAt, from: previousStage });
  }

  saveSkoolLead(lead).catch(function(e) { console.error('[DB] Update skool lead error:', e.message); });
  return { lead: lead };
}

export function getSkoolLeads(workspaceId) {
  return scoped(store.skoolLeads, workspaceId);
}

// ============================================
// INGEST ATTEMPTS — did n8n actually reach us?
// ============================================
//
// A rejected submission (wrong key, unknown form type, missing lead name) is only
// visible in the Railway logs, and n8n's continue-on-error hides it at the other
// end too — so a broken HTTP Request node looks exactly like "nobody filled the
// form in". This ring buffer makes the difference visible inside the CRM.
//
// In memory only, and deliberately: it is a live debugging aid, not a record. No
// key material is ever stored — only whether one was presented.

var ingestAttempts = [];

export function addIngestAttempt(data) {
  var entry = {
    at: new Date().toISOString(),
    type: data.type || '',
    requestedType: data.requestedType || '',
    status: data.status || '',          // accepted | rejected | error
    reason: data.reason || '',
    keyPresented: !!data.keyPresented,
    recordId: data.recordId || '',
    label: data.label || '',
    ip: data.ip || '',
  };
  ingestAttempts.unshift(entry);
  if (ingestAttempts.length > 50) ingestAttempts = ingestAttempts.slice(0, 50);
  return entry;
}

export function getIngestAttempts() {
  return ingestAttempts;
}

// ============================================
// DELETING A RECORD
// ============================================
//
// Soft delete: the record leaves memory immediately — so every rollup, leaderboard
// and dashboard figure is correct on the next read — while the Postgres row is kept
// with deleted_at stamped. A wrong delete on live sales data is recoverable.

var DELETE_TARGETS = {
  'book-call': { list: 'bookedCalls', table: 'booked_calls', label: 'booked call' },
  'close-deal': { list: 'closedDeals', table: 'closed_deals', label: 'closed deal' },
  'eod-report': { list: 'eodReports', table: 'eod_reports', label: 'EOD report' },
  'after-call': { list: 'afterCallReports', table: 'after_call_reports', label: 'after-call report' },
  'skool-lead': { list: 'skoolLeads', table: 'skool_leads', label: 'Skool lead' },
};

export async function deleteRecord(kind, id) {
  var target = DELETE_TARGETS[kind];
  if (!target) return { error: 'Unknown record type: ' + kind };

  var list = store[target.list] || [];
  var index = -1;
  for (var i = 0; i < list.length; i++) {
    if (list[i] && list[i].id === id) { index = i; break; }
  }
  if (index === -1) return { error: 'No ' + target.label + ' with id ' + id };

  var removed = list[index];
  list.splice(index, 1);

  try {
    await softDeleteRecord(target.table, id);
  } catch (e) {
    // Put it back rather than leaving memory and the database disagreeing — the
    // record would otherwise reappear on the next redeploy with no explanation.
    list.splice(index, 0, removed);
    console.error('[Store] Delete failed for', kind, id, '-', e.message);
    return { error: 'Database delete failed: ' + e.message };
  }

  recalcOverview();
  console.log('[Store] Soft-deleted', target.label, id);
  return { deleted: removed };
}

// ============================================
// OUTBOUND MESSAGE LOG
// ============================================
//
// Every WhatsApp notification the CRM attempts is recorded here — sent, failed or
// skipped — so "the form was filled in" and "the group was actually notified" are
// two separately verifiable facts rather than one assumption.

export function addMessageLog(data) {
  var entry = {
    id: 'msg-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
    kind: data.kind || 'other',            // book-call | close-deal | eod-report | scheduled | manual
    channel: data.channel || 'whatsapp',
    destination: data.destination || '',   // group id or phone
    message: data.message || '',
    status: data.status || 'unknown',      // sent | failed | skipped
    error: data.error || '',
    source: data.source || 'crm',          // crm | n8n | scheduler
    recordId: data.recordId || '',
    recordLabel: data.recordLabel || '',
    workspaceId: resolveWriteWorkspace(data.workspaceId),
    sentAt: new Date().toISOString(),
  };
  store.messageLog.unshift(entry);
  if (store.messageLog.length > 300) store.messageLog = store.messageLog.slice(0, 300);
  saveMessageLogEntry(entry).catch(function(e) { console.error('[DB] Save message log error:', e.message); });
  return entry;
}

export function getMessageLog(workspaceId) {
  return scoped(store.messageLog, workspaceId);
}

export function getWhatsappConfig() {
  return store.whatsappConfig;
}

export function setWhatsappConfig(config) {
  var wc = store.whatsappConfig;
  if (config.assistroApiUrl !== undefined) wc.assistroApiUrl = config.assistroApiUrl;
  if (config.assistroApiKey !== undefined) wc.assistroApiKey = config.assistroApiKey;
  if (config.bookedCallGroupId !== undefined) wc.bookedCallGroupId = config.bookedCallGroupId;
  if (config.bookedCallEnabled !== undefined) wc.bookedCallEnabled = config.bookedCallEnabled;
  if (config.closedDealGroupId !== undefined) wc.closedDealGroupId = config.closedDealGroupId;
  if (config.closedDealEnabled !== undefined) wc.closedDealEnabled = config.closedDealEnabled;
  if (config.eodReportGroupId !== undefined) wc.eodReportGroupId = config.eodReportGroupId;
  if (config.eodReportEnabled !== undefined) wc.eodReportEnabled = config.eodReportEnabled;
  if (config.afterCallGroupId !== undefined) wc.afterCallGroupId = config.afterCallGroupId;
  if (config.afterCallEnabled !== undefined) wc.afterCallEnabled = config.afterCallEnabled;
  // Also accept legacy whatsappGroupId — set all 3 groups if per-form ones are empty
  if (config.whatsappGroupId && !wc.bookedCallGroupId) wc.bookedCallGroupId = config.whatsappGroupId;
  if (config.whatsappGroupId && !wc.closedDealGroupId) wc.closedDealGroupId = config.whatsappGroupId;
  if (config.whatsappGroupId && !wc.eodReportGroupId) wc.eodReportGroupId = config.whatsappGroupId;
  // Persist so the settings survive a redeploy — previously this lived only in
  // memory, so every restart silently stopped WhatsApp until it was re-entered.
  saveAppConfig('whatsapp', wc).catch(function(e) { console.error('[DB] Save WA config error:', e.message); });
  console.log('[Store] WhatsApp config updated — apiUrl:', wc.assistroApiUrl ? 'SET' : 'empty', '| booked:', wc.bookedCallGroupId ? 'SET' : 'empty', '| deal:', wc.closedDealGroupId ? 'SET' : 'empty', '| eod:', wc.eodReportGroupId ? 'SET' : 'empty');
}

// ============================================
// MULTI-WORKSPACE
// ============================================

export function getWorkspaces() { return (store.workspaces || []).map(normalizeBranding); }

export function getWorkspace(id) {
  return store.workspaces.find(function(w) { return w.id === id; }) || null;
}

// Older workspaces were stored with coloured branding (red, purple). The UI is
// monochrome now, so normalize any stored brand colour to a neutral on read.
var NEUTRAL_BRAND = { primaryColor: '#a3a3a3', secondaryColor: '#525252' };

function normalizeBranding(ws) {
  if (!ws) return ws;
  ws.branding = Object.assign({}, ws.branding, NEUTRAL_BRAND);
  return ws;
}

export async function createWorkspace(data) {
  var id = 'ws-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
  var ws = {
    id: id,
    name: data.companyName || 'New Workspace',
    slug: (data.companyName || 'workspace').toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 30),
    ownerEmail: (data.ownerEmail || '').toLowerCase(),
    teamPassword: data.teamPassword || '',
    branding: {
      primaryColor: data.primaryColor || '#a3a3a3',
      secondaryColor: data.secondaryColor || '#22c55e',
      companyName: data.companyName || '',
    },
    onboarding: {
      companyName: data.companyName || '',
      industry: data.industry || '',
      teamSize: data.teamSize || '',
      funnels: data.funnels || [],
      monthlyAdSpend: data.monthlyAdSpend || '',
      avgDealSize: data.avgDealSize || '',
    },
    active: true,
    createdAt: new Date().toISOString(),
  };
  store.workspaces.push(ws);
  await saveWorkspace(ws).catch(function(e) { console.error('[DB]', e.message); });

  if (data.ownerEmail) {
    await addUserToWorkspace(id, data.ownerEmail, data.ownerName || '', 'owner');
  }
  return ws;
}

export async function updateWorkspace(id, updates) {
  var ws = getWorkspace(id);
  if (!ws) return null;
  Object.assign(ws, updates);
  ws.updatedAt = new Date().toISOString();
  await saveWorkspace(ws).catch(function(e) { console.error('[DB]', e.message); });
  return ws;
}

export async function addUserToWorkspace(workspaceId, email, name, role) {
  var key = email.toLowerCase();
  var user = {
    id: 'wu-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
    workspaceId: workspaceId,
    email: key,
    name: name || email,
    role: role || 'closer',
    joinedAt: new Date().toISOString(),
  };
  // One workspace per person: re-adding them moves them rather than duplicating.
  store.workspaceUsers = (store.workspaceUsers || []).filter(function(u) { return u.email !== key; });
  store.workspaceUsers.push(user);
  await saveWorkspaceUser(user).catch(function(e) { console.error('[DB]', e.message); });
  return user;
}

export async function getUserWorkspace(email) {
  var key = (email || '').toLowerCase();
  if (key === 'shorty21taylor@gmail.com') {
    return { workspaceId: 'default', role: 'super_admin' };
  }

  // In-memory first so membership resolves even without a database; the DB is the
  // durable copy and backfills memory on a cold start.
  var local = (store.workspaceUsers || []).filter(function(u) { return u.email === key; })[0];
  if (local) return { workspaceId: local.workspaceId, role: local.role, user: local };

  var fromDb = await findUserWorkspace(key);
  if (fromDb && fromDb.workspaceId) {
    store.workspaceUsers.push({
      id: 'wu-cache-' + key,
      workspaceId: fromDb.workspaceId,
      email: key,
      name: (fromDb.user && fromDb.user.name) || key,
      role: (fromDb.user && fromDb.user.role) || 'closer',
    });
  }
  return fromDb;
}

export async function getWorkspaceUserList(workspaceId) {
  var fromDb = await loadWorkspaceUsers(workspaceId).catch(function() { return null; });
  if (fromDb && fromDb.length) return fromDb;
  return (store.workspaceUsers || []).filter(function(u) { return u.workspaceId === workspaceId; });
}
