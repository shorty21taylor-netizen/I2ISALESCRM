import { NextResponse } from 'next/server';
import { registerCloser, getAllCloserProfiles, initStore } from '@/lib/store';

export async function POST(req) {
  try {
    await initStore();
    var body = await req.json();
    if (!body.email || !body.name) {
      return NextResponse.json({ error: 'email and name required' }, { status: 400 });
    }
    var profile = registerCloser(body.email, body.name);
    console.log('[Register]', body.name, '-', body.email);
    return NextResponse.json({ success: true, profile: profile });
  } catch (e) {
    console.error('[Register Error]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ success: true, closers: getAllCloserProfiles() });
}
