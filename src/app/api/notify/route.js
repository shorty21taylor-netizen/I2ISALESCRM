import { NextResponse } from 'next/server';
import { sendGroupMessage } from '@/lib/whatsapp';
import { initStore } from '@/lib/store';

export async function POST(req) {
  await initStore();
  try {
    var body = await req.json();
    if (!body.message) {
      return NextResponse.json({ error: 'message required' }, { status: 400 });
    }
    var result = await sendGroupMessage(body.message);
    return NextResponse.json({ success: true, result: result });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
