import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { initStore, findPipelineByAppointmentId, addPipelineRecord, updatePipelineRecord, canonicalRep } from '@/lib/store';
import { workspaceForIntegrationValue, getIntegration } from '@/lib/workspace-config';

export var dynamic = 'force-dynamic';

// GoHighLevel appointment create / update / cancel.
//
// Three rules hold this route up, and all three are about not corrupting somebody
// else's books:
//
//   1. Nothing is written without a valid signature. Hitting the endpoint is not
//      authorisation, and this URL is guessable.
//   2. The workspace comes from the GHL location id via workspace_integrations,
//      never from the payload's own opinion and never from a default. An unmapped
//      location is a no-op, not a guess.
//   3. The appointment id is the dedupe key. GHL retries, and it retries on its own
//      timeout as well as on ours, so the same payload arriving three times has to
//      produce exactly one card.

// GHL's status vocabulary -> ours. Anything unrecognised leaves the stage alone
// rather than dragging a card backwards on a status we do not understand.
var STATUS_STAGE = {
  booked: 'booked',
  new: 'booked',
  scheduled: 'booked',
  confirmed: 'confirmed',
  showed: 'showed',
  show: 'showed',
  noshow: 'no_show',
  'no-show': 'no_show',
  no_show: 'no_show',
  cancelled: 'lost',
  canceled: 'lost',
  invalid: 'dq',
};

function pick(obj, keys) {
  for (var i = 0; i < keys.length; i++) {
    var parts = keys[i].split('.');
    var cur = obj;
    for (var j = 0; j < parts.length && cur != null; j++) cur = cur[parts[j]];
    if (cur !== undefined && cur !== null && cur !== '') return cur;
  }
  return '';
}

// Constant-time compare that does not throw on a length mismatch — timingSafeEqual
// does, and the throw is itself a length oracle.
function safeEqual(a, b) {
  var ab = Buffer.from(String(a || ''), 'utf8');
  var bb = Buffer.from(String(b || ''), 'utf8');
  if (ab.length !== bb.length) return false;
  try { return crypto.timingSafeEqual(ab, bb); } catch (e) { return false; }
}

// HMAC-SHA256 over the exact bytes we received. The raw body is hashed, not a
// re-serialised object — JSON.stringify would reorder keys and never match.
function signatureOk(rawBody, header, secret) {
  if (!secret || !header) return false;
  var expected = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  var given = String(header).trim().replace(/^sha256=/i, '');
  return safeEqual(expected, given);
}

export async function POST(req) {
  await initStore();

  var raw = '';
  try {
    raw = await req.text();
  } catch (e) {
    return NextResponse.json({ error: 'Unreadable body' }, { status: 400 });
  }

  var payload = null;
  try {
    payload = JSON.parse(raw || '{}');
  } catch (e) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  var signature = req.headers.get('x-summit-signature') || req.headers.get('x-wh-signature') || '';

  // The location id is read before anything is verified, and is used for exactly one
  // thing: choosing which secret to check the signature against. It grants nothing
  // on its own — a forged location id still has to produce a valid HMAC.
  var locationId = String(pick(payload, [
    'locationId', 'location_id', 'location.id', 'companyId',
  ]) || '').trim();

  var workspaceId = locationId
    ? await workspaceForIntegrationValue('gohighlevel', 'location_id', locationId)
    : '';

  if (!workspaceId) {
    // Never guess. An appointment we cannot place is one we do not write — an RWH
    // booking landing on an I2I board is worse than a booking we missed. 200 so GHL
    // stops retrying something that will never succeed.
    console.warn('[GHL] No workspace mapped to location "' + locationId + '" — ignored.'
      + ' Map it with gohighlevel / location_id in Workspace → Forms & Routing.');
    return NextResponse.json({ ok: true, ignored: 'unmapped-location' });
  }

  var secret = (await getIntegration(workspaceId, 'gohighlevel', 'webhook_secret'))
    || process.env.GHL_WEBHOOK_SECRET
    || '';

  if (!secret) {
    // Fail closed. An unconfigured secret means every write to this workspace is
    // unauthenticated, which is not a state worth being convenient about.
    console.error('[GHL] No webhook secret for workspace ' + workspaceId + ' — rejecting.');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 401 });
  }

  if (!signatureOk(raw, signature, secret)) {
    console.error('[GHL] Bad or missing signature for workspace ' + workspaceId);
    return NextResponse.json({ error: 'Bad signature' }, { status: 401 });
  }

  try {
    var result = await ingest(payload, workspaceId);
    return NextResponse.json(result);
  } catch (e) {
    console.error('[GHL] Ingest error:', e);
    // 500 so GHL retries — the dedupe key makes that safe.
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

async function ingest(payload, workspaceId) {
  var appt = payload.appointment || payload.calendar || payload;
  var contact = payload.contact || payload.customData || {};

  var appointmentId = String(pick(appt, ['id', 'appointmentId', 'appointment_id'])
    || pick(payload, ['appointmentId', 'appointment_id', 'id']) || '').trim();

  if (!appointmentId) {
    console.warn('[GHL] Payload carried no appointment id — ignored.');
    return { ok: true, ignored: 'no-appointment-id' };
  }

  var statusRaw = String(pick(payload, ['appointmentStatus', 'status'])
    || pick(appt, ['appointmentStatus', 'status']) || '').toLowerCase().trim();
  var stage = STATUS_STAGE[statusRaw] || '';

  var eventType = String(pick(payload, ['type', 'event', 'eventType']) || '').toLowerCase();
  if (!stage && eventType.indexOf('delete') !== -1) stage = 'lost';
  if (!stage && eventType.indexOf('cancel') !== -1) stage = 'lost';

  // The closer is whoever owns the calendar the call landed on.
  var closerName = canonicalRep(pick(appt, ['assignedUserName', 'userName', 'calendarUserName'])
    || pick(payload, ['assignedUserName', 'userName']));
  var closerEmail = String(pick(appt, ['assignedUserEmail', 'userEmail', 'calendarUserEmail'])
    || pick(payload, ['assignedUserEmail', 'userEmail']) || '').toLowerCase();

  // The setter is the booking attribution: the contact's assigned user, or whatever
  // custom field this workspace records it in. A workspace can name its own field
  // with gohighlevel / setter_field rather than us hard-coding one shop's convention.
  var setterField = await getIntegration(workspaceId, 'gohighlevel', 'setter_field');
  var setterRaw = '';
  if (setterField) {
    setterRaw = pick(payload, ['customData.' + setterField, 'custom_fields.' + setterField])
      || pick(contact, [setterField]) || '';
  }
  if (!setterRaw) {
    setterRaw = pick(contact, ['assignedUserName', 'assignedTo', 'owner'])
      || pick(payload, ['contact.assignedUserName', 'attributionSource.utm_source']) || '';
  }
  var setterName = canonicalRep(setterRaw);
  var setterEmail = String(pick(contact, ['assignedUserEmail']) || '').toLowerCase();

  var fields = {
    workspaceId: workspaceId,
    prospectName: String(pick(contact, ['name', 'fullName', 'full_name'])
      || ((pick(contact, ['firstName', 'first_name']) || '') + ' ' + (pick(contact, ['lastName', 'last_name']) || '')).trim()
      || pick(payload, ['fullName', 'name']) || '').trim(),
    prospectEmail: String(pick(contact, ['email']) || pick(payload, ['email']) || '').toLowerCase(),
    prospectPhone: String(pick(contact, ['phone']) || pick(payload, ['phone']) || ''),
    leadSource: String(pick(contact, ['source']) || pick(payload, ['source', 'attributionSource.utm_source']) || ''),
    appointmentAt: pick(appt, ['startTime', 'start_time', 'selectedSlot', 'appointmentStartTime'])
      || pick(payload, ['startTime', 'start_time']) || '',
    ghlContactId: String(pick(contact, ['id', 'contactId']) || pick(payload, ['contactId']) || ''),
    notes: String(pick(appt, ['notes', 'title']) || ''),
  };

  if (setterName) fields.setter = setterName;
  if (setterEmail) fields.setterEmail = setterEmail;
  if (closerName) fields.closer = closerName;
  if (closerEmail) fields.closerEmail = closerEmail;

  // Create and update are deliberately different shapes. A new card starts at
  // `booked` because an appointment exists by definition. An update only carries a
  // stage when GHL sent a status we recognise — otherwise a rescheduled time or an
  // edited note would drag a card the closer had already moved back to `booked`.
  var actor = { email: '', name: 'GoHighLevel', type: 'webhook', note: statusRaw || eventType };
  var existing = await findPipelineByAppointmentId(appointmentId);
  var record;
  var created = false;

  if (!existing) {
    record = addPipelineRecord(
      Object.assign({}, fields, { stage: stage || 'booked', ghlAppointmentId: appointmentId }),
      actor
    );
    created = true;
  } else {
    // The workspace is never rewritten by an update. If a location were remapped
    // mid-flight, moving live records between clients' books is not the answer.
    var patch = stage ? Object.assign({}, fields, { stage: stage }) : Object.assign({}, fields);
    delete patch.workspaceId;
    var result = updatePipelineRecord(existing.id, patch, actor);
    if (result.error) throw new Error(result.error);
    record = result.record;
  }

  console.log('[GHL] ' + (created ? 'created' : 'updated') + ' ' + appointmentId
    + ' | workspace=' + workspaceId + ' | stage=' + (record ? record.stage : '?')
    + (record && (record.setter || record.setterEmail) ? '' : ' | UNATTRIBUTED'));

  return {
    ok: true,
    created: created,
    id: record ? record.id : '',
    stage: record ? record.stage : '',
    unattributed: !!(record && !record.setter && !record.setterEmail),
  };
}

// GHL lets you send a test GET when wiring a webhook up. Answering it makes the
// setup screen say "connected" without ever accepting an unsigned write.
export async function GET() {
  return NextResponse.json({ ok: true, endpoint: 'ghl/appointments', accepts: 'POST (signed)' });
}
