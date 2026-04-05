import { NextResponse } from 'next/server';
import { sendDirectMessage } from '@/lib/whatsapp';
import { initStore } from '@/lib/store';

export async function POST(req) {
  await initStore();
  try {
    var body = await req.json();
    if (!body.message) {
      return NextResponse.json({ error: 'message required' }, { status: 400 });
    }
    var result = await sendDirectMessage(body.phone || null, body.message);
    return NextResponse.json({ success: true, result: result });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
