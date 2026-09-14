import { NextResponse } from 'next/server';
import { syncBookedCall, syncClosedDeal } from '@/lib/pipeline-sync';
import { initStore, addBookedCall, addClosedDeal, addEODReport, addAfterCallReport, registerCloser, addIngestAttempt, getIngestAttempts } from '@/lib/store';
import { callerEmail, OWNER_EMAIL } from '@/lib/access';
import { normalizeSubmission, resolveFormType, checkEODSanity } from '@/lib/form-ingest';
import { sendFormNotification } from '@/lib/notify-server';
import { getIngestKey, authorizeIngestKey, resolveClaimedWorkspace } from '@/lib/ingest-auth';

// Public ingest endpoint for the hosted n8n forms.
//
//   POST /api/forms/ingest?type=close-deal          (also: book-call, eod-report, after-call)
//   x-api-key: <FORM_INGEST_KEY>
//   { "Client Name": "...", "Deal Value": "5000", ... }
//
// n8n has no CRM session, so the workspace header the browser sends is absent.
// An ingest key authenticates the workflow instead — and the KEY decides which
// workspace the record lands in, not the payload. Give each workspace its own key
// (Workspace -> Forms & Routing) and its forms can only ever write into it, however
// the n8n workflow behind them is configured.

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-api-key, Authorization',
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: cors() });
}

async function readBody(req) {
  var ct = (req.headers.get('content-type') || '').toLowerCase();
  if (ct.indexOf('application/json') !== -1) {
    return await req.json();
  }
  // n8n can also be pointed at this URL with a form-encoded body.
  if (ct.indexOf('form') !== -1) {
    var form = await req.formData();
    var out = {};
    form.forEach(function(v, k) { out[k] = typeof v === 'string' ? v : String(v); });
    return out;
  }
  var text = await req.text();
  try { return JSON.parse(text); } catch (e) { return {}; }
}

// Every attempt is recorded, accepted or not, so a misconfigured n8n node shows up
// in the CRM instead of only in the Railway logs.
function note(req, fields) {
  try {
    addIngestAttempt(Object.assign({
      ip: req.headers.get('x-forwarded-for') || '',
    }, fields));
  } catch (e) { /* diagnostics must never break an ingest */ }
}

export async function POST(req) {
  await initStore();
  var url;
  var requestedType = '';
  var sawKey = false;
  try {
    url = new URL(req.url);
    var raw = await readBody(req);

    var expected = await getIngestKey();
    var presented = req.headers.get('x-api-key')
      || (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
      || url.searchParams.get('key')
      || raw.apiKey || raw.key || '';

    sawKey = !!presented;

    if (!expected) {
      note(req, { status: 'rejected', reason: 'No ingest key configured on the CRM', keyPresented: sawKey });
      return NextResponse.json(
        { error: 'Ingest key not configured. Set FORM_INGEST_KEY on the CRM before pointing n8n at this endpoint.' },
        { status: 503, headers: cors() }
      );
    }
    // The key is checked before anything is parsed, and a workspace-specific key
    // pins the destination here and now — the payload never gets to move it.
    var auth = await authorizeIngestKey(presented);
    if (!auth.ok) {
      console.warn('[Ingest] Rejected submission —', auth.reason);
      note(req, {
        status: 'rejected',
        reason: presented ? 'Key did not match any ingest key' : 'No x-api-key header on the request',
        keyPresented: sawKey,
        requestedType: url.searchParams.get('type') || '',
      });
      return NextResponse.json({ error: auth.reason }, { status: auth.status, headers: cors() });
    }

    requestedType = url.searchParams.get('type') || url.searchParams.get('form') || raw.formType || raw.type || '';
    var norm = normalizeSubmission(requestedType, raw);
    if (norm.error) {
      note(req, { status: 'rejected', reason: norm.error, keyPresented: sawKey, requestedType: requestedType });
      return NextResponse.json({ error: norm.error }, { status: 400, headers: cors() });
    }

    var type = norm.type;
    var record = norm.record;

    // Where this submission is allowed to land. A per-workspace key has already
    // decided; an install-wide key gets its claim checked against the workspaces
    // that exist and the ones that have sealed themselves with a key of their own.
    //
    // Before this, a booked-call form whose workflow named another company wrote
    // straight into that company's books, and one that named nobody wrote into
    // 'default' — so a new client's form quietly filled the first client's CRM.
    var placement = resolveClaimedWorkspace(auth, record.workspaceId);
    if (!placement.ok) {
      console.warn('[Ingest] Refused placement:', placement.reason,
        '| claimed=' + (record.workspaceId || '(none)'));
      note(req, {
        status: 'rejected', reason: placement.reason, keyPresented: sawKey,
        type: type, requestedType: requestedType,
      });
      return NextResponse.json({ error: placement.reason }, { status: placement.status, headers: cors() });
    }
    if (placement.ignoredClaim && placement.ignoredClaim !== placement.workspaceId) {
      console.warn('[Ingest] Payload claimed workspace "' + placement.ignoredClaim
        + '" but the key belongs to "' + placement.workspaceId + '" — the key wins.');
    }
    record.workspaceId = placement.workspaceId;

    // Minimum viable record per form — a blank submission should fail loudly at
    // n8n rather than land as an empty row in the CRM.
    if (type === 'eod-report' && !record.salesRep) {
      note(req, { status: 'rejected', reason: 'Missing rep name (Your Name)', keyPresented: sawKey, type: type, requestedType: requestedType });
      return NextResponse.json({ error: 'Missing rep name (Your Name)' }, { status: 400, headers: cors() });
    }
    if (type === 'eod-report') {
      var insane = checkEODSanity(record);
      if (insane) {
        note(req, { status: 'rejected', reason: insane, keyPresented: sawKey, type: type, requestedType: requestedType });
        return NextResponse.json({ error: insane }, { status: 400, headers: cors() });
      }
    }
    if (type !== 'eod-report' && !record.leadsName) {
      note(req, { status: 'rejected', reason: 'Missing lead name', keyPresented: sawKey, type: type, requestedType: requestedType });
      return NextResponse.json({ error: 'Missing lead name' }, { status: 400, headers: cors() });
    }

    var entry;
    if (type === 'book-call') { entry = addBookedCall(record); syncBookedCall(entry, { name: 'n8n form', type: 'webhook' }); }
    else if (type === 'close-deal') { entry = addClosedDeal(record); syncClosedDeal(entry, { name: 'n8n form', type: 'webhook' }); }
    else if (type === 'after-call') entry = addAfterCallReport(record);
    else entry = addEODReport(record);

    var closerName = record.closer || record.closerName || record.salesRep || '';
    if (record.closerEmail || closerName) registerCloser(record.closerEmail || '', closerName);

    console.log('[Ingest]', type, '->', entry.id, '|', record.leadsName || record.salesRep);
    note(req, {
      status: 'accepted', type: type, requestedType: requestedType, keyPresented: sawKey,
      recordId: entry.id, label: record.leadsName || record.salesRep || '',
    });

    // If the n8n workflow still owns the WhatsApp step, it should send
    // "skipWhatsapp": true so the CRM records the notification without duplicating it.
    var skip = raw.skipWhatsapp === true || raw.skipWhatsapp === 'true'
      || url.searchParams.get('whatsapp') === 'off';

    var whatsapp = await sendFormNotification({
      req: req,
      formType: type,
      entry: entry,
      source: 'n8n',
      skipSend: skip,
      externalMessage: raw.messageText || '',
    });

    return NextResponse.json(
      { success: true, type: type, submission: entry, whatsapp: whatsapp },
      { headers: cors() }
    );
  } catch (e) {
    console.error('[Ingest Error]', e);
    note(req, { status: 'error', reason: e.message, keyPresented: sawKey, requestedType: requestedType });
    return NextResponse.json({ error: e.message }, { status: 500, headers: cors() });
  }
}

// Lets you verify wiring from a browser or n8n's "Test step" without writing data.
// The operator additionally gets the recent-attempt log, which answers the only
// question that matters when nothing is arriving: is n8n calling at all, and what
// is the CRM saying back?
export async function GET(req) {
  await initStore();
  var url = new URL(req.url);
  var type = resolveFormType(url.searchParams.get('type') || '');
  var expected = await getIngestKey();

  var body = {
    ok: true,
    endpoint: '/api/forms/ingest?type=book-call|close-deal|eod-report|after-call',
    typeResolved: type || null,
    ingestKeyConfigured: !!expected,
    howToAuth: 'Send header  x-api-key: <FORM_INGEST_KEY>',
  };

  if ((await callerEmail(req)) === OWNER_EMAIL) {
    var attempts = getIngestAttempts();
    body.recentAttempts = attempts;
    body.attemptSummary = {
      total: attempts.length,
      accepted: attempts.filter(function(a) { return a.status === 'accepted'; }).length,
      rejected: attempts.filter(function(a) { return a.status === 'rejected'; }).length,
      errors: attempts.filter(function(a) { return a.status === 'error'; }).length,
      note: 'Since the last deploy — this log is in memory and clears on restart.',
    };
  }

  return NextResponse.json(body, { headers: cors() });
}
