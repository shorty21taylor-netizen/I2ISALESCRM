import { NextResponse } from 'next/server';
import { initStore, getStore, getAllCloserProfiles } from '@/lib/store';
import { resolveAccess } from '@/lib/access';
import { listUsers } from '@/lib/users';
import { buildNameIndex, planRecord } from '@/lib/attribution-repair';
import { saveClosedDeal, saveBookedCall, saveEODReport, saveAfterCallReport } from '@/lib/db';

export var dynamic = 'force-dynamic';

var KINDS = [
  { key: 'closedDeals',      label: 'Closed deals',       name: 'closer',   email: 'closerEmail', save: saveClosedDeal },
  { key: 'bookedCalls',      label: 'Booked calls',       name: 'closer',   email: 'closerEmail', save: saveBookedCall },
  { key: 'eodReports',       label: 'EOD reports',        name: 'salesRep', email: 'closerEmail', save: saveEODReport },
  { key: 'afterCallReports', label: 'After-call reports', name: 'closer',   email: 'closerEmail', save: saveAfterCallReport },
];

async function plan() {
  var store = getStore();
  var accounts = await listUsers().catch(function() { return []; });
  var index = buildNameIndex(accounts, getAllCloserProfiles());

  return KINDS.map(function(kind) {
    var rows = store[kind.key] || [];
    var changes = [];
    rows.forEach(function(record) {
      var change = planRecord(record, kind.name, kind.email, index);
      if (change) changes.push(change);
    });
    return {
      key: kind.key,
      label: kind.label,
      total: rows.length,
      changes: changes,
      counts: changes.reduce(function(acc, c) { acc[c.action] = (acc[c.action] || 0) + 1; return acc; }, {}),
    };
  });
}

// Dry run. Shows exactly what an apply would do and changes nothing.
export async function GET(req) {
  await initStore();
  var access = await resolveAccess(req);
  if (!access.canSeeAll) return NextResponse.json({ error: 'Operator only' }, { status: 403 });

  var report = await plan();
  return NextResponse.json({
    success: true,
    dryRun: true,
    totalChanges: report.reduce(function(n, k) { return n + k.changes.length; }, 0),
    kinds: report.map(function(k) {
      return {
        label: k.label, total: k.total, counts: k.counts,
        // A sample, so the response stays readable on a few thousand records.
        sample: k.changes.slice(0, 12),
        changeCount: k.changes.length,
      };
    }),
  });
}

export async function POST(req) {
  await initStore();
  var access = await resolveAccess(req);
  if (!access.canSeeAll) return NextResponse.json({ error: 'Operator only' }, { status: 403 });

  var body = await req.json().catch(function() { return {}; });
  if (body.confirm !== 'repair') {
    return NextResponse.json(
      { error: 'Send { "confirm": "repair" } to apply. GET this route first to see what it would do.' },
      { status: 400 }
    );
  }

  var store = getStore();
  var report = await plan();
  var applied = 0;
  var failures = [];

  for (var i = 0; i < KINDS.length; i++) {
    var kind = KINDS[i];
    var changes = report[i].changes;
    var byId = {};
    (store[kind.key] || []).forEach(function(r) { byId[r.id] = r; });

    for (var j = 0; j < changes.length; j++) {
      var change = changes[j];
      var record = byId[change.id];
      if (!record) continue;
      record[kind.email] = change.to;
      try {
        await kind.save(record);
        applied++;
      } catch (err) {
        failures.push({ id: change.id, error: err.message });
      }
    }
  }

  return NextResponse.json({
    success: true,
    applied: applied,
    failures: failures,
    kinds: report.map(function(k) { return { label: k.label, changed: k.changes.length, counts: k.counts }; }),
  });
}
