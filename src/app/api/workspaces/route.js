import { NextResponse } from 'next/server';
import { getWorkspaces, createWorkspace, initStore, updateWorkspace } from '@/lib/store';
import { hashTeamPassword } from '@/lib/workspace-auth';
import { resolveAccess, visibleWorkspaces } from '@/lib/access';

// Never hand a workspace's sign-in credentials to a browser. The raw records carry
// teamPasswordSalt/Hash; serialising them whole shipped that material to every
// caller of this route, member and operator alike.
function publicWorkspace(w) {
  if (!w) return null;
  var out = {};
  Object.keys(w).forEach(function (k) {
    if (/password|salt|hash|secret|token|apiKey/i.test(k)) return;
    out[k] = w[k];
  });
  return out;
}

export var dynamic = 'force-dynamic';

// The list a caller may see is the list they belong to. Unscoped, this handed one
// client's admin the name and id of every other client on the platform.
export async function GET(req) {
  await initStore();
  var access = await resolveAccess(req);
  if (!access.signedIn) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }
  if (access.canSeeAll) {
    return NextResponse.json({ success: true, workspaces: getWorkspaces().map(publicWorkspace) });
  }
  var mine = await visibleWorkspaces(access);
  var byId = {};
  getWorkspaces().forEach(function (w) { byId[w.id] = w; });
  return NextResponse.json({
    success: true,
    workspaces: mine.map(function (m) { return publicWorkspace(byId[m.id]); }).filter(Boolean),
  });
}

export async function POST(req) {
  await initStore();
  try {
    // Standing up a new client workspace is the account owner's act alone.
    var access = await resolveAccess(req);
    if (!access.isOperator) {
      return NextResponse.json({ error: 'Operator access required' }, { status: 403 });
    }
    var body = await req.json();
    if (!body.companyName) return NextResponse.json({ error: 'companyName required' }, { status: 400 });
    var ws = await createWorkspace(body);
    // The password the new team will sign in with, hashed on the way in. It is
    // never stored, echoed or logged in a readable form.
    if (ws && body.teamPassword) {
      var creds = hashTeamPassword(String(body.teamPassword));
      await updateWorkspace(ws.id, {
        teamPasswordSalt: creds.salt,
        teamPasswordHash: creds.hash,
        passwordRotatedAt: new Date().toISOString(),
      });
    }
    return NextResponse.json({ success: true, workspace: publicWorkspace(ws) });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
