import { NextResponse } from 'next/server';
import { initStore, getAllCloserProfiles } from '@/lib/store';
import { callerEmail } from '@/lib/access';
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
    if (!callerEmail(req)) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });

    var accounts = await listUsers().catch(function() { return []; });
    var byEmail = {};
    accounts.forEach(function(a) {
      var k = String((a && a.email) || '').toLowerCase();
      if (k) byEmail[k] = a;
    });

    var profiles = getAllCloserProfiles() || {};
    var reps = Object.keys(profiles).map(function(email) {
      var profile = profiles[email];
      var account = byEmail[email];
      var identity = repIdentity(profile, email, account && account.name);
      // Two name sets, because finding a face is a weaker claim than owning a
      // record. matchNames is the ownership set, which deliberately drops the
      // profile's own name once a real display name is known — that is what stops
      // a manager who filed on a rep's behalf from inheriting the rep's deals.
      // For a photo that rule is too strict: someone whose records are filed under
      // "Anthony Taylor" but whose profile now reads "Shorty Taylor" is one person,
      // and their row should show their face. So the filed name comes through as a
      // weak alias, which only ever wins a name nothing stronger has claimed.
      var aka = [];
      if (profile && profile.name) aka.push(profile.name);
      if (identity.recordName) aka.push(identity.recordName);

      return {
        email: identity.email,
        name: identity.name,
        names: identity.matchNames,
        aka: aka,
        photo: photoId(email, profile && profile.avatarUrl),
        status: effectiveStatus(profile),
      };
    });

    return NextResponse.json({ success: true, reps: reps });
  } catch (err) {
    console.error('[api/roster]', err);
    return NextResponse.json({ error: 'Could not load the roster' }, { status: 500 });
  }
}
