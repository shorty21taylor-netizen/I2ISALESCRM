import { NextResponse } from 'next/server';
import { sendGroupMessage } from '@/lib/whatsapp';
import { initStore } from '@/lib/store';

export async function POST(req) {
  await initStore();
  try {
    var body = await req.json();
    if (!body.message) {
      return NextResponse.json({ sent: false, error: 'message required' }, { status: 400 });
    }

    // Dynamic mode — caller supplies apiUrl, apiKey, groupId (preferred path for per-form notifications)
    if (body.assistroApiUrl && body.whatsappGroupId) {
      try {
        var response = await fetch(body.assistroApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': body.assistroApiKey ? ('Bearer ' + body.assistroApiKey) : '',
          },
          body: JSON.stringify({
            phone: body.whatsappGroupId,
            body: body.message,
            type: 2,
          }),
        });
        var result = await response.json().catch(function() { return {}; });
        console.log('[WhatsApp Sent]', body.whatsappGroupId, '|', body.message.substring(0, 60));
        return NextResponse.json({ sent: true, result: result });
      } catch (e) {
        console.error('[WhatsApp Error]', e.message);
        return NextResponse.json({ sent: false, error: e.message });
      }
    }

    // Fallback — use server-side saved config (legacy path)
    var legacyResult = await sendGroupMessage(body.message);
    return NextResponse.json({ sent: true, success: true, result: legacyResult });
  } catch (e) {
    return NextResponse.json({ sent: false, error: e.message }, { status: 500 });
  }
}
