import { NextResponse } from 'next/server';
import { initStore } from '@/lib/store';
import { verifyTeamPassword } from '@/lib/team-password';

// Legacy endpoint, kept so any older client still works. It now checks the same
// stored team password as /api/auth/login rather than the compiled-in env value,
// so changing the password in Settings takes effect here too.
export async function POST(req) {
  await initStore();
  try {
    var body = await req.json();
    if (!body.password) return NextResponse.json({ error: 'Password required' }, { status: 400 });
    if (!(await verifyTeamPassword(body.password))) {
      return NextResponse.json({ verified: false, error: 'Incorrect' }, { status: 401 });
    }
    return NextResponse.json({ verified: true });
  } catch (e) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
