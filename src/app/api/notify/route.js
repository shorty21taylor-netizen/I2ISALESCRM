import { NextResponse } from 'next/server';
import { sendWhatsApp, GROUP } from '@/lib/assistro-send';

// The browser's way in. Everything server-side calls sendWhatsApp directly —
// this route exists for the Settings page's own test buttons, which fire from
// the browser. It used to hold the send logic itself, which is why the server
// reached WhatsApp by making an HTTP request to this very URL, something the
// Railway container cannot do to its own public hostname.
export async function POST(req) {
  try {
    var body = await req.json();
    var out = await sendWhatsApp({
      apiUrl: body.assistroApiUrl,
      apiKey: body.assistroApiKey,
      target: body.whatsappGroupId,
      message: body.message,
      type: GROUP,
    });
    return NextResponse.json(out);
  } catch (e) {
    console.error('[WhatsApp] notify route:', e.message);
    return NextResponse.json({ sent: false, error: e.message });
  }
}
