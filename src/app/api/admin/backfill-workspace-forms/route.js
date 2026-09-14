import { NextResponse } from 'next/server';
import { initStore, getWorkspaces } from '@/lib/store';
import { resolveAccess, OWNER_EMAIL } from '@/lib/access';
import { listForms, listIntegrations, listRoutes, upsertForm, upsertIntegration, upsertRoute } from '@/lib/workspace-config';
import { countUnattributedRecords, attributeNullWorkspaces, loadAppConfig } from '@/lib/db';
import { getWhatsappConfig } from '@/lib/store';

export var dynamic = 'force-dynamic';

// Moves the original workspace's submit setup out of the global rows it used to
// live in and into its own workspace-scoped rows — and attributes any sales
// record that predates workspace scoping.
//
// Nothing is inserted for any other workspace. That is the entire point: a second
// workspace must start empty.

// What the install shipped with, before any of this was per-workspace. These are
// the values read out of the old global config at the time of the move, not new
// defaults — nothing reads this list except the backfill.
var LEGACY_FORMS = [
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

var LEGACY_BOOKING_URL = 'https://api.leadconnectorhq.com/widget/booking/YtuohtkrLHiQ1MRZQmXo';
var LEGACY_BOOKING_LABEL = 'Round Robin Booking Link';
var LEGACY_BOOKING_BLURB = 'Setters — send this to a prospect to book them onto a closer';

var GROUP_FIELD = {
  'book-call': 'bookedCallGroupId',
  'close-deal': 'closedDealGroupId',
  'eod-report': 'eodReportGroupId',
  'after-call': 'afterCallGroupId',
};

async function gate(req) {
  var access = await resolveAccess(req);
  if (!access.email) return { denied: NextResponse.json({ error: 'Sign in first' }, { status: 401 }) };
  if (!access.isOperator && access.email !== OWNER_EMAIL) {
    return { denied: NextResponse.json({ error: 'Operator access required' }, { status: 403 }) };
  }
  return { access: access };
}

// Resolve the original workspace by slug, never by position. A wrong guess here
// would write one company's forms onto another's.
function resolveTarget(slug) {
  var wanted = String(slug || 'i2i').toLowerCase();
  var all = getWorkspaces();
  for (var i = 0; i < all.length; i++) {
    if (String(all[i].slug || '').toLowerCase() === wanted) return all[i];
  }
  return null;
}

async function plan(target) {
  var saved = (await loadAppConfig('forms')) || {};
  var wc = getWhatsappConfig() || {};

  var existingForms = await listForms(target.id, { includeInactive: true });
  var existingIntegrations = await listIntegrations(target.id);
  var existingRoutes = await listRoutes(target.id);

  function hasForm(k) { return existingForms.some(function(f) { return f.formKey === k; }); }
  function hasRoute(k) { return existingRoutes.some(function(r) { return r.formKey === k; }); }
  function hasIntegration(p, k) {
    return existingIntegrations.some(function(r) { return r.provider === p && r.configKey === k; });
  }

  // A URL the operator edited in Settings wins over the shipped one.
  var forms = LEGACY_FORMS.map(function(f) {
    var override = saved.forms && saved.forms[f.formKey];
    return Object.assign({}, f, {
      label: (override && override.label) || f.label,
      formUrl: (override && override.url) || f.formUrl,
    });
  });

  var booking = {
    url: (saved.bookingLink && saved.bookingLink.url !== undefined) ? saved.bookingLink.url : LEGACY_BOOKING_URL,
    label: (saved.bookingLink && saved.bookingLink.label) || LEGACY_BOOKING_LABEL,
    blurb: (saved.bookingLink && saved.bookingLink.blurb) || LEGACY_BOOKING_BLURB,
  };

  var routes = [];
  Object.keys(GROUP_FIELD).forEach(function(key) {
    var groupId = wc[GROUP_FIELD[key]] || '';
    if (!groupId) return;
    routes.push({ formKey: key, channel: 'whatsapp', target: groupId });
  });

  return {
    forms: forms.filter(function(f) { return !hasForm(f.formKey); }),
    booking: booking.url && !hasIntegration('gohighlevel', 'round_robin_booking_url') ? booking : null,
    routes: routes.filter(function(r) { return !hasRoute(r.formKey); }),
    // Routes we cannot create because the old global config never had a group id
    // for them. Named, so nobody assumes they are configured.
    routesWithNoSource: Object.keys(GROUP_FIELD).filter(function(k) {
      return !wc[GROUP_FIELD[k]] && !hasRoute(k);
    }),
  };
}

export async function GET(req) {
  await initStore();
  var g = await gate(req);
  if (g.denied) return g.denied;

  var url = new URL(req.url);
  var target = resolveTarget(url.searchParams.get('slug'));
  if (!target) {
    return NextResponse.json({
      error: 'No workspace with that slug. Pass ?slug=<slug>; nothing was changed.',
      workspaces: getWorkspaces().map(function(w) { return { id: w.id, name: w.name, slug: w.slug }; }),
    }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    dryRun: true,
    target: { id: target.id, name: target.name, slug: target.slug },
    wouldInsert: await plan(target),
    records: await countUnattributedRecords(),
    otherWorkspaces: getWorkspaces()
      .filter(function(w) { return w.id !== target.id; })
      .map(function(w) { return { id: w.id, name: w.name, note: 'untouched — starts empty by design' }; }),
  });
}

export async function POST(req) {
  await initStore();
  var g = await gate(req);
  if (g.denied) return g.denied;

  var body = await req.json().catch(function() { return {}; });
  if (body.confirm !== 'backfill') {
    return NextResponse.json({ error: 'Send {"confirm":"backfill"} to apply.' }, { status: 400 });
  }

  var target = resolveTarget(body.slug);
  if (!target) {
    return NextResponse.json({
      error: 'No workspace with that slug. Nothing was changed.',
      workspaces: getWorkspaces().map(function(w) { return { id: w.id, name: w.name, slug: w.slug }; }),
    }, { status: 404 });
  }

  var before = await countUnattributedRecords();
  var todo = await plan(target);

  for (var i = 0; i < todo.forms.length; i++) {
    await upsertForm(target.id, todo.forms[i]);
  }
  if (todo.booking) {
    await upsertIntegration(target.id, 'gohighlevel', 'round_robin_booking_url', todo.booking.url);
    await upsertIntegration(target.id, 'gohighlevel', 'round_robin_label', todo.booking.label);
    await upsertIntegration(target.id, 'gohighlevel', 'round_robin_blurb', todo.booking.blurb);
  }
  for (var j = 0; j < todo.routes.length; j++) {
    await upsertRoute(target.id, todo.routes[j].formKey, 'whatsapp', todo.routes[j].target, true);
  }

  // Only ever fills a blank, and touches no other column on a sales record.
  var attributed = await attributeNullWorkspaces(target.id);

  return NextResponse.json({
    success: true,
    target: { id: target.id, name: target.name, slug: target.slug },
    inserted: {
      forms: todo.forms.length,
      integrations: todo.booking ? 3 : 0,
      routes: todo.routes.length,
    },
    routesStillMissing: todo.routesWithNoSource,
    recordsAttributed: attributed,
    records: { before: before, after: await countUnattributedRecords() },
    note: todo.forms.length + todo.routes.length === 0
      ? 'Nothing to do — already backfilled.'
      : 'Backfilled. Run again and it will report zero.',
  });
}
