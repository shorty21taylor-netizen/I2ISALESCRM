// Who is this caller to a given pipeline record, and what may they do with it.
//
// This is the server's answer, not the page's. The board greys out what it believes
// the caller cannot move, but every move is checked again here — hiding a control is
// presentation, and a POST goes straight past presentation.

import { resolveAccess } from '@/lib/access';
import { getCloserProfile, getUserWorkspace } from '@/lib/store';
import { getUser } from '@/lib/users';
import { repIdentity } from '@/lib/rep-stats';
import { seniorRole, canMove } from '@/lib/pipeline';

// Build once per request, then ask it about each record.
export async function pipelineViewer(req) {
  var access = await resolveAccess(req);

  // No session is not a privileged session. It owns nothing and sees nothing.
  if (!access.signedIn || !access.email) {
    return {
      anonymous: true, email: '', name: '', role: '', senior: false,
      workspaceIds: [],
      relation: function() { return ''; },
      visible: function() { return []; },
    };
  }

  var senior = seniorRole(access.role) || !!access.canSeeTeam;
  var account = await getUser(access.email).catch(function() { return null; });

  // The name records are filed under. An account row is not the only place it
  // lives: somebody added to a workspace from Team & Permissions has a roster row
  // with their name on it and may have no app_users row at all. Without this
  // fallback that rep matches nothing, and their own board comes back empty while
  // every card they are named on sits there invisible.
  var memberName = '';
  if (!account || !account.name) {
    var membership = await getUserWorkspace(access.email).catch(function() { return null; });
    memberName = (membership && membership.user && membership.user.name) || '';
  }
  var identity = repIdentity(
    getCloserProfile(access.email),
    access.email,
    (account && account.name) || memberName
  );

  return {
    anonymous: false,
    email: access.email,
    name: identity.name,
    role: access.role,
    senior: senior,
    isOwner: !!access.isOwner,

    // 'senior', 'setter', 'closer', or '' for a record that is none of their business.
    // A senior answer wins outright — a manager who also happens to be the closer on
    // a card still moves it with a manager's permissions.
    relation: function(record) {
      if (senior) return 'senior';
      if (!record) return '';
      if (identity.owns(record, 'setterEmail', 'setter')) return 'setter';
      if (identity.owns(record, 'closerEmail', 'closer')) return 'closer';
      return '';
    },

    // A rep sees only the records they are on. Managers see the whole workspace —
    // the workspace filter is applied before this, by effectiveReadWorkspace.
    visible: function(records) {
      if (senior) return records || [];
      var self = this;
      return (records || []).filter(function(r) { return !!self.relation(r); });
    },
  };
}

// The full check for one move: is this caller on the record at all, and does their
// role allow this particular transition. Returns { ok, reason, status }.
export function authorizeMove(viewer, record, toStage) {
  if (!viewer || viewer.anonymous) {
    return { ok: false, status: 401, reason: 'Sign in first.' };
  }
  if (!record) {
    return { ok: false, status: 404, reason: 'No such pipeline record.' };
  }
  var relation = viewer.relation(record);
  if (!relation) {
    // Deliberately the same answer as "no such record": a rep probing ids should
    // not be able to learn which ones exist on somebody else's board.
    return { ok: false, status: 404, reason: 'No such pipeline record.' };
  }
  var verdict = canMove(relation, record.stage, toStage);
  if (!verdict.ok) {
    return { ok: false, status: 403, reason: verdict.reason, relation: relation };
  }
  return { ok: true, relation: relation };
}

// Reassigning a rep is a senior act. A closer must not be able to write themselves
// onto somebody else's booking, and a setter must not be able to swap the closer.
export function authorizeAssignment(viewer, body) {
  var touchesReps = body && (
    body.setter !== undefined || body.closer !== undefined ||
    body.setterEmail !== undefined || body.closerEmail !== undefined
  );
  if (!touchesReps) return { ok: true };
  if (viewer && viewer.senior) return { ok: true };
  return { ok: false, status: 403, reason: 'Only a manager can reassign the rep on a record.' };
}
