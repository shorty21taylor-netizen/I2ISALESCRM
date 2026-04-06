// Server-side WhatsApp message sender via Assistro API
// type 1 = individual, type 2 = group

var whatsappConfig = {
  assistroApiUrl: '',
  assistroApiKey: '',
  whatsappGroupId: '',
  adminPhone: '',
};

export function setWhatsAppConfig(config) {
  if (config.assistroApiUrl !== undefined) whatsappConfig.assistroApiUrl = config.assistroApiUrl;
  if (config.assistroApiKey !== undefined) whatsappConfig.assistroApiKey = config.assistroApiKey;
  if (config.whatsappGroupId !== undefined) whatsappConfig.whatsappGroupId = config.whatsappGroupId;
  if (config.adminPhone !== undefined) whatsappConfig.adminPhone = config.adminPhone;
}

export function getWhatsAppConfig() {
  return whatsappConfig;
}

export function isWhatsAppConfigured() {
  return !!(whatsappConfig.assistroApiUrl && whatsappConfig.assistroApiKey && whatsappConfig.whatsappGroupId);
}

// Generic send — used by webhook routes directly
export async function sendWhatsApp(apiUrl, apiKey, groupId, message) {
  if (!apiUrl || !groupId || !message) {
    console.log('[WA] Skip — missing:', !apiUrl ? 'apiUrl' : '', !groupId ? 'groupId' : '', !message ? 'message' : '');
    return { sent: false, reason: 'missing config' };
  }
  console.log('[WA] Sending to', groupId.substring(0, 20));
  try {
    var res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey || '',
        'Authorization': apiKey ? 'Bearer ' + apiKey : '',
      },
      body: JSON.stringify({ phone: groupId, body: message, type: 2 }),
    });
    var status = res.status;
    var txt = await res.text();
    if (status === 422) {
      console.log('[WA] 422 — retrying chatId format');
      var r2 = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey || '',
          'Authorization': apiKey ? 'Bearer ' + apiKey : '',
        },
        body: JSON.stringify({ chatId: groupId, message: message }),
      });
      status = r2.status;
      txt = await r2.text();
    }
    console.log('[WA] Result:', status, txt.substring(0, 100));
    return { sent: status >= 200 && status < 300, status: status };
  } catch (e) {
    console.error('[WA] Error:', e.message);
    return { sent: false, error: e.message };
  }
}

export async function sendGroupMessage(message) {
  if (!isWhatsAppConfigured()) {
    console.log('[WhatsApp] Not configured, skipping group message');
    return { skipped: true };
  }
  return sendWhatsApp(whatsappConfig.assistroApiUrl, whatsappConfig.assistroApiKey, whatsappConfig.whatsappGroupId, message);
}

export async function sendDirectMessage(phone, message) {
  if (!whatsappConfig.assistroApiUrl || !whatsappConfig.assistroApiKey) {
    console.log('[WhatsApp] Not configured, skipping direct message');
    return { skipped: true };
  }
  var targetPhone = phone || whatsappConfig.adminPhone;
  if (!targetPhone) {
    console.log('[WhatsApp] No phone number for direct message');
    return { skipped: true };
  }
  try {
    var res = await fetch(whatsappConfig.assistroApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': whatsappConfig.assistroApiKey || '',
        'Authorization': whatsappConfig.assistroApiKey ? 'Bearer ' + whatsappConfig.assistroApiKey : '',
      },
      body: JSON.stringify({ phone: targetPhone, body: message, type: 1 }),
    });
    var status = res.status;
    var txt = await res.text();
    console.log('[WhatsApp] Direct message sent to', targetPhone, '→', status);
    return { sent: status >= 200 && status < 300, status: status };
  } catch (e) {
    console.error('[WhatsApp] Direct send error:', e.message);
    return { sent: false, error: e.message };
  }
}
