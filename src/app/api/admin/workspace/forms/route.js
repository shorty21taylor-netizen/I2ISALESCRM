import { NextResponse } from 'next/server';
import { initStore, getWorkspace, getWorkspaces, getWhatsappConfig } from '@/lib/store';
import { resolveAccess } from '@/lib/access';
import {
  listForms, listIntegrations, listRoutes, formsMissingRoutes,
  upsertForm, removeForm, upsertIntegration, removeIntegration,
  upsertRoute, removeRoute, copySetupFrom,
  ICONS, AUDIENCES, CHANNELS,
} from '@/lib/workspace-config';
import { ensureLegacyForms } from '@/lib/legacy-forms';

export var dynamic = 'force-dynamic';

// Setting up a workspace's Submit page: which forms it shows, what it integrates
// with, and where each form's submissions go. Managers run their own workspace;
// the operator can run any of them.

async function gate(req) {
  var access = await resolveAccess(req);
  if (!access.email) return { denied: NextResponse.json({ error: 'Sign in first' }, { status: 401 }) };
  if (!access.canSeeTeam) {
    return { denied: NextResponse.json({ error: 'Manager access required' }, { status: 403 }) };
  }
  var requested = new URL(req.url).searchParams.get('workspace');
  // A manager is pinned to their own workspace whatever the query string says.
  // Whatever was asked for; failing that, the workspace this session is actually
  // standing in. Defaulting to 'default' meant an operator who had switched into
  // a new client was still shown the original client's forms and destinations.
  var workspaceId = access.canSeeAll ? (requested || access.activeWorkspaceId || 'default') : access.workspaceIds[0];
  var ws = getWorkspace(workspaceId);
  if (!ws) return { denied: NextResponse.json({ error: 'No such workspace' }, { status: 404 }) };
  return { access: access, workspaceId: workspaceId, ws: ws };
}

export async function GET(req) {
  await initStore();
  var g = await gate(req);
  if (g.denied) return g.denied;

  await ensureLegacyForms().catch(function(e) { console.error('[Legacy forms]', e.message); });
  var missing = await formsMissingRoutes(g.workspaceId);
  var wc = getWhatsappConfig() || {};

  return NextResponse.json({
    success: true,
    workspace: { id: g.ws.id, name: g.ws.name, slug: g.ws.slug },
    forms: await listForms(g.workspaceId, { includeInactive: true }),
    integrations: await listIntegrations(g.workspaceId),
    routes: await listRoutes(g.workspaceId),
    missingRoutes: missing,
    icons: ICONS,
    audiences: AUDIENCES,
    channels: CHANNELS,
    // A destination cannot be tested without a sender behind it.
    canTestSend: !!wc.assistroApiUrl,
    // Only offered to the operator: copying setup between two clients' workspaces
    // is not a manager's call to make.
    copyableFrom: g.access.canSeeAll
      ? getWorkspaces().filter(function(w) { return w.id !== g.workspaceId; })
          .map(function(w) { return { id: w.id, name: w.name }; })
      : [],
  });
}

export async function POST(req) {
  await initStore();
  var g = await gate(req);
  if (g.denied) return g.denied;

  var body = await req.json().catch(function() { return {}; });
  var action = String(body.action || '');
  var result;

  if (action === 'save-form') {
    result = await upsertForm(g.workspaceId, body.form || {});
  } else if (action === 'delete-form') {
    result = await removeForm(g.workspaceId, body.formKey);
  } else if (action === 'reorder') {
    // One call for a whole drag-and-drop, so a half-applied order is not a state
    // the page can end up in.
    var order = Array.isArray(body.order) ? body.order : [];
    var forms = await listForms(g.workspaceId, { includeInactive: true });
    for (var i = 0; i < order.length; i++) {
      var found = forms.filter(function(f) { return f.formKey === order[i]; })[0];
      if (found) await upsertForm(g.workspaceId, Object.assign({}, found, { sortOrder: (i + 1) * 10 }));
    }
    result = { success: true };
  } else if (action === 'save-integration') {
    result = await upsertIntegration(g.workspaceId, body.provider, body.configKey, body.configValue);
  } else if (action === 'delete-integration') {
    result = await removeIntegration(g.workspaceId, body.provider, body.configKey);
  } else if (action === 'save-route') {
    result = await upsertRoute(g.workspaceId, body.formKey, body.channel, body.target, body.isActive);
  } else if (action === 'delete-route') {
    result = await removeRoute(g.workspaceId, body.formKey, body.channel);
  } else if (action === 'copy-setup') {
    if (!g.access.canSeeAll) {
      return NextResponse.json({ error: 'Only the operator can copy setup between workspaces' }, { status: 403 });
    }
    result = await copySetupFrom(body.sourceWorkspaceId, g.workspaceId);
    if (!result.error) {
      var source = getWorkspace(body.sourceWorkspaceId);
      result.copiedFrom = source ? source.name : body.sourceWorkspaceId;
    }
  } else if (action === 'test-send') {
    result = await testSend(req, g, body.formKey);
  } else {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }

  if (result && result.error) return NextResponse.json({ error: result.error }, { status: 400 });

  return NextResponse.json(Object.assign({ success: true }, result, {
    forms: await listForms(g.workspaceId, { includeInactive: true }),
    integrations: await listIntegrations(g.workspaceId),
    routes: await listRoutes(g.workspaceId),
    missingRoutes: await formsMissingRoutes(g.workspaceId),
  }));
}

// A clearly marked message to the configured destination, so somebody can confirm
// it lands in the right group before a rep does it with a real deal.
async function testSend(req, g, formKey) {
  var routes = await listRoutes(g.workspaceId);
  var route = routes.filter(function(r) { return r.formKey === formKey && r.isActive; })[0];
  if (!route) return { error: 'That form has no destination to test.' };
  if (route.channel === 'none') return { tested: true, note: 'This form is set to notify nowhere, so there is nothing to send.' };
  if (route.channel !== 'whatsapp') return { error: 'Only WhatsApp destinations can be tested today.' };

  var wc = getWhatsappConfig() || {};
  if (!wc.assistroApiUrl) return { error: 'No Assistro API URL is configured, so nothing can be sent.' };

  var message = '🧪 TEST MESSAGE — Summit OS\n\n'
    + 'Workspace: ' + g.ws.name + '\n'
    + 'Form: ' + formKey + '\n'
    + 'Sent by: ' + g.access.email + '\n\n'
    + 'This is a setup check, not a real submission. If you are reading it in the '
    + 'wrong group, fix the destination in Workspace settings before anyone files a deal.';

  console.log('[Test send] workspace=' + g.workspaceId + ' | form=' + formKey + ' | target=' + route.target);

  try {
    var res = await fetch(new URL('/api/notify', req.url).href, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assistroApiUrl: wc.assistroApiUrl,
        assistroApiKey: wc.assistroApiKey,
        whatsappGroupId: route.target,
        message: message,
      }),
    });
    var out = await res.json().catch(function() { return {}; });
    if (!out.sent) return { error: 'Could not send: ' + (out.error || out.reason || 'unknown') };
    return { tested: true, target: route.target, note: 'Test message sent to ' + route.target + '.' };
  } catch (e) {
    return { error: 'Could not send: ' + e.message };
  }
}
