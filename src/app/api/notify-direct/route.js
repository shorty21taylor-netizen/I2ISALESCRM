import { NextResponse } from 'next/server';

// Same multi-format approach as /api/notify but for direct messages (type 1)
var FORMATS = [
  { name: 'id+message+type', build: function(dest, msg) { return { id: dest, message: msg, type: 1 }; } },
  { name: 'chatId+message', build: function(dest, msg) { return { chatId: dest, message: msg, type: 1 }; } },
  { name: 'msgs-array', build: function(dest, msg) { return { msgs: [{ number: dest, message: msg, type: 1 }] }; } },
  { name: 'number+message+type', build: function(dest, msg) { return { number: dest, message: msg, type: 1 }; } },
  { name: 'phone+body+type', build: function(dest, msg) { return { phone: dest, body: msg, type: 1 }; } },
];

export async function POST(req) {
  try {
    var body = await req.json();
    if (!body.message || !body.assistroApiUrl || !body.phone) {
      return NextResponse.json({ sent: false, reason: 'Missing: message, assistroApiUrl, or phone' });
    }

    var apiUrl = body.assistroApiUrl;
    var apiKey = body.assistroApiKey || '';
    var phone = body.phone;

    console.log('[WhatsApp DM] Sending to:', phone, '| URL:', apiUrl);

    var headers = { 'Content-Type': 'application/json' };
    if (apiKey) {
      headers['Authorization'] = 'Bearer ' + apiKey;
      headers['x-api-key'] = apiKey;
    }

    for (var i = 0; i < FORMATS.length; i++) {
      var fmt = FORMATS[i];
      var payload = fmt.build(phone, body.message);

      console.log('[WhatsApp DM] Trying format:', fmt.name);

      var response = await fetch(apiUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload),
      });

      var status = response.status;
      var responseText = await response.text();
      console.log('[WhatsApp DM]', fmt.name, '→', status, responseText.substring(0, 200));

      if (status >= 200 && status < 300) {
        var result = {};
        try { result = JSON.parse(responseText); } catch (e) { result = { raw: responseText }; }
        console.log('[WhatsApp DM] SUCCESS with format:', fmt.name);
        return NextResponse.json({ sent: true, status: status, format: fmt.name, result: result });
      }
    }

    console.error('[WhatsApp DM] All formats failed');
    return NextResponse.json({ sent: false, error: 'All payload formats failed. Check Railway logs.' });
  } catch (e) {
    console.error('[WhatsApp DM] Error:', e.message);
    return NextResponse.json({ sent: false, error: e.message });
  }
}
