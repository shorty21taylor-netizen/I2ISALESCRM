// Server-side workspace access control.
//
// Identity arrives as the x-user-email header, set by the client from the signed-in
// user. That is only as trustworthy as the client — see the caveat below — but it
// gives every API one place to decide which workspace a caller may read and write.
//
// CAVEAT: this app authenticates with a shared team password and keeps the user in
// localStorage; there is no server-side session or token. A determined user could
// therefore send someone else's email in the header. This module enforces the
// product rule (a member sees only their workspace) and is the right seam to bolt
// real sessions onto, but it is not a defence against a malicious insider.

import { getUserWorkspace, getWorkspace } from '@/lib/store';

export var ALL_WORKSPACES = '__all__';

// The account that owns every workspace and sees the combined Operator View.
export var OWNER_EMAIL = 'shorty21taylor@gmail.com';

export function callerEmail(req) {
  try {
    return (req.headers.get('x-user-email') || '').trim().toLowerCase();
  } catch (e) {
    return '';
  }
}

// Which workspace is this caller allowed to act in?
//   owner   -> any workspace, plus the combined view
//   member  -> exactly the workspace they were added to
//   unknown -> 'default', so the pre-existing team keeps working unchanged
export async function resolveAccess(req) {
  var email = callerEmail(req);
  var isOwner = !!email && email === OWNER_EMAIL;

  if (isOwner) {
    return { email: email, isOwner: true, role: 'owner', workspaceId: null, canSeeAll: true };
  }

  var membership = null;
  if (email) {
    try {
      membership = await getUserWorkspace(email);
    } catch (e) {
      console.error('[Access] membership lookup failed:', e.message);
    }
  }

  var wsId = (membership && membership.workspaceId) || 'default';
  // A member pinned to a workspace that no longer exists falls back to 'default'
  // rather than being locked out of the app entirely.
  if (wsId !== 'default' && !getWorkspace(wsId)) wsId = 'default';

  return {
    email: email,
    isOwner: false,
    role: (membership && membership.role) || 'closer',
    workspaceId: wsId,
    canSeeAll: false,
  };
}

// The workspace a request should actually read from.
// Owners get what they asked for (defaulting to the combined view); everyone else
// is pinned to their own workspace no matter what the query string says.
export async function effectiveReadWorkspace(req, requested) {
  var access = await resolveAccess(req);
  if (access.canSeeAll) return requested || ALL_WORKSPACES;
  return access.workspaceId;
}

// The workspace a new record must be written into. Never the combined view.
export async function effectiveWriteWorkspace(req, requested) {
  var access = await resolveAccess(req);
  if (access.canSeeAll) {
    if (!requested || requested === ALL_WORKSPACES) return 'default';
    return requested;
  }
  return access.workspaceId;
}
