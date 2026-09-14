import { NextResponse } from 'next/server';
import { initStore, getWorkspace, setLastWorkspace } from '@/lib/store';
import { sessionState } from '@/lib/access';
import { mintSession, attachSession } from '@/lib/session';
import { workspaceStamp } from '@/lib/workspace-auth';

export var dynamic = 'force-dynamic';

// Moving a multi-workspace rep between their offers re-mints the session rather
// than widening it, so a request still names exactly one workspace.
//
// Only into a workspace this sign-in's password actually opened. Two workspaces
// with two different passwords means proving one gets you one.
export async function POST(req) {
  await initStore();
  var state = await sessionState(req);
  if (!state.ok) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });

  var body = await req.json().catch(function() { return {}; });
  var target = String(body.workspaceId || '');

  var membership = null;
  for (var i = 0; i < state.memberships.length; i++) {
    if (state.memberships[i].workspaceId === target) { membership = state.memberships[i]; break; }
  }
  if (!membership) return NextResponse.json({ error: 'Not one of your workspaces' }, { status: 403 });

  var proven = state.session.proven || [];
  var isOperator = state.session.role === 'operator';
  if (!isOperator && proven.indexOf(target) === -1) {
    return NextResponse.json({
      error: 'That workspace has its own team password. Sign in again with it.',
    }, { status: 403 });
  }

  var ws = getWorkspace(target);
  if (!ws) return NextResponse.json({ error: 'No such workspace' }, { status: 404 });

  var token = await mintSession({
    email: state.session.email,
    workspaceId: target,
    role: membership.role,
    wsStamp: workspaceStamp(ws),
    proven: proven,
  });
  setLastWorkspace(state.session.email, target);

  return attachSession(
    NextResponse.json({ success: true, workspaceId: target, role: membership.role }),
    token
  );
}
