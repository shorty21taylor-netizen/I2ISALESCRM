import { NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  initStore, addBookedCall, addClosedDeal, addEODReport, addAfterCallReport, registerCloser,
} from '@/lib/store';
import { workspaceForIntegrationValue, getIntegration } from '@/lib/workspace-config';
import { syncBookedCall, syncClosedDeal } from '@/lib/pipeline-sync';
import { sendFormNotification } from '@/lib/notify-server';
import { normalizeRecording, withRecording } from '@/lib/call-recording';
import {
  flattenSurvey, surveyFormType, recordingFrom,
  toBookedCall, toAfterCall, toClosedDeal, closedOnThisCall, toEod,
} from '@/lib/ghl-survey';

export var dynamic = 'force-dynamic';

// A report filed on a hosted GoHighLevel survey, landing in the CRM.
//
// The floor files its Booked Call, End-of-Call and End-of-Day reports on surveys
// rather than here. Without this route those submissions reach GHL and nothing
// else: the boards, the leaderboards, the KPI cards and the commission run all
// read Summit's own records, so they would simply stop moving.
//
// Point one GHL workflow per survey at:
//   POST /api/webhooks/ghl/survey?type=book-call | after-call | eod-report
// and map nothing — src/lib/ghl-survey.js knows what the questions are called.
//
// It inherits the three rules the appointments route is built on, for the same
// reason: a report landing on the wrong company's board is worse than one that
// never arrived.
//
//   1. Nothing is written without a valid signature. The URL is guessable.
//   2. The workspace comes from the GHL location id, never from the payload and
//      never from a default. An unmapped location is a no-op.
//   3. The same submission arriving twice produces one record. GHL retries.

function pickPath(obj, keys) {
  for (var i = 0; i < keys.length; i++) {
    var parts = keys[i].split('.');
    var cur = obj;
    for (var j = 0; j < parts.length && cur != null; j++) cur = cur[parts[j]];
    if (cur !== undefined && cur !== null && cur !== '') return cur;
  }
  return '';
}

function safeEqual(a, b) {
  var ab = Buffer.from(String(a || ''), 'utf8');
  var bb = Buffer.from(String(b || ''), 'utf8');
  if (ab.length !== bb.length) return false;
  try { return crypto.timingSafeEqual(ab, bb); } catch (e) { return false; }
}

// HMAC over the exact bytes received. Re-serialising would reorder keys.
function signatureOk(rawBody, header, secret) {
  if (!secret || !header) return false;
  var expected = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  return safeEqual(expected, String(header).trim().replace(/^sha256=/i, ''));
}

// GHL retries on its own timeout as well as on ours, so the same submission can
// arrive several times. Kept in memory: a duplicate hours later is a rep filing
// twice, which is a real record, not a retry.
var SEEN = {};
var SEEN_MS = 10 * 60 * 1000;

function firstTime(key) {
  var now = Date.now();
  Object.keys(SEEN).forEach(function(k) { if (now - SEEN[k] > SEEN_MS) delete SEEN[k]; });
  if (SEEN[key] && now - SEEN[key] < SEEN_MS) return false;
  SEEN[key] = now;
  return true;
}

export async function POST(req) {
  await initStore();

  var raw = '';
  try { raw = await req.text(); }
  catch (e) { return NextResponse.json({ error: 'Unreadable body' }, { status: 400 }); }

  var payload = null;
  try { payload = JSON.parse(raw || '{}'); }
  catch (e) { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  var signature = req.headers.get('x-summit-signature') || req.headers.get('x-wh-signature') || '';

  // Read before anything is verified, and used for exactly one thing: choosing
  // which secret to check the signature against. It grants nothing on its own.
  var locationId = String(pickPath(payload, [
    'locationId', 'location_id', 'location.id', 'companyId',
  ]) || '').trim();

  var workspaceId = locationId
    ? await workspaceForIntegrationValue('gohighlevel', 'location_id', locationId)
    : '';

  if (!workspaceId) {
    console.warn('[GHL survey] No workspace mapped to location "' + locationId + '" — ignored.'
      + ' Map it with gohighlevel / location_id in Workspace → Submit Forms.');
    return NextResponse.json({ ok: true, ignored: 'unmapped-location' });
  }

  var secret = (await getIntegration(workspaceId, 'gohighlevel', 'webhook_secret'))
    || process.env.GHL_WEBHOOK_SECRET
    || '';
  if (!secret) {
    console.error('[GHL survey] No webhook secret for workspace ' + workspaceId + ' — rejecting.');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 401 });
  }
  if (!signatureOk(raw, signature, secret)) {
    console.error('[GHL survey] Bad or missing signature for workspace ' + workspaceId);
    return NextResponse.json({ error: 'Bad signature' }, { status: 401 });
  }

  var url = new URL(req.url);
  var flat = flattenSurvey(payload);
  var formType = surveyFormType(flat, url.searchParams.get('type') || url.searchParams.get('form'));

  if (!formType) {
    console.warn('[GHL survey] Could not tell which report this is — add ?type= to the webhook URL.');
    return NextResponse.json({
      error: 'Unknown survey. Add ?type=book-call | after-call | eod-report to the webhook URL.',
    }, { status: 400 });
  }

  // One record per submission, however many times GHL sends it.
  var fingerprint = workspaceId + '|' + formType + '|'
    + crypto.createHash('sha1').update(raw).digest('hex').slice(0, 16);
  if (!firstTime(fingerprint)) {
    console.log('[GHL survey] Duplicate within the retry window — ignored.');
    return NextResponse.json({ ok: true, duplicate: true });
  }

  // Whether this workspace still insists on the tape. The internal forms require
  // it; a hosted survey that has no such question would be refused outright and
  // the closers would have nowhere to file at all. So it stays required by
  // default and a workspace can stand it down deliberately, with
  // summit / require_call_recording = off.
  var requireRecording = String(
    (await getIntegration(workspaceId, 'summit', 'require_call_recording')) || 'on'
  ).toLowerCase() !== 'off';

  try {
    if (formType === 'eod-report') {
      var eod = toEod(flat);
      if (!eod.salesRep) return NextResponse.json({ error: 'Missing the setter name' }, { status: 400 });
      eod.workspaceId = workspaceId;
      var eodEntry = addEODReport(eod);
      registerCloser('', eod.salesRep);
      var eodWa = await sendFormNotification({
        req: req, formType: 'eod-report', entry: eodEntry, source: 'ghl-survey',
      });
      console.log('[GHL survey] eod-report ->', eodEntry.id, '|', eod.salesRep);
      return NextResponse.json({ ok: true, type: 'eod-report', id: eodEntry.id, whatsapp: eodWa });
    }

    if (formType === 'book-call') {
      var call = toBookedCall(flat);
      if (!call.leadsName) return NextResponse.json({ error: 'Missing the lead name' }, { status: 400 });
      call.workspaceId = workspaceId;
      var callEntry = addBookedCall(call);
      if (call.closer || call.setter) registerCloser('', call.closer || call.setter);
      syncBookedCall(callEntry, { name: 'GHL survey', type: 'webhook' });
      var callWa = await sendFormNotification({
        req: req, formType: 'book-call', entry: callEntry, source: 'ghl-survey',
      });
      console.log('[GHL survey] book-call ->', callEntry.id, '|', call.leadsName);
      return NextResponse.json({ ok: true, type: 'book-call', id: callEntry.id, whatsapp: callWa });
    }

    // The End-of-Call Report. One submission, and on a close two records: the
    // report is the account of the call, the deal is the money. Neither doubles —
    // cash is read off deals, calls off reports.
    var ac = toAfterCall(flat);
    if (!ac.leadsName) return NextResponse.json({ error: 'Missing the prospect name' }, { status: 400 });

    var tape = normalizeRecording(recordingFrom(flat));
    if (requireRecording && !tape.ok) {
      console.warn('[GHL survey] Refused a call report with no recording in workspace ' + workspaceId);
      return NextResponse.json({
        error: tape.reason + ' Add a recording-link question to the survey, or set'
          + ' summit / require_call_recording to "off" for this workspace.',
        needsRecording: true,
      }, { status: 400 });
    }
    if (tape.ok) ac.extra = withRecording(ac, tape.url);

    ac.workspaceId = workspaceId;
    var acEntry = addAfterCallReport(ac);
    if (ac.closer) registerCloser('', ac.closer);
    var acWa = await sendFormNotification({
      req: req, formType: 'after-call', entry: acEntry, source: 'ghl-survey',
    });

    var dealId = '';
    var dealWa = null;
    if (closedOnThisCall(flat)) {
      var deal = toClosedDeal(flat);
      if (tape.ok) deal.extra = withRecording(deal, tape.url);
      deal.workspaceId = workspaceId;
      var dealEntry = addClosedDeal(deal);
      dealId = dealEntry.id;
      syncClosedDeal(dealEntry, { name: deal.closer || 'GHL survey', type: 'webhook' });
      dealWa = await sendFormNotification({
        req: req, formType: 'close-deal', entry: dealEntry, source: 'ghl-survey',
      });
      console.log('[GHL survey] close-deal ->', dealEntry.id, '|', deal.leadsName, '$' + deal.cashCollected);
    }

    console.log('[GHL survey] after-call ->', acEntry.id, '|', ac.leadsName, '|', ac.outcome);
    return NextResponse.json({
      ok: true, type: 'after-call', id: acEntry.id,
      closedDealId: dealId || null,
      whatsapp: acWa, dealWhatsapp: dealWa,
    });
  } catch (e) {
    console.error('[GHL survey Error]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
