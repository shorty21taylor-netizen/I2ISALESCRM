import { NextResponse } from 'next/server';
import {
  initStore, getWorkspace, getWorkspaceAttempts,
  addWorkspaceMember, setMemberActive, revokeSessions,
} from '@/lib/store';
import { resolveAccess, sessionState } from '@/lib/access';
import { mintSession, attachSession } from '@/lib/session';
import {
  rotateWorkspacePassword, rotationOverdue, rosterFor, flagSharedSignIns,
  normalizeEmail, ensureAuthReady, emailIndexState,
} from '@/lib/workspace-auth';
import { getUser, createUser } from '@/lib/users';
import { roleLabel } from '@/lib/roles';

export var dynamic = 'force-dynamic';

var ROLES = ['setter', 'closer', 'manager', 'admin'];

// Managers and admins run their own workspace. The operator can run any of them.
async function gate(req) {
  var access = await resolveAccess(req);
  if (!access.email) return { denied: NextResponse.json({ error: 'Sign in first' }, { status: 401 }) };
  if (!access.canSeeTeam) {
    return { denied: NextResponse.json({ error: 'Manager access required' }, { status: 403 }) };
  }
  var url = new URL(req.url);
  var requested = url.searchParams.get('workspace');
  var workspaceId = access.canSeeAll
    ? (requested || 'default')
    : access.workspaceIds[0];
  var ws = getWorkspace(workspaceId);
  if (!ws) return { denied: NextResponse.json({ error: 'No such workspace' }, { status: 404 }) };
  return { access: access, workspaceId: workspaceId, ws: ws };
}

export async function GET(req) {
  await initStore();
  var g = await gate(req);
  if (g.denied) return g.denied;
  await ensureAuthReady();

  var attempts = getWorkspaceAttempts(g.workspaceId, 50);
  // Two successes for one rep from different IPs inside ten minutes is the shape
  // a borrowed login makes. Flagged rather than left to be noticed.
  var flagged = flagSharedSignIns(attempts);

  return NextResponse.json({
    success: true,
    workspace: { id: g.ws.id, name: g.ws.name },
    passwordRotatedAt: g.ws.passwordRotatedAt || null,
    rotationOverdue: rotationOverdue(g.ws),
    roster: await rosterFor(g.workspaceId),
    // Two accounts whose addresses differ only in case are two records for one
    // person. Shown to the people who can merge them rather than left in a log.
    duplicateEmails: (emailIndexState().duplicates || []),
    roles: ROLES.map(function(r) { return { id: r, label: roleLabel(r) }; }),
    signIns: attempts.map(function(a) {
      return {
        id: a.id, email: a.email, ip: a.ip, at: a.at,
        success: a.success, shared: !!flagged[a.id],
        userAgent: a.userAgent || '',
      };
    }),
  });
}

export async function POST(req) {
  await initStore();
  var g = await gate(req);
  if (g.denied) return g.denied;

  var body = await req.json().catch(function() { return {}; });
  var action = String(body.action || '');

  // ---- rotate the team password ----
  if (action === 'rotate') {
    var next = String(body.password || '');
    if (next !== String(body.confirm || '')) {
      return NextResponse.json({ error: 'Those two passwords do not match' }, { status: 400 });
    }
    try {
      var before = await sessionState(req);
      var result = await rotateWorkspacePassword(g.workspaceId, next);
      // Every session in this workspace was stamped with the old rotation time,
      // so they are all dead as of this moment — no sweep, no session table.
      var out = NextResponse.json({
        success: true,
        rotatedAt: result.rotatedAt,
        note: 'Everyone in this workspace is signed out. They need the new password to get back in.',
      });

      // Except whoever just typed it. Bouncing the admin out of the screen the
      // moment they rotate means they never see it worked, and they are the one
      // person in the building who provably knows the new password.
      if (before.ok && before.session.workspaceId === g.workspaceId) {
        attachSession(out, await mintSession({
          email: before.session.email,
          workspaceId: before.session.workspaceId,
          role: before.session.role,
          wsStamp: result.rotatedAt,
          proven: before.session.proven,
        }));
      }
      return out;
    } catch (e) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
  }

  // ---- add somebody to the roster ----
  if (action === 'add-member') {
    var email = normalizeEmail(body.email);
    var role = ROLES.indexOf(body.role) === -1 ? 'closer' : body.role;
    if (!email || email.indexOf('@') === -1) {
      return NextResponse.json({ error: 'A real email address is required' }, { status: 400 });
    }
    // Only the operator hands out admin; a manager cannot mint their own peer.
    if (role === 'admin' && !g.access.canSeeAll) {
      return NextResponse.json({ error: 'Only the operator can add an admin' }, { status: 403 });
    }

    var account = await getUser(email).catch(function() { return null; });
    if (!account) {
      // An account is a roster entry now, not a credential — there is no password
      // to invent and nothing to email them. Their address plus the team password
      // is the whole of it.
      await createUser({ email: email, name: body.name || email, role: role, workspaceIds: [g.workspaceId] })
        .catch(function(e) { console.error('[Admin workspace] createUser:', e.message); });
    }
    var member = await addWorkspaceMember(g.workspaceId, email, body.name || (account && account.name) || '', role);
    return NextResponse.json({ success: true, member: member });
  }

  // ---- take somebody off it ----
  //
  // This is the offboarding action, and it is why a shared password is workable:
  // their email stops authenticating on their next request, and nobody else has
  // to learn a new password.
  if (action === 'deactivate' || action === 'reactivate') {
    var target = normalizeEmail(body.email);
    if (!target) return NextResponse.json({ error: 'Which member?' }, { status: 400 });
    if (target === normalizeEmail(g.access.email)) {
      return NextResponse.json({ error: 'You cannot deactivate yourself' }, { status: 400 });
    }
    var active = action === 'reactivate';
    var changed = await setMemberActive(g.workspaceId, target, active);
    if (!changed) return NextResponse.json({ error: 'Not on this roster' }, { status: 404 });
    if (!active) revokeSessions(target);
    return NextResponse.json({ success: true, email: target, active: active });
  }

  // ---- kill one person's sessions without touching their access ----
  if (action === 'kill-sessions') {
    var who = normalizeEmail(body.email);
    if (!who) return NextResponse.json({ error: 'Which member?' }, { status: 400 });
    var at = revokeSessions(who);
    return NextResponse.json({ success: true, email: who, revokedAt: at });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
