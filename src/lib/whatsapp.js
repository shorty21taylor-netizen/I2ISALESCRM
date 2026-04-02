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

export async function sendGroupMessage(message) {
  if (!isWhatsAppConfigured()) {
    console.log('[WhatsApp] Not configured, skipping group message');
    return { skipped: true };
  }
  try {
    var res = await fetch(whatsappConfig.assistroApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + whatsappConfig.assistroApiKey,
      },
      body: JSON.stringify({
        id: whatsappConfig.whatsappGroupId,
        message: message,
        type: 2,
      }),
    });
    var data = await res.json();
    console.log('[WhatsApp] Group message sent:', message.substring(0, 50) + '...');
    return data;
  } catch (e) {
    console.error('[WhatsApp] Group send error:', e.message);
    return { error: e.message };
  }
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
        'Authorization': 'Bearer ' + whatsappConfig.assistroApiKey,
      },
      body: JSON.stringify({
        id: targetPhone,
        message: message,
        type: 1,
      }),
    });
    var data = await res.json();
    console.log('[WhatsApp] Direct message sent to', targetPhone);
    return data;
  } catch (e) {
    console.error('[WhatsApp] Direct send error:', e.message);
    return { error: e.message };
  }
}
