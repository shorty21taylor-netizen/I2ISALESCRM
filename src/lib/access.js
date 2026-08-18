// Server-side workspace access control.
//
// Identity arrives as the x-user-email header, set by the client from the signed-in
// user. Every API asks this module which workspaces that caller may read and write.
//
// CAVEAT: the header is supplied by the client. Accounts now have real per-user
// passwords (see lib/users.js), but there is still no signed session token, so a
// technical user could send another person's email. This module is the single seam
// where a real session check should go.

import { getWorkspace } from '@/lib/store';
import { getUser } from '@/lib/users';

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

// Which workspaces may this caller act in?
//   operator -> every workspace, plus the combined view
//   member   -> the workspaces assigned to their account (one or many)
//   unknown  -> 'default', so the pre-existing team keeps working unchanged
export async function resolveAccess(req) {
  var email = callerEmail(req);
  var isOperator = !!email && email === OWNER_EMAIL;

  if (isOperator) {
    return { email: email, isOperator: true, isOwner: true, role: 'operator', workspaceIds: [], canSeeAll: true };
  }

  var account = null;
  if (email) {
    try {
      account = await getUser(email);
    } catch (e) {
      console.error('[Access] user lookup failed:', e.message);
    }
  }

  var ids = (account && Array.isArray(account.workspaceIds)) ? account.workspaceIds.slice() : [];
  // Drop assignments to workspaces that have since been deleted.
  ids = ids.filter(function(id) { return id === 'default' || !!getWorkspace(id); });
  if (ids.length === 0) ids = ['default'];

  return {
    email: email,
    isOperator: false,
    isOwner: false,
    role: (account && account.role) || 'closer',
    workspaceIds: ids,
    canSeeAll: false,
  };
}

// What a request should actually read.
// Operators get what they asked for. A member gets the requested workspace only if
// it is one of theirs; otherwise they get their own set — which for someone in
// several workspaces is a combined view across just those.
export async function effectiveReadWorkspace(req, requested) {
  var access = await resolveAccess(req);
  if (access.canSeeAll) return requested || ALL_WORKSPACES;

  if (requested && requested !== ALL_WORKSPACES && access.workspaceIds.indexOf(requested) !== -1) {
    return requested;
  }
  return access.workspaceIds.length === 1 ? access.workspaceIds[0] : access.workspaceIds;
}

// The workspace a new record must be written into. Never the combined view.
export async function effectiveWriteWorkspace(req, requested) {
  var access = await resolveAccess(req);
  if (access.canSeeAll) {
    if (!requested || requested === ALL_WORKSPACES) return 'default';
    return requested;
  }
  if (requested && access.workspaceIds.indexOf(requested) !== -1) return requested;
  return access.workspaceIds[0];
}

// Does a record fall inside the resolved filter? The filter is a single workspace
// id, or a list of them for someone who belongs to several.
export function matchesWorkspace(record, filter) {
  if (!filter || filter === ALL_WORKSPACES) return true;
  var id = (record && record.workspaceId) || 'default';
  if (Array.isArray(filter)) return filter.indexOf(id) !== -1;
  return id === filter;
}
