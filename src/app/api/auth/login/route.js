import { NextResponse } from 'next/server';
import { initStore, getWorkspace, getDisplayNameState, getLastWorkspace, setLastWorkspace, registerCloser } from '@/lib/store';
import { getUser } from '@/lib/users';
import { mintSession, attachSession } from '@/lib/session';
import {
  GENERIC_FAILURE, rateLimitMessage, normalizeEmail, dummyCompare,
  ensureAuthReady, verifyWorkspacePassword, workspaceStamp,
  activeMemberships, rateLimit, noteAttempt, clientIp,
} from '@/lib/workspace-auth';

export var dynamic = 'force-dynamic';

// Email + team password. The roster is the access control: only an address with a
// live membership signs in at all. The password proves you are inside the org;
// the email says who you are and which workspace you get.
//
// The submitted password is never logged, here or anywhere downstream. There is
// deliberately no field for it on the attempt record.
export async function POST(req) {
  await initStore();
  try {
    var body = await req.json().catch(function() { return {}; });
    var email = normalizeEmail(body.email);
    var password = String(body.password || '');

    if (!email || !password) {
      return NextResponse.json({ error: GENERIC_FAILURE }, { status: 401 });
    }

    // Before anything else. One shared secret across the org means a single
    // guessed password opens every roster email at once, so this is the whole of
    // the brute-force defence and it runs first.
    var limited = rateLimit(email, clientIp(req));
    if (limited) {
      return NextResponse.json({ error: rateLimitMessage(limited.minutes) }, { status: 429 });
    }

    await ensureAuthReady();

    var account = await getUser(email).catch(function() { return null; });
    var memberships = await activeMemberships(email);

    // Unknown address, switched-off account, or nobody's roster: all answered the
    // same way, and all pay the same scrypt cost first. Without the dummy compare
    // the response time alone would tell an outsider which of your people exist.
    if (!memberships.length || (account && account.active === false)) {
      dummyCompare(password);
      noteAttempt(req, { email: email, success: false });
      return NextResponse.json({ error: GENERIC_FAILURE }, { status: 401 });
    }

    // Which of this rep's workspaces does the submitted password actually open?
    // Only those. A rep in two workspaces with two different passwords proves one
    // of them, and lands in that one.
    var proven = [];
    for (var i = 0; i < memberships.length; i++) {
      var ws = getWorkspace(memberships[i].workspaceId);
      if (!ws) continue;
      if (verifyWorkspacePassword(ws, password)) proven.push(memberships[i]);
    }

    if (!proven.length) {
      noteAttempt(req, { email: email, success: false });
      return NextResponse.json({ error: GENERIC_FAILURE }, { status: 401 });
    }

    // Land them where they were last, when that is still one they just proved.
    var remembered = getLastWorkspace(email);
    var landing = proven[0];
    for (var j = 0; j < proven.length; j++) {
      if (proven[j].workspaceId === remembered) { landing = proven[j]; break; }
    }

    var workspace = getWorkspace(landing.workspaceId);
    var token = await mintSession({
      email: email,
      workspaceId: landing.workspaceId,
      role: landing.role,
      wsStamp: workspaceStamp(workspace),
      // Switching later is only allowed into a workspace this password opened.
      proven: proven.map(function(m) { return m.workspaceId; }),
    });

    setLastWorkspace(email, landing.workspaceId);
    noteAttempt(req, { email: email, success: true, workspaceId: landing.workspaceId });

    // One closer profile per address, so the board has somewhere to file their
    // work from the first sign-in. The name is never taken from this form, and a
    // profile is never created under an email address pretending to be one —
    // somebody with no name yet is asked for theirs on /welcome instead.
    var state = getDisplayNameState(email);
    var known = (account && account.name && account.name.indexOf('@') === -1) ? account.name : '';
    if (!state.displayName && known) registerCloser(email, known);

    var response = NextResponse.json({
      success: true,
      user: {
        email: email,
        name: state.displayName || (account && account.name) || '',
        role: landing.role,
      },
      workspaceId: landing.workspaceId,
      // More than one and the client shows a picker; exactly one and it does not.
      workspaces: proven.map(function(m) {
        var w = getWorkspace(m.workspaceId);
        return { id: m.workspaceId, name: (w && w.name) || m.workspaceId, role: m.role };
      }),
      needsNameConfirmation: !state.confirmedAt,
    });

    return attachSession(response, token);
  } catch (e) {
    console.error('[Login] failed:', e && e.message);
    return NextResponse.json({ error: GENERIC_FAILURE }, { status: 401 });
  }
}
