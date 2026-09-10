import { NextResponse } from 'next/server';
import { getWorkspace, updateWorkspace, getWorkspaceUserList, initStore } from '@/lib/store';
import { resolveAccess } from '@/lib/access';

export var dynamic = 'force-dynamic';

export async function GET(req, { params }) {
  await initStore();
  var p = await params;
  var ws = getWorkspace(p.id);
  if (!ws) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  var users = await getWorkspaceUserList(p.id);
  return NextResponse.json({ success: true, workspace: ws, users: users });
}

export async function POST(req, { params }) {
  await initStore();
  var p = await params;

  // This route rewrites a workspace wholesale — its name, branding, team password.
  // Anyone signed in could previously call it against any workspace.
  var access = await resolveAccess(req);
  var mayEdit = access.canSeeAll
    || (access.canSeeTeam && access.workspaceIds.indexOf(p.id) !== -1);
  if (!mayEdit) {
    return NextResponse.json({ error: 'You cannot change this workspace' }, { status: 403 });
  }

  var body = await req.json();
  var ws = await updateWorkspace(p.id, body);
  if (!ws) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ success: true, workspace: ws });
}
