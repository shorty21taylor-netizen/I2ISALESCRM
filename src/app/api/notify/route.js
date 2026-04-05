import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    var body = await req.json();
    if (!body.message || !body.assistroApiUrl || !body.whatsappGroupId) {
      console.log('[WhatsApp] Missing config:',
        !body.message ? 'message' : '',
        !body.assistroApiUrl ? 'apiUrl' : '',
        !body.whatsappGroupId ? 'groupId' : '');
      return NextResponse.json({ sent: false, reason: 'Missing: message, assistroApiUrl, or whatsappGroupId' });
    }

    console.log('[WhatsApp] Sending to:', body.whatsappGroupId);
    console.log('[WhatsApp] API URL:', body.assistroApiUrl);
    console.log('[WhatsApp] Message:', body.message.substring(0, 80) + '...');
    console.log('[WhatsApp] Has API key:', body.assistroApiKey ? 'YES (' + body.assistroApiKey.substring(0, 10) + '...)' : 'NO');

    // Build the payload — include BOTH `body` and `message` field names for compatibility
    var payload = {
      phone: body.whatsappGroupId,
      body: body.message,
      message: body.message,
      type: 2,
    };

    // Include API key in body as fallback for servers that expect it there
    if (body.assistroApiKey) {
      payload.apiKey = body.assistroApiKey;
    }

    // Send with BOTH Authorization: Bearer and x-api-key headers — whichever the server accepts
    var headers = {
      'Content-Type': 'application/json',
    };
    if (body.assistroApiKey) {
      headers['Authorization'] = 'Bearer ' + body.assistroApiKey;
      headers['x-api-key'] = body.assistroApiKey;
    }

    var response = await fetch(body.assistroApiUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload),
    });

    var status = response.status;
    var responseText = await response.text();
    var result = {};
    try { result = JSON.parse(responseText); } catch (e) { result = { raw: responseText }; }

    console.log('[WhatsApp] Response status:', status);
    console.log('[WhatsApp] Response body:', responseText.substring(0, 300));

    if (status >= 200 && status < 300) {
      return NextResponse.json({ sent: true, status: status, result: result });
    } else {
      return NextResponse.json({ sent: false, status: status, result: result, error: 'Assistro returned ' + status });
    }
  } catch (e) {
    console.error('[WhatsApp] Fetch error:', e.message);
    return NextResponse.json({ sent: false, error: e.message });
  }
}
