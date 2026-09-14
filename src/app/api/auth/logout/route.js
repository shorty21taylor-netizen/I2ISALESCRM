import { NextResponse } from 'next/server';
import { clearSession } from '@/lib/session';

export var dynamic = 'force-dynamic';

// Nothing to look up: the cookie is the session, so dropping it ends it.
export async function POST() {
  return clearSession(NextResponse.json({ success: true }));
}
