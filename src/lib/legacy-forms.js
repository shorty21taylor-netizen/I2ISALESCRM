// The original workspace's Submit page, restored automatically.
//
// Moving forms, links and destinations into per-workspace rows removed the
// hardcoded four that every workspace used to inherit. That was the point — a new
// client must not come up wearing another client's forms — but it left the
// original workspace depending on a backfill script somebody had to remember to
// run. Nobody did, and Influence2Impact's reps opened Submit to an empty page.
//
// So it seeds itself, on boot, once, and only ever:
//   - into the ORIGINAL workspace, resolved by slug or by the 'default' id
//   - when that workspace has no forms at all
// Any other workspace, and any workspace that already has one form, is left
// exactly alone. A workspace created tomorrow still starts empty.

import { getWorkspaces, getWhatsappConfig, getStore } from '@/lib/store';
import { loadAppConfig } from '@/lib/db';
import { listForms, listIntegrations, listRoutes, upsertForm, upsertIntegration, upsertRoute } from '@/lib/workspace-config';

// The four the install shipped with, and the calendar that went with them.
export var LEGACY_FORMS = [
  { formKey: 'book-call', label: 'Booked Appointment', icon: 'phone', accent: 'accent', sortOrder: 10,
    audience: 'setter', description: 'Setters — log a new booked appointment',
    destinationLabel: 'Logs to the CRM + posts to WhatsApp',
    formUrl: 'https://summitsales.app.n8n.cloud/form/lead-booking' },
  { formKey: 'close-deal', label: 'Closed Deal (Gong Channel)', icon: 'dollar', accent: 'positive', sortOrder: 20,
    audience: 'closer', description: 'Closers — ring the bell on a won deal',
    destinationLabel: 'Logs to the CRM + posts to WhatsApp',
    formUrl: 'https://summitsales.app.n8n.cloud/form/deal-won' },
  { formKey: 'eod-report', label: 'EOD Report', icon: 'clipboard-check', accent: 'neutral', sortOrder: 30,
    audience: 'all', description: 'Everyone — end-of-day numbers',
    destinationLabel: 'Logs to the CRM + posts to WhatsApp',
    formUrl: 'https://summitsales.app.n8n.cloud/form/eod-report' },
  { formKey: 'after-call', label: 'After-Call Report', icon: 'document', accent: 'accent', sortOrder: 40,
    audience: 'closer', description: 'Closers — recap what happened on the call',
    destinationLabel: 'Logs to the CRM + posts to WhatsApp',
    formUrl: 'https://summitsales.app.n8n.cloud/form/after-call-report' },
];

// The DM setters' EOD, added after the original four. It is not part of
// LEGACY_FORMS: that list only ever seeds a workspace that has NO forms at all,
// and the workspace this belongs to has had four since the start — adding it
// there would have meant nobody ever saw it.
//
// It posts as an ordinary EOD (`?type=eod-report`) carrying Position: DM Setter,
// which is what puts it on the DM board rather than the phone one.
export var DM_SETTER_FORM = {
  formKey: 'dm-setter-eod',
  label: 'DM Setter EOD Report',
  icon: 'clipboard-check',
  accent: 'accent',
  sortOrder: 35,
  audience: 'dm-setter',
  description: 'DM setters — leads, conversations and the calls they booked',
  destinationLabel: 'Logs to the CRM + posts to WhatsApp',
  formUrl: 'https://summitsales.app.n8n.cloud/form/dm-setter-eod',
};

export var LEGACY_BOOKING = {
  url: 'https://api.leadconnectorhq.com/widget/booking/YtuohtkrLHiQ1MRZQmXo',
  label: 'Round Robin Booking Link',
  blurb: 'Setters — send this to a prospect to book them onto a closer',
};

var GROUP_FIELD = {
  'book-call': 'bookedCallGroupId',
  'close-deal': 'closedDealGroupId',
  'eod-report': 'eodReportGroupId',
  'after-call': 'afterCallGroupId',
};

// Which workspace actually needs its Submit page back.
//
// Deliberately not "the one whose id is 'default'". store.js guarantees a
// workspace with that id exists — if the database has none it synthesises one —
// so an install whose real workspace carries a generated id would have had these
// forms restored onto a phantom nobody ever opens. That is exactly what happened.
//
// The question is answered from the data instead: the workspace holding this
// install's sales history, which has no forms. A workspace created this morning
// has no history and can never qualify, and one that already has a single form is
// somebody's configuration and is never touched.
var MIN_RECORDS = 10;

export function recordCountsByWorkspace() {
  var store = getStore();
  var counts = {};
  function tally(list) {
    (list || []).forEach(function(r) {
      var id = (r && r.workspaceId) || 'default';
      counts[id] = (counts[id] || 0) + 1;
    });
  }
  tally(store.closedDeals);
  tally(store.eodReports);
  tally(store.bookedCalls);
  tally(store.afterCallReports);
  return counts;
}

export async function workspaceNeedingRestore() {
  var counts = recordCountsByWorkspace();
  var all = getWorkspaces();
  var best = null;

  for (var i = 0; i < all.length; i++) {
    var ws = all[i];
    var records = counts[ws.id] || 0;
    if (records < MIN_RECORDS) continue;
    var forms = await listForms(ws.id, { includeInactive: true });
    if (forms.length) continue;
    if (!best || records > best.records) best = { ws: ws, records: records };
  }
  return best;
}

// Adding one form to a workspace that is already set up.
//
// ensureLegacyForms only touches a workspace with nothing in it, which is right
// for restoring a Submit page and useless for adding to one. This does the
// narrower job: find the workspace that is plainly the original install — it
// holds this install's history AND already has the EOD form — and give it the DM
// form if it does not have one.
//
// Idempotent, and deliberately timid. It adds nothing to a workspace that has no
// EOD form of its own (which is every client workspace stood up since), it never
// edits a dm-setter-eod row that already exists, so an operator who changes the
// label or the URL keeps their change, and it adds exactly one row.
var dmDone = false;

export async function ensureDmSetterForm() {
  if (dmDone) return { skipped: 'already checked' };

  var counts = recordCountsByWorkspace();
  var all = getWorkspaces();
  var target = null;

  for (var i = 0; i < all.length; i++) {
    var ws = all[i];
    if ((counts[ws.id] || 0) < MIN_RECORDS) continue;
    var forms = await listForms(ws.id, { includeInactive: true });
    var hasEod = forms.some(function(f) { return f.formKey === 'eod-report'; });
    if (!hasEod) continue;
    if (forms.some(function(f) { return f.formKey === DM_SETTER_FORM.formKey; })) {
      // Already there. Settled, and nothing is overwritten.
      dmDone = true;
      return { skipped: 'already present', workspaceId: ws.id };
    }
    if (!target || (counts[ws.id] || 0) > (counts[target.id] || 0)) target = ws;
  }

  if (!target) { dmDone = true; return { skipped: 'no workspace needs it' }; }

  await upsertForm(target.id, DM_SETTER_FORM);

  // A destination, mirroring the one the workspace already uses for EODs.
  // Without it the Submit page would warn that this form has nowhere to send —
  // which would be false, since the form posts as an EOD and is routed as one.
  var routes = await listRoutes(target.id);
  var already = routes.some(function(r) { return r.formKey === DM_SETTER_FORM.formKey; });
  if (!already) {
    var eod = routes.filter(function(r) { return r.formKey === 'eod-report'; })[0];
    if (eod && eod.channel && eod.target) {
      await upsertRoute(target.id, DM_SETTER_FORM.formKey, eod.channel, eod.target, true);
    }
  }

  dmDone = true;
  console.log('[DM setter form] added the DM Setter EOD to ' + target.name + ' (' + target.id + ')');
  return { added: true, workspaceId: target.id, workspace: target.name };
}

var done = false;

export async function ensureLegacyForms() {
  if (done) return { skipped: 'already checked' };

  var candidate = await workspaceNeedingRestore();
  if (!candidate) {
    // Nothing to do — but only mark it settled once the check actually ran to
    // completion. Setting the flag first meant one failed query on a cold boot
    // disabled the restore for the life of the process.
    done = true;
    return { skipped: 'nothing needs restoring' };
  }

  var ws = candidate.ws;
  return restoreFormsInto(ws, candidate.records).then(function(result) {
    done = true;
    return result;
  });
}

// Split out so an operator can trigger it by hand when the automatic rule does
// not fire — a button that definitely works beats a heuristic that usually does.
export async function restoreFormsInto(ws, records) {
  var saved = (await loadAppConfig('forms').catch(function() { return null; })) || {};
  var wc = getWhatsappConfig() || {};

  for (var i = 0; i < LEGACY_FORMS.length; i++) {
    var f = LEGACY_FORMS[i];
    // A URL the operator edited in Settings before the move still wins.
    var override = saved.forms && saved.forms[f.formKey];
    await upsertForm(ws.id, Object.assign({}, f, {
      label: (override && override.label) || f.label,
      formUrl: (override && override.url) || f.formUrl,
    }));
  }

  var integrations = await listIntegrations(ws.id);
  var hasBooking = integrations.some(function(r) {
    return r.provider === 'gohighlevel' && r.configKey === 'round_robin_booking_url';
  });
  if (!hasBooking) {
    var booking = {
      url: (saved.bookingLink && saved.bookingLink.url !== undefined) ? saved.bookingLink.url : LEGACY_BOOKING.url,
      label: (saved.bookingLink && saved.bookingLink.label) || LEGACY_BOOKING.label,
      blurb: (saved.bookingLink && saved.bookingLink.blurb) || LEGACY_BOOKING.blurb,
    };
    if (booking.url) {
      await upsertIntegration(ws.id, 'gohighlevel', 'round_robin_booking_url', booking.url);
      await upsertIntegration(ws.id, 'gohighlevel', 'round_robin_label', booking.label);
      await upsertIntegration(ws.id, 'gohighlevel', 'round_robin_blurb', booking.blurb);
    }
  }

  // Destinations come from the old global WhatsApp config, which is where this
  // workspace's groups have been all along. Without them every submission on the
  // restored forms would be refused.
  var routes = await listRoutes(ws.id);
  var keys = Object.keys(GROUP_FIELD);
  for (var j = 0; j < keys.length; j++) {
    var key = keys[j];
    var already = routes.some(function(r) { return r.formKey === key; });
    if (already) continue;
    var groupId = wc[GROUP_FIELD[key]] || '';
    if (!groupId) continue;
    await upsertRoute(ws.id, key, 'whatsapp', groupId, true);
  }

  console.log('[Legacy forms] restored the Submit page for ' + ws.name
    + ' (' + ws.id + ', ' + (records || 0) + ' existing records)');
  return { restored: true, workspaceId: ws.id, workspace: ws.name, forms: LEGACY_FORMS.length };
}
