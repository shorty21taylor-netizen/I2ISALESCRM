import { NextResponse } from 'next/server';

// Try multiple known Assistro payload formats until one succeeds.
// Format A: {id, message, type} — used by whatsapp.js (legacy integration)
// Format B: {chatId, message} — common chat API shape
// Format C: {msgs: [{number, message, type}]} — official Assistro SyncMate docs
// Format D: {number, message, type} — flat version of official docs
var FORMATS = [
  { name: 'id+message+type', build: function(dest, msg, t) { return { id: dest, message: msg, type: t }; } },
  { name: 'chatId+message', build: function(dest, msg, t) { return { chatId: dest, message: msg, type: t }; } },
  { name: 'msgs-array', build: function(dest, msg, t) { return { msgs: [{ number: dest, message: msg, type: t }] }; } },
  { name: 'number+message+type', build: function(dest, msg, t) { return { number: dest, message: msg, type: t }; } },
  { name: 'phone+body+type', build: function(dest, msg, t) { return { phone: dest, body: msg, type: t }; } },
  { name: 'to+text', build: function(dest, msg, t) { return { to: dest, text: msg, type: t }; } },
];

export async function POST(req) {
  try {
    var body = await req.json();
    if (!body.message || !body.assistroApiUrl || !body.whatsappGroupId) {
      console.log('[WhatsApp] Missing config:', !body.message ? 'message' : '', !body.assistroApiUrl ? 'apiUrl' : '', !body.whatsappGroupId ? 'groupId' : '');
      return NextResponse.json({ sent: false, reason: 'Missing: message, assistroApiUrl, or whatsappGroupId' });
    }

    var apiUrl = body.assistroApiUrl;
    var apiKey = body.assistroApiKey || '';
    var groupId = body.whatsappGroupId;
    var msgType = 2; // group

    console.log('[WhatsApp] Sending to:', groupId, '| URL:', apiUrl);
    console.log('[WhatsApp] Key:', apiKey ? 'YES (' + apiKey.substring(0, 8) + '...)' : 'NONE');

    // Build headers — send both auth styles
    var headers = { 'Content-Type': 'application/json' };
    if (apiKey) {
      headers['Authorization'] = 'Bearer ' + apiKey;
      headers['x-api-key'] = apiKey;
    }

    // Try each format. Stop as soon as one returns 2xx.
    for (var i = 0; i < FORMATS.length; i++) {
      var fmt = FORMATS[i];
      var payload = fmt.build(groupId, body.message, msgType);

      console.log('[WhatsApp] Trying format:', fmt.name);

      var response = await fetch(apiUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload),
      });

      var status = response.status;
      var responseText = await response.text();
      console.log('[WhatsApp]', fmt.name, '→', status, responseText.substring(0, 200));

      if (status >= 200 && status < 300) {
        var result = {};
        try { result = JSON.parse(responseText); } catch (e) { result = { raw: responseText }; }
        console.log('[WhatsApp] SUCCESS with format:', fmt.name);
        return NextResponse.json({ sent: true, status: status, format: fmt.name, result: result });
      }

      // 422 = wrong body shape — try next format
      // 401/403 = auth issue — try next format (might need x-api-key vs Bearer)
      // 404/500 = server issue — still try next just in case
    }

    // All formats failed — return the last attempt's info
    console.error('[WhatsApp] All formats failed');
    return NextResponse.json({
      sent: false,
      error: 'All payload formats returned errors. Check Railway logs for details.',
      hint: 'Go to Railway → Deploy Logs → search for [WhatsApp] to see each format attempt and its response',
    });
  } catch (e) {
    console.error('[WhatsApp] Fetch error:', e.message);
    return NextResponse.json({ sent: false, error: e.message });
  }
}
