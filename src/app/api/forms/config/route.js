import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { initStore } from '@/lib/store';
import { saveAppConfig, loadAppConfig } from '@/lib/db';
import { callerEmail, OWNER_EMAIL } from '@/lib/access';
import { getIngestKey } from '@/lib/ingest-auth';

var DEFAULT_FORMS = {
  'book-call': { label: 'Booked Appointment', url: 'https://summitsales.app.n8n.cloud/form/lead-booking' },
  'close-deal': { label: 'Closed Deal (Gong Channel)', url: 'https://summitsales.app.n8n.cloud/form/deal-won' },
  'eod-report': { label: 'EOD Report', url: 'https://summitsales.app.n8n.cloud/form/eod-report' },
  'after-call': { label: 'After-Call Report', url: 'https://summitsales.app.n8n.cloud/form/after-call-report' },
};

function isOwner(req) {
  return callerEmail(req) === OWNER_EMAIL;
}

function maskKey(key) {
  if (!key) return '';
  if (key.length <= 8) return '••••';
  return key.slice(0, 4) + '••••' + key.slice(-4);
}

// A saved config only holds the forms that existed when it was saved. Returning it
// as-is would hide any form added later behind a stale row in app_config — which is
// exactly what happened to the After-Call card. Defaults underneath, saved on top.
function mergedForms(saved) {
  var out = {};
  Object.keys(DEFAULT_FORMS).forEach(function(k) { out[k] = DEFAULT_FORMS[k]; });
  if (saved) {
    Object.keys(saved).forEach(function(k) {
      if (saved[k] && saved[k].url) out[k] = saved[k];
    });
  }
  return out;
}

export async function GET(req) {
  await initStore();
  try {
    var cfg = (await loadAppConfig('forms')) || {};
    var key = await getIngestKey();
    var owner = isOwner(req);
    return NextResponse.json({
      success: true,
      forms: mergedForms(cfg.forms),
      useExternalForms: cfg.useExternalForms !== false,
      ingestKeyConfigured: !!key,
      ingestKeySource: process.env.FORM_INGEST_KEY ? 'env' : (cfg.ingestKey ? 'settings' : 'none'),
      // Only the operator ever sees key material, and only masked. The full value is
      // shown once, at the moment it is generated.
      ingestKeyMasked: owner ? maskKey(key) : '',
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  await initStore();
  try {
    if (!isOwner(req)) {
      return NextResponse.json({ error: 'Operator access required' }, { status: 403 });
    }
    var body = await req.json();
    var cfg = (await loadAppConfig('forms')) || {};

    if (body.forms) cfg.forms = mergedForms(body.forms);
    if (body.useExternalForms !== undefined) cfg.useExternalForms = !!body.useExternalForms;

    var generated = '';
    if (body.generateKey) {
      generated = crypto.randomBytes(24).toString('hex');
      cfg.ingestKey = generated;
    } else if (body.ingestKey !== undefined) {
      cfg.ingestKey = String(body.ingestKey).trim();
    }

    await saveAppConfig('forms', cfg);

    return NextResponse.json({
      success: true,
      forms: mergedForms(cfg.forms),
      useExternalForms: cfg.useExternalForms !== false,
      // Returned exactly once, right after generation — it is never readable again.
      ingestKey: generated || undefined,
      ingestKeyConfigured: !!(process.env.FORM_INGEST_KEY || cfg.ingestKey),
      note: process.env.FORM_INGEST_KEY
        ? 'FORM_INGEST_KEY is set in the environment and takes precedence over this saved key.'
        : undefined,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
