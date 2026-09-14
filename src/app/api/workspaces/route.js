import { NextResponse } from 'next/server';
import { getWorkspaces, createWorkspace, initStore, updateWorkspace } from '@/lib/store';
import { hashTeamPassword } from '@/lib/workspace-auth';

export var dynamic = 'force-dynamic';

export async function GET(req) {
  await initStore();
  return NextResponse.json({ success: true, workspaces: getWorkspaces() });
}

export async function POST(req) {
  await initStore();
  try {
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
    return NextResponse.json({ success: true, workspace: ws });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
