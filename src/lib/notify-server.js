// One place where a form submission turns into a WhatsApp notification.
//
// Both the in-app forms and the external n8n forms call sendFormNotification, so
// the routing rules (which group, is this form's notification switched on) and the
// message log live in a single spot instead of being copy-pasted per webhook.

import { getWhatsappConfig, addMessageLog } from '@/lib/store';
import { buildMessage } from '@/lib/form-messages';

var GROUP_FIELD = {
  'book-call': 'bookedCallGroupId',
  'close-deal': 'closedDealGroupId',
  'eod-report': 'eodReportGroupId',
};

var ENABLED_FIELD = {
  'book-call': 'bookedCallEnabled',
  'close-deal': 'closedDealEnabled',
  'eod-report': 'eodReportEnabled',
};

function labelFor(formType, entry) {
  if (formType === 'eod-report') return entry.salesRep || '';
  return entry.leadsName || '';
}

// opts: { req, formType, entry, source, override, skipSend, externalMessage, timezone }
export async function sendFormNotification(opts) {
  var formType = opts.formType;
  var entry = opts.entry || {};
  var source = opts.source || 'crm';

  var base = {
    kind: formType,
    source: source,
    recordId: entry.id || '',
    recordLabel: labelFor(formType, entry),
    workspaceId: entry.workspaceId,
  };

  // n8n already posted the message itself — record it so the log stays complete,
  // but don't send a second copy.
  if (opts.skipSend) {
    var logged = addMessageLog(Object.assign({}, base, {
      destination: opts.destination || 'n8n workflow',
      message: opts.externalMessage || buildMessage(formType, entry, opts.timezone),
      status: 'external',
    }));
    return { sent: false, external: true, logId: logged.id };
  }

  var wc = getWhatsappConfig();
  var apiUrl = wc.assistroApiUrl || '';
  var apiKey = wc.assistroApiKey || '';
  var groupId = wc[GROUP_FIELD[formType]] || '';

  // Fallback: credentials pushed with the request (the in-app form does this when
  // the server-side config has not been synced yet).
  var override = opts.override;
  if ((!groupId || !apiUrl) && override && override.groupId) {
    apiUrl = override.apiUrl || apiUrl;
    apiKey = override.apiKey || apiKey;
    groupId = override.groupId;
  }

  // A toggle only counts as "off" once a group is configured, matching how the
  // settings UI presents it.
  var disabled = wc[ENABLED_FIELD[formType]] === false && !!wc[GROUP_FIELD[formType]];

  var message = buildMessage(formType, entry, opts.timezone);

  if (!apiUrl || !groupId || disabled) {
    var reason = disabled ? 'Notification switched off for this form'
      : (!apiUrl ? 'No Assistro API URL configured' : 'No WhatsApp group configured for this form');
    console.log('[Notify] Skipped', formType, '—', reason);
    addMessageLog(Object.assign({}, base, {
      destination: groupId,
      message: message,
      status: 'skipped',
      error: reason,
    }));
    return { sent: false, skipped: true, reason: reason };
  }

  var result = { sent: false };
  var error = '';
  try {
    var res = await fetch(new URL('/api/notify', opts.req.url).href, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assistroApiUrl: apiUrl,
        assistroApiKey: apiKey,
        whatsappGroupId: groupId,
        message: message,
      }),
    });
    result = await res.json().catch(function() { return { sent: false, error: 'Bad response from notifier' }; });
    if (!result.sent) error = result.error || result.reason || 'Send failed';
  } catch (e) {
    error = e.message;
    console.error('[Notify]', formType, 'send error:', e.message);
  }

  var logEntry = addMessageLog(Object.assign({}, base, {
    destination: groupId,
    message: message,
    status: result.sent ? 'sent' : 'failed',
    error: error,
  }));

  return Object.assign({}, result, { logId: logEntry.id });
}
