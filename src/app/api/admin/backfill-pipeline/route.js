import { NextResponse } from 'next/server';
import { initStore, getStore, addPipelineRecord, getPipelineRecords } from '@/lib/store';
import { resolveAccess, ALL_WORKSPACES } from '@/lib/access';
import { toReportDay } from '@/lib/report-date';

export var dynamic = 'force-dynamic';

// One-time catch-up: a pipeline card for every booking and every deal already on
// the books, so the boards do not open empty on a floor with a year of history.
//
// GET is a dry run and writes nothing. POST needs {"confirm":"backfill"}.
// It writes pipeline_records only. No booked call, closed deal or EOD report is
// modified, and none is read for anything but copying.
//
// Idempotent: a booking that already has a card is skipped, so running it twice
// produces the same board.

function key(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function bookedAppointment(call) {
  var day = String(call.bookedDay || '').trim();
  if (!day) return '';
  var attempts = [day + ' ' + String(call.bookedTime || '').trim(), day];
  for (var i = 0; i < attempts.length; i++) {
    var d = new Date(attempts[i]);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  return '';
}

async function plan(commit) {
  var store = getStore();
  var calls = store.bookedCalls || [];
  var deals = store.closedDeals || [];

  var before = {
    bookedCalls: calls.length,
    closedDeals: deals.length,
    eodReports: (store.eodReports || []).length,
    pipelineRecords: getPipelineRecords(ALL_WORKSPACES).length,
  };

  // What is already on the board, so a second run adds nothing.
  var existing = getPipelineRecords(ALL_WORKSPACES);
  var haveCall = {};
  var haveDeal = {};
  existing.forEach(function(r) {
    if (r.bookedCallId) haveCall[r.bookedCallId] = true;
    if (r.closedDealId) haveDeal[r.closedDealId] = true;
  });

  // Index the deals by workspace + prospect, so each booking can find the close
  // that came from it. A deal is claimed once: two bookings for the same person do
  // not both get to call themselves won.
  var dealIndex = {};
  deals.forEach(function(d) {
    var ws = d.workspaceId || 'default';
    [key(d.leadsName), key(d.leadsEmail)].forEach(function(k) {
      if (!k) return;
      var id = ws + '|' + k;
      dealIndex[id] = dealIndex[id] || [];
      dealIndex[id].push(d);
    });
  });
  var claimed = {};

  function findDeal(call) {
    var ws = call.workspaceId || 'default';
    var keys = [key(call.leadsName), key(call.leadsEmail)];
    for (var i = 0; i < keys.length; i++) {
      if (!keys[i]) continue;
      var list = dealIndex[ws + '|' + keys[i]] || [];
      for (var j = 0; j < list.length; j++) {
        if (!claimed[list[j].id]) return list[j];
      }
    }
    return null;
  }

  var byStage = {};
  var created = 0;
  var skipped = 0;
  var orphanDeals = 0;
  // Cash the backfill is about to put on the board. Counted as we plan rather than
  // read back afterwards, so the dry run can check the figure before writing it —
  // reading the board on a dry run would always report zero and cry wolf.
  var plannedWonCash = 0;

  function bump(stage) { byStage[stage] = (byStage[stage] || 0) + 1; }

  // 1. Every booking becomes a card.
  calls.forEach(function(call) {
    if (call.id && haveCall[call.id]) { skipped++; return; }

    var deal = findDeal(call);
    // The stage is only ever what we actually recorded. A booking with a matching
    // close is won; one without is `booked`. Nothing here infers a showed or a
    // no-show that nobody ever filed — an invented outcome on a rep's board is
    // worse than an honest gap.
    var stage = deal ? 'won' : 'booked';
    if (deal) claimed[deal.id] = true;

    bump(stage);
    created++;
    if (deal) plannedWonCash += parseFloat(deal.cashCollected) || 0;
    if (!commit) return;

    addPipelineRecord({
      workspaceId: call.workspaceId || 'default',
      prospectName: call.leadsName || '',
      prospectEmail: call.leadsEmail || '',
      prospectPhone: call.leadsPhone || '',
      leadSource: call.outboundInbound || '',
      stage: stage,
      appointmentAt: bookedAppointment(call),
      offer: (deal && deal.program) || call.program || '',
      cashCollected: deal ? deal.cashCollected : 0,
      dealTerms: deal ? (deal.paymentAgreement || deal.paymentDetails || '') : '',
      notes: call.notes || '',
      setter: call.setter || '',
      closer: (deal && deal.closer) || call.closer || '',
      closerEmail: (deal && deal.closerEmail) || call.closerEmail || '',
      bookedCallId: call.id || '',
      closedDealId: deal ? deal.id : '',
    }, { name: 'Backfill', type: 'system', note: 'backfilled from booked call' });
  });

  // 2. A deal with no booking behind it still has to be on the board, or the
  // month's cash on the board would not equal the month's cash on the dashboard.
  deals.forEach(function(deal) {
    if (claimed[deal.id]) return;
    if (deal.id && haveDeal[deal.id]) { skipped++; return; }

    orphanDeals++;
    bump('won');
    created++;
    plannedWonCash += parseFloat(deal.cashCollected) || 0;
    if (!commit) return;

    addPipelineRecord({
      workspaceId: deal.workspaceId || 'default',
      prospectName: deal.leadsName || '',
      prospectEmail: deal.leadsEmail || '',
      prospectPhone: deal.leadsPhone || '',
      leadSource: deal.outboundInbound || '',
      stage: 'won',
      appointmentAt: deal.submittedAt || '',
      offer: deal.program || '',
      cashCollected: deal.cashCollected,
      dealTerms: deal.paymentAgreement || deal.paymentDetails || '',
      notes: deal.notes || '',
      setter: deal.setter || '',
      closer: deal.closer || '',
      closerEmail: deal.closerEmail || '',
      closedDealId: deal.id || '',
    }, { name: 'Backfill', type: 'system', note: 'backfilled from closed deal with no booking' });
  });

  var after = {
    bookedCalls: (store.bookedCalls || []).length,
    closedDeals: (store.closedDeals || []).length,
    eodReports: (store.eodReports || []).length,
    pipelineRecords: getPipelineRecords(ALL_WORKSPACES).length,
  };

  // What the board says the cash is, against what the deals say. These must agree —
  // if they do not, the deal matching above is wrong. On a commit this is read back
  // off the board; on a dry run it is what the plan would have put there.
  var boardCash = commit
    ? getPipelineRecords(ALL_WORKSPACES)
        .filter(function(r) { return r.stage === 'won'; })
        .reduce(function(sum, r) { return sum + (Number(r.cashCollected) || 0); }, 0)
    : existing
        .filter(function(r) { return r.stage === 'won'; })
        .reduce(function(sum, r) { return sum + (Number(r.cashCollected) || 0); }, 0) + plannedWonCash;
  var dealCash = deals.reduce(function(sum, d) { return sum + (parseFloat(d.cashCollected) || 0); }, 0);

  return {
    success: true,
    committed: !!commit,
    recordCounts: { before: before, after: after },
    created: created,
    skipped: skipped,
    orphanDeals: orphanDeals,
    byStage: byStage,
    cashCheck: {
      boardWonCash: Math.round(boardCash * 100) / 100,
      closedDealCash: Math.round(dealCash * 100) / 100,
      agrees: Math.abs(boardCash - dealCash) < 0.01,
    },
    note: commit ? '' : 'Dry run — nothing written. POST {"confirm":"backfill"} to write.',
  };
}

async function guard(req) {
  var access = await resolveAccess(req);
  if (!access.isOwner) {
    return NextResponse.json({ error: 'Operator access required' }, { status: 403 });
  }
  return null;
}

export async function GET(req) {
  await initStore();
  var denied = await guard(req);
  if (denied) return denied;
  try {
    return NextResponse.json(await plan(false));
  } catch (e) {
    console.error('[Backfill pipeline]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  await initStore();
  var denied = await guard(req);
  if (denied) return denied;
  try {
    var body = await req.json().catch(function() { return {}; });
    if (body.confirm !== 'backfill') {
      return NextResponse.json({ error: 'Send {"confirm":"backfill"} to write.' }, { status: 400 });
    }
    var result = await plan(true);
    console.log('[Backfill pipeline] created', result.created, 'skipped', result.skipped, JSON.stringify(result.byStage));
    return NextResponse.json(result);
  } catch (e) {
    console.error('[Backfill pipeline]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
