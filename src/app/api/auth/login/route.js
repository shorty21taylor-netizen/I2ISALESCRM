import { NextResponse } from 'next/server';
import { initStore, getWorkspaces } from '@/lib/store';
import { authenticate, hasAnyUsers } from '@/lib/users';
import { OWNER_EMAIL } from '@/lib/access';

export var dynamic = 'force-dynamic';

// Sign-in accepts either a personal account password or, for people who predate
// per-user accounts, the shared team password. The shared password keeps the
// existing team working; once someone has an account, theirs takes precedence.
export async function POST(req) {
  await initStore();
  try {
    var body = await req.json();
    var email = (body.email || '').trim().toLowerCase();
    var password = body.password || '';

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    var account = await authenticate(email, password);
    if (account) {
      return NextResponse.json({
        success: true,
        verified: true,
        via: 'account',
        user: { name: account.name, email: account.email, role: account.role },
        workspaceIds: account.workspaceIds,
      });
    }

    // No personal account matched. Fall back to the shared team password, but only
    // for people who don't have an account yet — otherwise a member could bypass
    // their own credentials (and their workspace limits) with the shared one.
    var teamPassword = process.env.TEAM_PASSWORD || 'I2I2026!';
    var isOperator = email === OWNER_EMAIL;
    var accountsExist = await hasAnyUsers();

    if (password === teamPassword) {
      var { getUser } = await import('@/lib/users');
      var existing = await getUser(email);
      if (existing && !isOperator) {
        return NextResponse.json({ verified: false, error: 'Use your own password' }, { status: 401 });
      }
      return NextResponse.json({
        success: true,
        verified: true,
        via: 'team-password',
        user: { name: body.name || email, email: email, role: isOperator ? 'operator' : 'closer' },
        workspaceIds: isOperator ? [] : ['default'],
        accountsExist: accountsExist,
      });
    }

    return NextResponse.json({ verified: false, error: 'Incorrect email or password' }, { status: 401 });
  } catch (e) {
    console.error('[Login]', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
