import { NextResponse } from 'next/server';
import { initStore, confirmDisplayName, getDisplayNameState } from '@/lib/store';
import { resolveAccess } from '@/lib/access';

export var dynamic = 'force-dynamic';

// The name a rep confirms for themselves, once, on their first sign-in. It is
// what their closes and EODs get filed under, which is why only an admin can
// change it afterwards — and why it is taken from a signed-in session rather
// than from whatever the sign-in form happened to carry.
export async function POST(req) {
  await initStore();
  var access = await resolveAccess(req);
  if (!access.email) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });

  var body = await req.json().catch(function() { return {}; });
  var name = String(body.name || '').trim().replace(/\s+/g, ' ');

  if (!name) return NextResponse.json({ error: 'Your full name is required' }, { status: 400 });
  if (name.indexOf('@') !== -1 || name.toLowerCase() === access.email) {
    return NextResponse.json({ error: 'Use your name, not your email address' }, { status: 400 });
  }
  if (name.length > 80) {
    return NextResponse.json({ error: 'That is longer than a name needs to be' }, { status: 400 });
  }

  var state = getDisplayNameState(access.email);
  if (state.confirmedAt) {
    // Asked once. After that it is an admin's to change, so a second post is a
    // no-op rather than a quiet rename.
    return NextResponse.json({ success: true, alreadyConfirmed: true, name: state.displayName });
  }

  confirmDisplayName(access.email, name);
  return NextResponse.json({ success: true, name: name });
}
