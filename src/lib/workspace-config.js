// What a workspace shows on its Submit page, and where those submissions go.
//
// All three of these used to be global — one `forms` row in app_config, one
// `whatsappConfig` object, one set of group ids — which is how a brand new
// workspace came up wearing another company's forms, another company's booking
// link, and another company's WhatsApp groups. A closer on the new offer logging
// a deal would have posted it into the old offer's group.
//
// So: nothing is inherited and nothing is defaulted. A new workspace starts empty
// and stays empty until somebody sets it up on purpose. Where a destination is
// missing the submission is refused, because the alternative — quietly sending it
// somewhere — is the bug this module exists to make impossible.

import {
  loadWorkspaceForms, loadWorkspaceIntegrations, loadWorkspaceRoutes,
  saveWorkspaceForm, softDeleteWorkspaceForm,
  saveWorkspaceIntegration, softDeleteWorkspaceIntegration,
  saveWorkspaceRoute, softDeleteWorkspaceRoute,
} from '@/lib/db';
import crypto from 'crypto';

export var ICONS = ['phone', 'dollar', 'clipboard-check', 'document', 'calendar'];
export var AUDIENCES = ['all', 'setter', 'closer', 'manager'];
export var CHANNELS = ['whatsapp', 'slack', 'email', 'none'];

// The message a rep sees when their workspace was never finished. It names what
// is wrong and who fixes it, because "something went wrong" would have them
// retrying a submission that can never succeed.
export var NO_ROUTE_MESSAGE =
  'This form has no destination set for your workspace. Ask an admin to finish setup.';

export var EMPTY_FORMS_MESSAGE =
  'No forms set up for this workspace yet. Submit forms and their destinations are '
  + 'set per workspace. An admin can add them in Workspace settings.';

// In-memory mirror, written through to Postgres — the same shape as the rest of
// this store. Reads never wait on the database, and a database that is briefly
// unreachable does not empty every workspace's Submit page and start refusing
// submissions, which is what a read-through cache would have done here.
var state = { forms: [], integrations: [], routes: [] };
var loaded = false;
var loading = null;

async function load() {
  if (loaded) return state;
  if (loading) return loading;

  loading = (async function() {
    try {
      var forms = await loadWorkspaceForms();
      var integrations = await loadWorkspaceIntegrations();
      var routes = await loadWorkspaceRoutes();
      // Rows from the database win over anything held in memory from before it
      // came back; nothing is merged, because the database is the record.
      if (forms || integrations || routes) {
        state = { forms: forms || [], integrations: integrations || [], routes: routes || [] };
      }
      loaded = true;
    } catch (e) {
      // Leave `loaded` false so the next read retries rather than serving an
      // empty workspace forever.
      console.error('[Workspace config] load failed, will retry:', e.message);
    } finally {
      loading = null;
    }
    return state;
  })();

  return loading;
}

// Only for tests and for a forced re-read; ordinary writes keep memory in step
// themselves rather than dropping it on the floor and re-fetching.
export function invalidate() { loaded = false; }

function putRow(list, row, matches) {
  for (var i = 0; i < list.length; i++) {
    if (matches(list[i])) { list[i] = row; return; }
  }
  list.push(row);
}

function dropRow(list, matches) {
  for (var i = list.length - 1; i >= 0; i--) {
    if (matches(list[i])) list.splice(i, 1);
  }
}

function ws(id) { return String(id || 'default'); }

// ---- forms ----

function shapeForm(row) {
  return {
    formKey: row.form_key,
    label: row.label,
    description: row.description || '',
    audience: row.audience || 'all',
    formUrl: row.form_url || '',
    icon: row.icon || 'clipboard',
    accent: row.accent || 'neutral',
    destinationLabel: row.destination_label || '',
    sortOrder: row.sort_order || 0,
    isActive: row.is_active !== false,
  };
}

export async function listForms(workspaceId, opts) {
  var all = await load();
  var id = ws(workspaceId);
  var rows = all.forms.filter(function(r) { return r.workspace_id === id; });
  if (!(opts && opts.includeInactive)) {
    rows = rows.filter(function(r) { return r.is_active !== false; });
  }
  return rows
    .slice()
    .sort(function(a, b) { return (a.sort_order || 0) - (b.sort_order || 0); })
    .map(shapeForm);
}

export async function upsertForm(workspaceId, form) {
  var key = String(form.formKey || '').trim();
  if (!key) return { error: 'A form needs a key.' };
  if (AUDIENCES.indexOf(form.audience || 'all') === -1) return { error: 'Unknown audience.' };

  await load();
  var id = ws(workspaceId);
  var row = {
    workspace_id: id,
    form_key: key,
    label: String(form.label || '').trim() || key,
    description: String(form.description || '').trim(),
    audience: form.audience || 'all',
    form_url: String(form.formUrl || '').trim(),
    icon: ICONS.indexOf(form.icon) === -1 ? 'clipboard' : form.icon,
    accent: String(form.accent || 'neutral'),
    destination_label: String(form.destinationLabel || '').trim(),
    sort_order: parseInt(form.sortOrder, 10) || 0,
    is_active: form.isActive !== false,
  };
  putRow(state.forms, row, function(r) { return r.workspace_id === id && r.form_key === key; });

  await saveWorkspaceForm({
    workspaceId: id, formKey: key, label: row.label, description: row.description,
    audience: row.audience, formUrl: row.form_url, icon: row.icon, accent: row.accent,
    destinationLabel: row.destination_label, sortOrder: row.sort_order, isActive: row.is_active,
  }).catch(function(e) { console.error('[Workspace config] save form:', e.message); });

  return { success: true };
}

export async function removeForm(workspaceId, formKey) {
  await load();
  var id = ws(workspaceId);
  dropRow(state.forms, function(r) { return r.workspace_id === id && r.form_key === formKey; });
  await softDeleteWorkspaceForm(id, formKey)
    .catch(function(e) { console.error('[Workspace config] delete form:', e.message); });
  return { success: true };
}

// ---- the form ingest key ----
//
// A workspace's ingest key lives with its other integrations, and it is what binds
// a hosted form to this workspace and no other. It is defined here rather than in
// ingest-auth.js so that createWorkspace() can seal a new workspace on the way in
// without importing the auth layer, which reads back out of the store.

export var INGEST_PROVIDER = 'summit';
export var INGEST_KEY_NAME = 'ingest_key';

// Prefixed with the workspace it belongs to, so a key found loose in an n8n node
// can be traced without having to try it against anything.
export function newIngestKey(workspaceId) {
  var tag = String(workspaceId || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 12) || 'ws';
  return 'sk_' + tag + '_' + crypto.randomBytes(24).toString('hex');
}

export async function getIngestKeyFor(workspaceId) {
  return getIntegration(workspaceId, INGEST_PROVIDER, INGEST_KEY_NAME);
}

// Seal a workspace. Idempotent by default: an existing key is returned untouched,
// so this can be called on every boot without rotating a key that is already in
// somebody's n8n workflow. Pass { rotate: true } to deliberately replace it.
export async function sealWorkspace(workspaceId, opts) {
  var existing = await getIngestKeyFor(workspaceId).catch(function() { return ''; });
  if (existing && !(opts && opts.rotate)) return { key: existing, created: false };
  var key = newIngestKey(workspaceId);
  var result = await upsertIntegration(workspaceId, INGEST_PROVIDER, INGEST_KEY_NAME, key);
  if (result && result.error) return { error: result.error };
  return { key: key, created: true };
}

// ---- integrations ----

export async function listIntegrations(workspaceId) {
  var all = await load();
  var id = ws(workspaceId);
  return all.integrations
    .filter(function(r) { return r.workspace_id === id; })
    .map(function(r) {
      return { provider: r.provider, configKey: r.config_key, configValue: r.config_value, updatedAt: r.updated_at };
    });
}

export async function getIntegration(workspaceId, provider, configKey) {
  var rows = await listIntegrations(workspaceId);
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].provider === provider && rows[i].configKey === configKey) return rows[i].configValue;
  }
  return '';
}

// Which workspace owns this integration value? The reverse lookup, for inbound
// webhooks that arrive carrying a provider's own id and nothing else.
//
// Returns '' when nothing matches — and the callers treat that as "do nothing",
// never as "use the first workspace". Guessing here would file one client's
// appointments into another client's books.
export async function workspaceForIntegrationValue(provider, configKey, configValue) {
  var value = String(configValue == null ? '' : configValue).trim();
  if (!value) return '';
  var all = await load();
  var hits = all.integrations.filter(function(r) {
    return r.provider === provider
      && r.config_key === configKey
      && String(r.config_value || '').trim() === value;
  });
  // Two workspaces claiming the same location id is a configuration mistake, and
  // picking one of them at random is exactly the leak this lookup exists to avoid.
  if (hits.length !== 1) {
    if (hits.length > 1) {
      console.error('[Workspace config] ' + provider + '/' + configKey + ' "' + value
        + '" is claimed by ' + hits.length + ' workspaces — refusing to guess');
    }
    return '';
  }
  return hits[0].workspace_id || '';
}

export async function upsertIntegration(workspaceId, provider, configKey, configValue) {
  var p = String(provider || '').trim();
  var k = String(configKey || '').trim();
  if (!p || !k) return { error: 'An integration needs a provider and a key.' };
  await load();
  var id = ws(workspaceId);
  var value = String(configValue == null ? '' : configValue);
  putRow(state.integrations,
    { workspace_id: id, provider: p, config_key: k, config_value: value, updated_at: new Date().toISOString() },
    function(r) { return r.workspace_id === id && r.provider === p && r.config_key === k; });

  await saveWorkspaceIntegration({ workspaceId: id, provider: p, configKey: k, configValue: value })
    .catch(function(e) { console.error('[Workspace config] save integration:', e.message); });
  return { success: true };
}

export async function removeIntegration(workspaceId, provider, configKey) {
  await load();
  var id = ws(workspaceId);
  dropRow(state.integrations, function(r) {
    return r.workspace_id === id && r.provider === provider && r.config_key === configKey;
  });
  await softDeleteWorkspaceIntegration(id, provider, configKey)
    .catch(function(e) { console.error('[Workspace config] delete integration:', e.message); });
  return { success: true };
}

// The one integration the Submit page reads directly. Absent means the booking
// card is not rendered at all — not rendered empty, and never rendered with
// somebody else's calendar in it.
export async function bookingLinkFor(workspaceId) {
  var url = await getIntegration(workspaceId, 'gohighlevel', 'round_robin_booking_url');
  if (!url) return null;
  var label = await getIntegration(workspaceId, 'gohighlevel', 'round_robin_label');
  var blurb = await getIntegration(workspaceId, 'gohighlevel', 'round_robin_blurb');
  return {
    url: url,
    label: label || 'Round Robin Booking Link',
    blurb: blurb || '',
  };
}

// ---- routes ----

export async function listRoutes(workspaceId) {
  var all = await load();
  var id = ws(workspaceId);
  return all.routes
    .filter(function(r) { return r.workspace_id === id; })
    .map(function(r) {
      return { formKey: r.form_key, channel: r.channel, target: r.target, isActive: r.is_active !== false };
    });
}

export async function upsertRoute(workspaceId, formKey, channel, target, isActive) {
  var key = String(formKey || '').trim();
  if (!key) return { error: 'A route needs a form.' };
  if (CHANNELS.indexOf(channel) === -1) return { error: 'Unknown channel.' };
  // 'none' is a real answer — "this form deliberately notifies nowhere" — so it
  // is the one channel that does not need a target.
  var t = String(target || '').trim();
  if (channel !== 'none' && !t) return { error: 'A destination is required for that channel.' };

  await load();
  var id = ws(workspaceId);
  var finalTarget = channel === 'none' ? 'none' : t;
  var live = isActive !== false;
  // One destination per form. Switching a form from WhatsApp to email should
  // move it, not leave the old channel quietly still live alongside the new one.
  dropRow(state.routes, function(r) { return r.workspace_id === id && r.form_key === key; });
  state.routes.push({ workspace_id: id, form_key: key, channel: channel, target: finalTarget, is_active: live });

  await saveWorkspaceRoute({
    workspaceId: id, formKey: key, channel: channel, target: finalTarget, isActive: live,
  }).catch(function(e) { console.error('[Workspace config] save route:', e.message); });
  return { success: true };
}

export async function removeRoute(workspaceId, formKey, channel) {
  await load();
  var id = ws(workspaceId);
  dropRow(state.routes, function(r) {
    return r.workspace_id === id && r.form_key === formKey && r.channel === channel;
  });
  await softDeleteWorkspaceRoute(id, formKey, channel)
    .catch(function(e) { console.error('[Workspace config] delete route:', e.message); });
  return { success: true };
}

// The whole point of this module.
//
// Returns { ok: true, route } when there is somewhere to send this, { ok: true,
// silent: true } when the workspace has said in so many words that this form goes
// nowhere, and { ok: false } otherwise. There is no fourth branch — in particular
// there is no default, no environment variable, and no other workspace's target.
export async function resolveRoute(workspaceId, formKey) {
  var routes = await listRoutes(workspaceId);
  var match = null;
  for (var i = 0; i < routes.length; i++) {
    if (routes[i].formKey !== formKey) continue;
    if (!routes[i].isActive) continue;
    match = routes[i];
    break;
  }
  if (!match) return { ok: false, reason: NO_ROUTE_MESSAGE };
  if (match.channel === 'none') return { ok: true, silent: true, route: match };
  return { ok: true, route: match };
}

// Active forms whose submissions would be refused. The admin screen leads with
// this, because a live form with no destination is a trap for whoever uses it.
export async function formsMissingRoutes(workspaceId) {
  var forms = await listForms(workspaceId);
  var routes = await listRoutes(workspaceId);
  return forms.filter(function(f) {
    for (var i = 0; i < routes.length; i++) {
      if (routes[i].formKey === f.formKey && routes[i].isActive) return false;
    }
    return true;
  }).map(function(f) { return f.formKey; });
}

// The one way config crosses a workspace boundary: an admin asks for it, by name,
// and gets told what was copied. Routes are never included — a destination is the
// one thing that must be typed in by somebody looking at the right group.
export async function copySetupFrom(sourceWorkspaceId, targetWorkspaceId) {
  if (!sourceWorkspaceId || !targetWorkspaceId || sourceWorkspaceId === targetWorkspaceId) {
    return { error: 'Pick a different workspace to copy from.' };
  }
  var forms = await listForms(sourceWorkspaceId, { includeInactive: true });
  var integrations = await listIntegrations(sourceWorkspaceId);

  for (var i = 0; i < forms.length; i++) {
    await upsertForm(targetWorkspaceId, forms[i]);
  }
  for (var j = 0; j < integrations.length; j++) {
    await upsertIntegration(targetWorkspaceId, integrations[j].provider,
      integrations[j].configKey, integrations[j].configValue);
  }
  return {
    success: true,
    forms: forms.length,
    integrations: integrations.length,
    routes: 0,
    note: 'Forms and integrations were copied. Destinations were not — set each one by hand '
      + 'so nothing posts into the wrong group.',
  };
}

// Where this form's messages have actually been going.
//
// A WhatsApp group id is not something anybody can read off their screen —
// WhatsApp shows a group's name and never its address. But every notification
// this CRM has ever sent recorded the destination it went to, so the answer to
// "which group is the after-call one?" is already in the message log. This digs
// it out rather than asking somebody to go hunting in n8n.
export function suggestedTargets(messageLog, workspaceId, formKey) {
  var id = ws(workspaceId);
  var seen = {};
  var out = [];
  (messageLog || []).forEach(function(row) {
    if (!row || row.kind !== formKey) return;
    if ((row.workspaceId || 'default') !== id) return;
    var target = String(row.destination || '').trim();
    // Only real addresses: the log also carries 'none', 'n8n workflow' and the
    // blank left by a refused send.
    if (!target || target === 'none' || target.indexOf('@') === -1) return;
    if (seen[target]) { seen[target].count++; return; }
    seen[target] = { target: target, count: 1, lastSeen: row.sentAt, status: row.status };
    out.push(seen[target]);
  });
  // Most recently used first — if a group was ever changed, the current one wins.
  return out.sort(function(a, b) { return String(b.lastSeen).localeCompare(String(a.lastSeen)); }).slice(0, 3);
}

// Every WhatsApp group id this install knows about, wherever it is held.
//
// A group id cannot be read off a screen — WhatsApp shows a group's name and
// never its address — so the only way to answer "which one is the after-call
// group?" from inside the product is to show what has already been recorded.
// Three places hold one: the global config that predates per-workspace routing,
// the routes already configured on any workspace, and the destination stamped on
// every message the CRM has sent.
export function knownGroupIds(opts) {
  var seen = {};
  var out = [];

  function note(id, label, source) {
    var target = String(id || '').trim();
    if (!target || target === 'none' || target.indexOf('@') === -1) return;
    if (seen[target]) {
      if (label && seen[target].labels.indexOf(label) === -1) seen[target].labels.push(label);
      return;
    }
    seen[target] = { id: target, labels: label ? [label] : [], source: source };
    out.push(seen[target]);
  }

  var wc = (opts && opts.whatsappConfig) || {};
  note(wc.bookedCallGroupId, 'Booked calls', 'the original WhatsApp settings');
  note(wc.closedDealGroupId, 'Closed deals', 'the original WhatsApp settings');
  note(wc.eodReportGroupId, 'EOD reports', 'the original WhatsApp settings');
  note(wc.afterCallGroupId, 'After-call reports', 'the original WhatsApp settings');
  note(wc.whatsappGroupId, 'Everything (legacy single group)', 'the original WhatsApp settings');

  ((opts && opts.routes) || []).forEach(function(r) {
    note(r.target, r.formKey, 'a route on ' + (r.workspaceName || 'another workspace'));
  });

  ((opts && opts.messageLog) || []).forEach(function(r) {
    if (!r) return;
    note(r.destination, r.kind, 'a message the CRM sent');
  });

  return out;
}
