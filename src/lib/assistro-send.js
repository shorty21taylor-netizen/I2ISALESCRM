// The one place this product talks to Assistro.
//
// Every server-side sender used to reach WhatsApp by making an HTTP request to
// this app's own /api/notify route — `fetch(new URL('/api/notify', req.url))`.
// That works on a laptop and fails on Railway, where the container cannot open a
// connection to its own public hostname: every in-app submission and every
// test-send came back `fetch failed`, while the Settings test button kept working
// because that one is fired by the browser, not by the server.
//
// So the send happens here, in-process, and /api/notify is now a thin wrapper
// over the same function rather than a hop that has to be reachable.

// Assistro has shipped several payload shapes and installs differ, so each is
// tried until one is accepted. The order is oldest-known-good first.
var FORMATS = [
  { name: 'id+message+type', build: function(dest, msg, t) { return { id: dest, message: msg, type: t }; } },
  { name: 'chatId+message', build: function(dest, msg, t) { return { chatId: dest, message: msg, type: t }; } },
  { name: 'msgs-array', build: function(dest, msg, t) { return { msgs: [{ number: dest, message: msg, type: t }] }; } },
  { name: 'number+message+type', build: function(dest, msg, t) { return { number: dest, message: msg, type: t }; } },
  { name: 'phone+body+type', build: function(dest, msg, t) { return { phone: dest, body: msg, type: t }; } },
  { name: 'to+text', build: function(dest, msg, t) { return { to: dest, text: msg, type: t }; } },
];

// A key pasted out of a dashboard often arrives with a trailing space or a
// newline, and a URL with a stray one around it. Either turns a working
// credential into a 401 nobody can explain, so both are trimmed on the way in.
function clean(v) {
  return String(v === null || v === undefined ? '' : v).trim();
}

// `fetch failed` on its own says nothing. Node hangs the real reason off .cause,
// which is the difference between "DNS did not resolve" and "the certificate was
// rejected" — the thing somebody actually needs to read at 9pm.
function describe(e) {
  var parts = [];
  if (e && e.message) parts.push(e.message);
  var cause = e && e.cause;
  if (cause) {
    if (cause.code) parts.push(cause.code);
    if (cause.message && cause.message !== (e && e.message)) parts.push(cause.message);
  }
  return parts.join(' — ') || 'Send failed';
}

// type 2 is a group, type 1 a direct message — Assistro's own numbering.
export var GROUP = 2;
export var DIRECT = 1;

export async function sendWhatsApp(opts) {
  var apiUrl = clean(opts && opts.apiUrl);
  var apiKey = clean(opts && opts.apiKey);
  var target = clean(opts && opts.target);
  var message = (opts && opts.message) || '';
  var type = (opts && opts.type) || GROUP;

  if (!apiUrl) return { sent: false, reason: 'No Assistro API URL configured' };
  if (!target) return { sent: false, reason: 'No destination to send to' };
  if (!message) return { sent: false, reason: 'Nothing to send' };

  // Both auth styles, because installs differ on which one they read.
  var headers = { 'Content-Type': 'application/json' };
  if (apiKey) {
    headers.Authorization = 'Bearer ' + apiKey;
    headers['x-api-key'] = apiKey;
  }

  var lastStatus = 0;
  var lastBody = '';
  var transportError = '';

  for (var i = 0; i < FORMATS.length; i++) {
    var fmt = FORMATS[i];
    try {
      var response = await fetch(apiUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(fmt.build(target, message, type)),
      });
      lastStatus = response.status;
      lastBody = await response.text();

      if (response.status >= 200 && response.status < 300) {
        var result = {};
        try { result = JSON.parse(lastBody); } catch (e) { result = { raw: lastBody }; }
        console.log('[WhatsApp] sent to', target, 'via', fmt.name);
        return { sent: true, status: response.status, format: fmt.name, result: result };
      }
      console.log('[WhatsApp]', fmt.name, '->', response.status, String(lastBody).slice(0, 160));
    } catch (e) {
      // A transport failure hits every format the same way, so there is nothing
      // to learn from trying the remaining five.
      transportError = describe(e);
      console.error('[WhatsApp] could not reach', apiUrl, '-', transportError);
      return { sent: false, error: 'Could not reach the WhatsApp sender: ' + transportError };
    }
  }

  console.error('[WhatsApp] every payload shape refused by', apiUrl, '- last status', lastStatus);
  return {
    sent: false,
    status: lastStatus,
    error: 'The WhatsApp sender refused every payload shape (last status ' + lastStatus + ').',
    detail: String(lastBody).slice(0, 300),
  };
}
