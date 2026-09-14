// Server-side identity and workspace access control.
//
// Identity is the session cookie, and nothing else. It used to be the x-user-email
// header, which meant anyone could be anyone by typing a different address; with a
// shared team password that would have made the password decorative, since the
// header alone already opened the door. The cookie is signed, so it cannot be
// forged, and it is re-checked against live facts on every request rather than
// trusted until it expires.

import { getWorkspace, getWorkspaces, sessionsValidFrom } from '@/lib/store';
import { getUser } from '@/lib/users';
import { progressFor } from '@/lib/onboarding-plan';
import { roleSeesTeam } from '@/lib/roles';
import { readSession, sessionTokenFrom } from '@/lib/session';
import { activeMemberships, workspaceStamp } from '@/lib/workspace-auth';
import { OWNER_EMAIL } from '@/lib/owner';

export var ALL_WORKSPACES = '__all__';

export { OWNER_EMAIL };

// Whether a rep still owes the company their onboarding.
//
// Managers and the operator are exempt: the gate exists to make sure a new
// closer has actually been handed their seats and walked through comp, and
// nobody who can already see the whole team is in that position.
export function onboardingOwed(access, steps) {
  if (!access || access.canSeeTeam) return false;
  return !progressFor(steps || {}).complete;
}

export function canSeeTeam(access) {
  return !!(access && (access.canSeeAll || roleSeesTeam(access.role)));
}

var ANONYMOUS = {
  email: '', isOperator: false, isOwner: false, role: '',
  workspaceIds: [], canSeeAll: false, canSeeTeam: false, signedIn: false,
};

// Is this signed cookie still good? Four ways it stops being, all checked on
// every request so revocation lands on the next click rather than at expiry.
export async function sessionState(req) {
  var token = sessionTokenFrom(req);
  if (!token) return { ok: false, reason: 'none' };

  var body = await readSession(token);
  if (!body) return { ok: false, reason: 'invalid' };

  var email = String(body.email || '').toLowerCase();

  // 1. An admin killed this rep's sessions, or deactivating them did.
  var validFrom = sessionsValidFrom(email);
  if (validFrom && body.iat < Date.parse(validFrom)) return { ok: false, reason: 'revoked' };

  // 2. The account was switched off.
  var account = await getUser(email).catch(function() { return null; });
  if (account && account.active === false) return { ok: false, reason: 'inactive' };

  // 3. The roster row was deactivated, or the workspace went away.
  var memberships = await activeMemberships(email);
  var mine = null;
  for (var i = 0; i < memberships.length; i++) {
    if (memberships[i].workspaceId === body.workspaceId) { mine = memberships[i]; break; }
  }
  if (!mine) return { ok: false, reason: 'no-membership' };

  // 4. The team password was rotated after this session was minted.
  var ws = getWorkspace(body.workspaceId);
  if (ws && workspaceStamp(ws) !== (body.wsStamp || '')) return { ok: false, reason: 'rotated' };

  return { ok: true, session: body, membership: mine, memberships: memberships, account: account };
}

// Which workspaces may this caller act in?
//   operator -> every workspace, plus the combined view
//   member   -> the one workspace their session is pinned to
//   no session -> nobody, and every API answers accordingly
export async function resolveAccess(req) {
  var state = await sessionState(req);
  if (!state.ok) return Object.assign({}, ANONYMOUS, { sessionReason: state.reason });

  var email = state.session.email;
  if (email === OWNER_EMAIL) {
    return {
      email: email, isOperator: true, isOwner: true, role: 'operator',
      workspaceIds: [], canSeeAll: true, canSeeTeam: true, signedIn: true,
      memberships: state.memberships,
      // Which workspace the operator is actually looking at. switch-workspace
      // re-mints the session with it, so the server knows without being told —
      // which matters for the handful of callers that forget to say.
      activeWorkspaceId: state.session.workspaceId || null,
    };
  }

  var role = state.membership.role || (state.account && state.account.role) || 'closer';
  var access = {
    email: email,
    isOperator: false,
    isOwner: false,
    role: role,
    workspaceIds: [state.membership.workspaceId],
    canSeeAll: false,
    signedIn: true,
    memberships: state.memberships,
  };
  access.canSeeTeam = canSeeTeam(access);
  return access;
}

// The signed-in caller's address, or '' when there is no valid session. Async now
// that it reads a cookie rather than a header — every call site awaits it.
export async function callerEmail(req) {
  var access = await resolveAccess(req);
  return access.email || '';
}

// A rep sees their own records; everyone senior sees the workspace. Returns the
// email to filter by, or '' when no rep filter applies.
export async function repOnlyFilter(req) {
  var access = await resolveAccess(req);
  if (access.canSeeTeam) return '';
  return access.email || '';
}

// What a request should actually read. A member's session is pinned to one
// workspace, so a query string asking for another is ignored rather than obeyed.
export async function effectiveReadWorkspace(req, requested) {
  var access = await resolveAccess(req);

  if (access.canSeeAll) {
    // Asked for explicitly — including the combined view, which the client now
    // names rather than implying by omission.
    if (requested) return requested;
    // Not asked for at all. This used to mean "every workspace", which is how a
    // caller that simply forgot to pass one — the EOD tracker's roster, among
    // others — showed the operator one client's whole floor while they were
    // standing in another client's workspace. Silence now means the workspace
    // they are actually in.
    return access.activeWorkspaceId || ALL_WORKSPACES;
  }

  if (!access.workspaceIds.length) return ALL_WORKSPACES;
  return access.workspaceIds[0];
}

// The workspace a new record must be written into. Never the combined view.
export async function effectiveWriteWorkspace(req, requested) {
  var access = await resolveAccess(req);
  if (access.canSeeAll) {
    if (!requested || requested === ALL_WORKSPACES) return 'default';
    return requested;
  }
  return access.workspaceIds[0] || 'default';
}

// Does a record fall inside the resolved filter? The filter is a single workspace
// id, or a list of them for someone who belongs to several.
export function matchesWorkspace(record, filter) {
  if (!filter || filter === ALL_WORKSPACES) return true;
  var id = (record && record.workspaceId) || 'default';
  if (Array.isArray(filter)) return filter.indexOf(id) !== -1;
  return id === filter;
}

// Every workspace the caller could switch into, for the picker and the nav.
export async function visibleWorkspaces(access) {
  var all = getWorkspaces();
  if (access.canSeeAll) return all.map(function(w) { return { id: w.id, name: w.name, role: 'operator' }; });
  var byId = {};
  all.forEach(function(w) { byId[w.id] = w; });
  return (access.memberships || [])
    .filter(function(m) { return !!byId[m.workspaceId]; })
    .map(function(m) { return { id: m.workspaceId, name: byId[m.workspaceId].name, role: m.role }; });
}
