import { NextResponse } from 'next/server';
import { sendWhatsApp, DIRECT } from '@/lib/assistro-send';

// A direct message rather than a group one — the same sender, type 1. This held
// its own copy of the payload-format list until the send moved into
// assistro-send.js; two copies of that list is how one of them quietly stops
// matching what Assistro accepts.
export async function POST(req) {
  try {
    var body = await req.json();
    var out = await sendWhatsApp({
      apiUrl: body.assistroApiUrl,
      apiKey: body.assistroApiKey,
      target: body.phone,
      message: body.message,
      type: DIRECT,
    });
    return NextResponse.json(out);
  } catch (e) {
    console.error('[WhatsApp] notify-direct route:', e.message);
    return NextResponse.json({ sent: false, error: e.message });
  }
}
