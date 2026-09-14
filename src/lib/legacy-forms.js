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

import { getWorkspaces, getWorkspace, getWhatsappConfig } from '@/lib/store';
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

// The workspace this install started as. 'default' is its id in every deployment
// of this CRM; the slug is checked too so a renamed original is still found.
export function originalWorkspace() {
  if (getWorkspace('default')) return getWorkspace('default');
  var all = getWorkspaces();
  for (var i = 0; i < all.length; i++) {
    if (String(all[i].slug || '').toLowerCase() === 'i2i') return all[i];
  }
  // Fall back to the oldest workspace — the one that existed before any of this.
  return all.slice().sort(function(a, b) {
    return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
  })[0] || null;
}

var done = false;

export async function ensureLegacyForms() {
  if (done) return { skipped: 'already checked' };
  done = true;

  var ws = originalWorkspace();
  if (!ws) return { skipped: 'no workspace' };

  var existing = await listForms(ws.id, { includeInactive: true });
  // The moment it has a single form, it is somebody's configuration and this
  // never touches it again.
  if (existing.length) return { skipped: 'already configured', workspaceId: ws.id };

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

  console.log('[Legacy forms] restored the original workspace’s Submit page (' + ws.name + ')');
  return { restored: true, workspaceId: ws.id, forms: LEGACY_FORMS.length };
}
