import { NextResponse } from 'next/server';
import { registerCloser } from '@/lib/store';

export async function POST(req) {
  try {
    var body = await req.json();
    if (!body.email || !body.name) {
      return NextResponse.json({ error: 'email and name required' }, { status: 400 });
    }
    registerCloser(body.email, body.name);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
