import { NextResponse } from 'next/server';
import { effectiveReadWorkspace, effectiveWriteWorkspace, resolveAccess, canSeeTeam } from '@/lib/access';
import { repScope } from '@/lib/rep-scope';
import {
  initStore, getCommissionEntries, addCommissionEntry, updateCommissionEntry,
  deleteRecord, getDisplayNameState, getAllCloserProfiles, getWorkspaceUserList,
} from '@/lib/store';

export var dynamic = 'force-dynamic';

// The manual commission ledger: rows a rep logs themselves.
//
// Two rules hold on every verb here. The workspace comes from the resolver, never
// from the body — a rep standing in one company must not be able to file a
// commission into another's books. And a rep owns only their own rows: the name on
// a new row is the caller's own unless a manager is filing for somebody, which is
// exactly how every other record type in here behaves.

// The name the server knows this caller by, resolved the same way /api/commissions
// resolves it so a rep's ledger and their commissions page cannot disagree about
// whose rows are whose.
async function callerName(req, workspaceId) {
  var access = await resolveAccess(req);
  var name = (getDisplayNameState(access.email) || {}).displayName || '';
  if (!name) {
    var profiles = getAllCloserProfiles() || {};
    var mine = profiles[(access.email || '').toLowerCase()];
    name = (mine && mine.name) || '';
  }
  if (!name) {
    var members = await getWorkspaceUserList(workspaceId).catch(function() { return []; });
    var row = (members || []).filter(function(m) {
      return (m.email || '').toLowerCase() === (access.email || '').toLowerCase();
    })[0];
    name = (row && row.name) || '';
  }
  return { email: access.email || '', name: name, access: access };
}

export async function GET(req) {
  await initStore();
  try {
    var url = new URL(req.url);
    var workspaceId = await effectiveReadWorkspace(req, url.searchParams.get('workspace'));
    var rows = getCommissionEntries(workspaceId);

    // A rep sees their own rows and nothing else, by the same ownership rules as
    // closed deals: the name decides, the email only when there is no name.
    var scope = await repScope(req);
    if (scope) rows = scope.filter(rows, 'closerEmail', 'closer');

    return NextResponse.json({ success: true, entries: rows, total: rows.length });
  } catch (e) {
    console.error('[Commission log GET Error]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  await initStore();
  try {
    var body = await req.json();
    var workspaceId = await effectiveWriteWorkspace(req, body.workspaceId);
    var me = await callerName(req, workspaceId);
    if (!me.email) {
      return NextResponse.json({ error: 'Sign in to log a commission' }, { status: 401 });
    }

    // What was sold is checked before who it belongs to, so a half-filled form
    // gets told about the field it is missing rather than about the roster.
    if (!String(body.leadName || '').trim()) {
      return NextResponse.json({ error: 'Who the sale was to is required' }, { status: 400 });
    }
    var cash = parseFloat(String(body.cashCollected || '').replace(/[$,\s]/g, ''));
    if (!isFinite(cash) || cash <= 0) {
      return NextResponse.json({ error: 'Cash collected is required' }, { status: 400 });
    }

    var access = me.access;
    var asked = String(body.closer || '').trim();
    // A rep logs their own sales. A manager may log on somebody's behalf, and the
    // row then carries the rep's name with the manager's email — the ownership
    // rule the whole codebase runs on, so the figure lands on the rep's ledger
    // and not on both.
    var closer = canSeeTeam(access) && asked ? asked : me.name;
    // Fail closed rather than file the row under nobody. A commission with no
    // name on it is a figure that shows up in a payout total and on no rep's
    // ledger, which is worse than a submission that failed loudly.
    if (!closer) {
      return NextResponse.json({
        error: canSeeTeam(access)
          ? 'Pick whose commission this is, or confirm your own display name first'
          : 'Confirm your display name before logging a commission, so the row lands on your ledger',
      }, { status: 400 });
    }

    var result = addCommissionEntry(Object.assign({}, body, {
      closer: closer,
      closerEmail: me.email,
      workspaceId: workspaceId,
    }));
    if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });

    console.log('[Commission log] Added', result.entry.id, 'for', closer, '-', result.entry.commissionAmount);
    return NextResponse.json({ success: true, entry: result.entry });
  } catch (e) {
    console.error('[Commission log POST Error]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// Find the row and refuse it unless the caller owns it. Doing the lookup inside the
// caller's own scope is what stops an id from another workspace — or another rep's
// id — being editable by guessing it.
async function mine(req, id) {
  var workspaceId = await effectiveWriteWorkspace(req, null);
  var rows = getCommissionEntries(workspaceId).filter(function(r) { return r.id === id; });
  if (!rows.length) return { error: 'No commission entry with id ' + id, status: 404 };
  var scope = await repScope(req);
  if (scope && !scope.owns(rows[0], 'closerEmail', 'closer')) {
    return { error: 'That commission entry is not yours', status: 403 };
  }
  return { entry: rows[0] };
}

export async function PATCH(req) {
  await initStore();
  try {
    var body = await req.json();
    var id = String(body.id || '').trim();
    if (!id) return NextResponse.json({ error: 'An id is required' }, { status: 400 });

    var found = await mine(req, id);
    if (found.error) return NextResponse.json({ error: found.error }, { status: found.status });

    var patch = Object.assign({}, body);
    delete patch.id;
    delete patch.workspaceId;
    // Only a manager moves a commission to approved or paid. A rep marking their
    // own row paid would make the status worthless as a payroll signal.
    var access = await resolveAccess(req);
    if (!canSeeTeam(access)) delete patch.status;
    // Nor does anybody reassign a row to a different rep by editing it.
    delete patch.closer;
    delete patch.closerEmail;

    var result = updateCommissionEntry(id, patch);
    if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ success: true, entry: result.entry });
  } catch (e) {
    console.error('[Commission log PATCH Error]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req) {
  await initStore();
  try {
    var url = new URL(req.url);
    var id = (url.searchParams.get('id') || '').trim();
    if (!id) return NextResponse.json({ error: 'An id is required' }, { status: 400 });

    var found = await mine(req, id);
    if (found.error) return NextResponse.json({ error: found.error }, { status: found.status });

    // A row already paid out stays. Removing the record of money that has left
    // the account is not an edit anybody needs, and the page hides the control —
    // the server refuses it too, rather than trusting that.
    if (found.entry.status === 'paid') {
      return NextResponse.json({
        error: 'That commission is already marked paid. Move it back to pending first if it needs removing.',
      }, { status: 409 });
    }

    // Soft, like every delete here: the Postgres row keeps its data with
    // deleted_at stamped, so a mis-click on a figure somebody is paid from is
    // recoverable with one UPDATE.
    var result = await deleteRecord('commission-entry', id);
    if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ success: true, id: id });
  } catch (e) {
    console.error('[Commission log DELETE Error]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
