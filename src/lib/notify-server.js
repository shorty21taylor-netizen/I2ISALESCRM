// One place where a form submission turns into a WhatsApp notification.
//
// Both the in-app forms and the external n8n forms call sendFormNotification, so
// the routing rules and the message log live in a single spot instead of being
// copy-pasted per webhook.
//
// The destination comes from that workspace's own routes and from nowhere else.
// It used to come from one global config, which meant a workspace that had never
// been set up inherited whichever groups were configured last — a closer on a new
// offer would have posted their deal into a different company's WhatsApp group.
// There is now no default, no environment fallback, and no way for the caller to
// supply a target: no route means no send, and the submission is refused upstream.

import { getWhatsappConfig, addMessageLog } from '@/lib/store';
import { buildMessage } from '@/lib/form-messages';
import { resolveRoute } from '@/lib/workspace-config';

function labelFor(formType, entry) {
  if (formType === 'eod-report') return entry.salesRep || '';
  return entry.leadsName || '';
}

// opts: { req, formType, entry, source, skipSend, externalMessage, timezone }
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

  // The destination, resolved from this workspace's routes alone. The caller does
  // not get to supply one: an override parameter here was how a client could name
  // its own group, which is the same misroute wearing a different hat.
  var workspaceId = entry.workspaceId || opts.workspaceId || 'default';
  var resolved = await resolveRoute(workspaceId, formType);
  var message = buildMessage(formType, entry, opts.timezone);

  if (!resolved.ok) {
    console.log('[Notify] Refused', formType, 'in workspace', workspaceId, '— no route configured');
    addMessageLog(Object.assign({}, base, {
      destination: '', message: message, status: 'skipped', error: resolved.reason,
    }));
    return { sent: false, skipped: true, unrouted: true, reason: resolved.reason };
  }

  // The workspace said, in so many words, that this form notifies nowhere. That is
  // a configured answer, not a missing one, so the submission stands.
  if (resolved.silent) {
    addMessageLog(Object.assign({}, base, {
      destination: 'none', message: message, status: 'skipped',
      error: 'This form is set to notify nowhere.',
    }));
    return { sent: false, skipped: true, silent: true };
  }

  var route = resolved.route;
  if (route.channel !== 'whatsapp') {
    // Only WhatsApp has a sender wired up today. Anything else is recorded rather
    // than quietly dropped or, worse, sent over the one channel that does work.
    addMessageLog(Object.assign({}, base, {
      destination: route.target, message: message, status: 'skipped',
      error: 'The ' + route.channel + ' channel is configured but not yet wired up to send.',
    }));
    return { sent: false, skipped: true, reason: 'Channel not supported yet: ' + route.channel };
  }

  var wc = getWhatsappConfig();
  var apiUrl = wc.assistroApiUrl || '';
  var apiKey = wc.assistroApiKey || '';
  var groupId = route.target;

  if (!apiUrl) {
    var reason = 'No Assistro API URL configured';
    console.log('[Notify] Skipped', formType, '—', reason);
    addMessageLog(Object.assign({}, base, {
      destination: groupId, message: message, status: 'skipped', error: reason,
    }));
    return { sent: false, skipped: true, reason: reason };
  }

  // Every outbound post names its workspace and its resolved target, so a misroute
  // is traceable to the row that caused it rather than inferred afterwards.
  console.log('[Notify] ' + formType + ' | workspace=' + workspaceId
    + ' | channel=' + route.channel + ' | target=' + groupId);

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
    channel: route.channel,
    message: message,
    status: result.sent ? 'sent' : 'failed',
    error: error,
  }));

  return Object.assign({}, result, { logId: logEntry.id });
}
