import { NextResponse } from 'next/server';
import { initStore, getAllCloserProfiles, getStore, getWorkspaceUserList } from '@/lib/store';
import { callerEmail, effectiveReadWorkspace, ALL_WORKSPACES as ACCESS_ALL } from '@/lib/access';
import { scopeProfiles } from '@/lib/rep-roster-scope';
import { listUsers } from '@/lib/users';
import { repIdentity } from '@/lib/rep-stats';
import { effectiveStatus } from '@/lib/rep-status';
import { photoId } from '@/lib/rep-photo';

export var dynamic = 'force-dynamic';

// Who the floor is, for every screen that lists people: a name, the names their
// records are filed under, a face, and whether they are reachable.
//
// Deliberately no image bytes. A roster of ten reps carrying ten data URLs is
// most of a megabyte of JSON on every filter change; instead each face gets an
// opaque id that /api/avatar serves and the browser caches on its own.
export async function GET(req) {
  await initStore();
  try {
    if (!(await callerEmail(req))) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });

    var accounts = await listUsers().catch(function() { return []; });
    var byEmail = {};
    accounts.forEach(function(a) {
      var k = String((a && a.email) || '').toLowerCase();
      if (k) byEmail[k] = a;
    });

    // Faces and names for one workspace. Unscoped, this handed every screen that
    // lists people the whole account's floor.
    var workspaceId = await effectiveReadWorkspace(req, new URL(req.url).searchParams.get('workspace'));
    var profiles = scopeProfiles(getAllCloserProfiles() || {}, workspaceId);

    // The roster rows an admin created, folded in — the same thing /api/closers
    // already does, and for the same reason. A closer profile is only created by
    // whichever form first carried somebody's email, so a rep onboarded through
    // Team & Permissions does not have one until their first submission. This
    // list is what the rep pickers on every submit form are built from, so
    // without the fold a manager adds three reps and then finds an empty dropdown
    // — with nobody to pick until each of them has already filed something, which
    // is the thing the dropdown exists to make possible.
    var roster = Array.isArray(workspaceId) || workspaceId === ACCESS_ALL
      ? (getStore().workspaceUsers || [])
      : await getWorkspaceUserList(workspaceId).catch(function() { return []; });
    if (Array.isArray(workspaceId)) {
      roster = roster.filter(function(u) { return workspaceId.indexOf(u.workspaceId) !== -1; });
    }
    (roster || []).forEach(function(member) {
      if (!member || !member.email) return;
      var key = String(member.email).toLowerCase();
      if (profiles[key]) {
        // The roster's name only fills a gap. A profile that already has one has
        // been through renameCloser, which is a manager's deliberate correction
        // and outranks whatever the membership row was created with.
        if (member.name && !profiles[key].displayName && !profiles[key].name) {
          profiles[key] = Object.assign({}, profiles[key], { name: member.name });
        }
        return;
      }
      profiles[key] = {
        email: key,
        name: member.name || key.split('@')[0],
        // Deactivated on the roster is off the floor, the same as archived.
        archivedAt: member.active === false ? (member.deactivatedAt || true) : null,
        fromRosterOnly: true,
      };
    });

    var reps = Object.keys(profiles).map(function(email) {
      var profile = profiles[email];
      var account = byEmail[email];
      var identity = repIdentity(profile, email, account && account.name);
      // Only the ownership name set. A profile's stored name is stamped by
      // whichever form first carried the email, so it is regularly somebody
      // else's — and treating it as an alias hands one person's face to another
      // person's row. A rep whose profile name is stale is fixed by renaming the
      // profile, not by guessing around it; the email below is the safe fallback.
      return {
        email: identity.email,
        name: identity.name,
        names: identity.matchNames,
        photo: photoId(email, profile && profile.avatarUrl),
        // Off the roster. Their records still count in every total — this only
        // says they should not be offered as somebody to file a new one against.
        archived: !!(profile && profile.archivedAt),
        status: effectiveStatus(profile),
      };
    });

    return NextResponse.json({ success: true, reps: reps });
  } catch (err) {
    console.error('[api/roster]', err);
    return NextResponse.json({ error: 'Could not load the roster' }, { status: 500 });
  }
}
