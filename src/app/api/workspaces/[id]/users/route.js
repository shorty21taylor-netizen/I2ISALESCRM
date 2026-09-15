import { NextResponse } from 'next/server';
import { addUserToWorkspace, getWorkspaceUserList, initStore } from '@/lib/store';
import { resolveAccess } from '@/lib/access';

export var dynamic = 'force-dynamic';

// May this caller act on the workspace named in the path? 404 rather than 403 —
// a 403 would confirm that a workspace with that id exists.
async function reachable(req, id) {
  var access = await resolveAccess(req);
  if (!access.signedIn) return { ok: false, status: 401, error: 'Not signed in' };
  if (access.canSeeAll) return { ok: true, access: access };
  if (access.workspaceIds.indexOf(id) === -1) return { ok: false, status: 404, error: 'Not found' };
  return { ok: true, access: access };
}

export async function GET(req, { params }) {
  await initStore();
  var p = await params;
  var gate = await reachable(req, p.id);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  var users = await getWorkspaceUserList(p.id);
  return NextResponse.json({ success: true, users: users });
}

export async function POST(req, { params }) {
  await initStore();
  var p = await params;
  var gate = await reachable(req, p.id);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  var body = await req.json();
  if (!body.email) return NextResponse.json({ error: 'email required' }, { status: 400 });

  // Only the account owner hands out admin. Without this, an admin could add
  // themselves to another client's workspace, or promote themselves here.
  var requested = body.role || 'closer';
  if (!gate.access.isOperator && requested === 'admin') {
    return NextResponse.json({ error: 'Only the account owner can grant admin' }, { status: 403 });
  }

  var user = await addUserToWorkspace(p.id, body.email, body.name || '', requested);
  return NextResponse.json({ success: true, user: user });
}
