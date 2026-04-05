import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    var body = await req.json();
    if (!body.message || !body.assistroApiUrl || !body.phone) {
      console.log('[WhatsApp DM] Missing config:',
        !body.message ? 'message' : '',
        !body.assistroApiUrl ? 'apiUrl' : '',
        !body.phone ? 'phone' : '');
      return NextResponse.json({ sent: false, reason: 'Missing: message, assistroApiUrl, or phone' });
    }

    console.log('[WhatsApp DM] Sending to:', body.phone);
    console.log('[WhatsApp DM] API URL:', body.assistroApiUrl);

    var payload = {
      phone: body.phone,
      body: body.message,
      message: body.message,
      type: 1,
    };
    if (body.assistroApiKey) payload.apiKey = body.assistroApiKey;

    var headers = { 'Content-Type': 'application/json' };
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

    console.log('[WhatsApp DM] Status:', status, '| Response:', responseText.substring(0, 200));

    return NextResponse.json({ sent: status >= 200 && status < 300, status: status, result: result });
  } catch (e) {
    console.error('[WhatsApp DM] Error:', e.message);
    return NextResponse.json({ sent: false, error: e.message });
  }
}
