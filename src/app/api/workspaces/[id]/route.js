import { NextResponse } from 'next/server';
import { getWorkspace, getWorkspaceBranded, updateWorkspace, getWorkspaceUserList, initStore } from '@/lib/store';
import { resolveAccess } from '@/lib/access';
import { publicWorkspace } from '@/lib/workspace-public';

export var dynamic = 'force-dynamic';

export async function GET(req, { params }) {
  await initStore();
  var p = await params;

  // This route had no gate at all. It returned the workspace record whole —
  // teamPasswordSalt and teamPasswordHash included — plus the entire roster,
  // to anyone who knew the id, signed in or not. A salt and a scrypt hash is
  // everything needed to crack the team password offline, and the team password
  // is the only thing standing between an outsider and the workspace.
  var access = await resolveAccess(req);
  if (!access.signedIn) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }
  // 404 rather than 403 for a workspace that is not theirs: a 403 would confirm
  // that a workspace with that id exists.
  if (!access.canSeeAll && access.workspaceIds.indexOf(p.id) === -1) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Branded: the Settings card renders this, so it must see the colour the
  // workspace is actually wearing rather than a blank field.
  var ws = getWorkspaceBranded(p.id);
  if (!ws) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // The roster names real people and is only a manager's business.
  var users = access.canSeeTeam ? await getWorkspaceUserList(p.id) : [];
  return NextResponse.json({ success: true, workspace: publicWorkspace(ws), users: users });
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
  return NextResponse.json({ success: true, workspace: publicWorkspace(getWorkspaceBranded(p.id)) });
}
