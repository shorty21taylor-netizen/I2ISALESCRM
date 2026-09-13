import { NextResponse } from 'next/server';
import { initStore, registerCloser } from '@/lib/store';
import { getUser, createUser, updateUser, authenticate } from '@/lib/users';
import { verifyTeamPassword } from '@/lib/team-password';
import { OWNER_EMAIL } from '@/lib/access';

export var dynamic = 'force-dynamic';

var MIN = 8;

// Claiming an account, or changing the password on one you already hold.
//
// Two ways in, and the difference matters:
//
//   You already have a password  -> you must produce it. The shared team
//     password is explicitly NOT accepted here, because everyone on the floor
//     knows it; if it could overwrite a personal password, then "personal"
//     would mean nothing and any rep could take over the owner's account.
//
//   You do not have one yet      -> the shared team password proves you belong
//     here, and you set your own. This is the migration path for everyone who
//     has been signing in with a name and the shared secret, and it is one-way:
//     once you have your own, the shared one stops working for you.
export async function POST(req) {
  await initStore();
  try {
    var body = await req.json();
    var email = (body.email || '').trim().toLowerCase();
    var next = String(body.newPassword || '');
    var name = String(body.name || '').trim();

    if (!email || !next) {
      return NextResponse.json({ error: 'Email and a new password are required' }, { status: 400 });
    }
    if (next.length < MIN) {
      return NextResponse.json({ error: 'Use at least ' + MIN + ' characters' }, { status: 400 });
    }

    var existing = await getUser(email);
    var hasPassword = !!(existing && existing.passwordHash);

    if (hasPassword) {
      var proven = await authenticate(email, String(body.currentPassword || ''));
      if (!proven) {
        return NextResponse.json({
          error: 'That current password is not right. The team password cannot be used here.',
        }, { status: 401 });
      }
      await updateUser(email, { password: next });
      var after = await getUser(email);
      return NextResponse.json({
        success: true,
        changed: true,
        user: { name: after.name, email: after.email, role: after.role },
      });
    }

    if (!(await verifyTeamPassword(String(body.teamPassword || '')))) {
      return NextResponse.json({
        error: 'That team password is not right — ask whoever set your seat up.',
      }, { status: 401 });
    }
    if (!name) {
      return NextResponse.json({ error: 'Your full name is required' }, { status: 400 });
    }
    // Belt and braces with the client: a profile named after an inbox is the
    // thing the whole board then has to live with.
    if (name.toLowerCase() === email || name.indexOf('@') !== -1) {
      return NextResponse.json({ error: 'Use your name, not your email address' }, { status: 400 });
    }

    var created;
    if (existing) {
      // An account made by an admin invite that has never been claimed. Keep the
      // role and workspaces they were given; only the password is new. The name
      // an admin set stands — it is the one the records are filed under.
      await updateUser(email, { password: next, name: existing.name || name });
      created = await getUser(email);
    } else {
      created = await createUser({
        email: email,
        name: name,
        password: next,
        role: email === OWNER_EMAIL ? 'admin' : 'closer',
        workspaceIds: email === OWNER_EMAIL ? [] : ['default'],
      });
    }

    // One closer profile per email, named from the account. This is the seam the
    // duplicates used to come through: sign-in took a typed name and stamped it
    // on a profile, so one person spelling themselves two ways became two people.
    registerCloser(email, created.name);

    return NextResponse.json({
      success: true,
      created: !existing,
      user: { name: created.name, email: created.email, role: created.role },
    });
  } catch (e) {
    console.error('[Set password]', e);
    return NextResponse.json({ error: e.message || 'Server error' }, { status: 500 });
  }
}
