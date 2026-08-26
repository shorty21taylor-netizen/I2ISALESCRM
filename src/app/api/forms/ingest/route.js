import { NextResponse } from 'next/server';
import { initStore, addBookedCall, addClosedDeal, addEODReport, addAfterCallReport, registerCloser } from '@/lib/store';
import { normalizeSubmission, resolveFormType } from '@/lib/form-ingest';
import { sendFormNotification } from '@/lib/notify-server';
import { getIngestKey, ingestKeyMatches } from '@/lib/ingest-auth';

// Public ingest endpoint for the hosted n8n forms.
//
//   POST /api/forms/ingest?type=close-deal          (also: book-call, eod-report, after-call)
//   x-api-key: <FORM_INGEST_KEY>
//   { "Client Name": "...", "Deal Value": "5000", ... }
//
// n8n has no CRM session, so the workspace header the browser sends is absent.
// A shared ingest key authenticates the workflow instead, and the record lands in
// the workspace named in the payload (default: 'default').

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

export async function POST(req) {
  await initStore();
  try {
    var url = new URL(req.url);
    var raw = await readBody(req);

    var expected = await getIngestKey();
    var presented = req.headers.get('x-api-key')
      || (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
      || url.searchParams.get('key')
      || raw.apiKey || raw.key || '';

    if (!expected) {
      return NextResponse.json(
        { error: 'Ingest key not configured. Set FORM_INGEST_KEY on the CRM before pointing n8n at this endpoint.' },
        { status: 503, headers: cors() }
      );
    }
    if (!ingestKeyMatches(expected, presented)) {
      console.warn('[Ingest] Rejected submission — bad or missing key');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: cors() });
    }

    var requestedType = url.searchParams.get('type') || url.searchParams.get('form') || raw.formType || raw.type || '';
    var norm = normalizeSubmission(requestedType, raw);
    if (norm.error) {
      return NextResponse.json({ error: norm.error }, { status: 400, headers: cors() });
    }

    var type = norm.type;
    var record = norm.record;

    // Minimum viable record per form — a blank submission should fail loudly at
    // n8n rather than land as an empty row in the CRM.
    if (type === 'eod-report' && !record.salesRep) {
      return NextResponse.json({ error: 'Missing rep name (Your Name)' }, { status: 400, headers: cors() });
    }
    if (type !== 'eod-report' && !record.leadsName) {
      return NextResponse.json({ error: 'Missing lead name' }, { status: 400, headers: cors() });
    }

    var entry;
    if (type === 'book-call') entry = addBookedCall(record);
    else if (type === 'close-deal') entry = addClosedDeal(record);
    else if (type === 'after-call') entry = addAfterCallReport(record);
    else entry = addEODReport(record);

    var closerName = record.closer || record.closerName || record.salesRep || '';
    if (record.closerEmail || closerName) registerCloser(record.closerEmail || '', closerName);

    console.log('[Ingest]', type, '->', entry.id, '|', record.leadsName || record.salesRep);

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
    return NextResponse.json({ error: e.message }, { status: 500, headers: cors() });
  }
}

// Lets you verify wiring from a browser or n8n's "Test step" without writing data.
export async function GET(req) {
  var url = new URL(req.url);
  var type = resolveFormType(url.searchParams.get('type') || '');
  var expected = await getIngestKey();
  return NextResponse.json({
    ok: true,
    endpoint: '/api/forms/ingest?type=book-call|close-deal|eod-report|after-call',
    typeResolved: type || null,
    ingestKeyConfigured: !!expected,
    howToAuth: 'Send header  x-api-key: <FORM_INGEST_KEY>',
  }, { headers: cors() });
}
