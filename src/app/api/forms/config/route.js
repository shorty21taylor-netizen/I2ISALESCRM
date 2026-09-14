import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { initStore } from '@/lib/store';
import { saveAppConfig, loadAppConfig } from '@/lib/db';
import { resolveAccess, effectiveReadWorkspace, OWNER_EMAIL } from '@/lib/access';
import { getIngestKey } from '@/lib/ingest-auth';
import { listForms, bookingLinkFor, formsMissingRoutes, EMPTY_FORMS_MESSAGE } from '@/lib/workspace-config';

export var dynamic = 'force-dynamic';

// What the Submit page renders, for the workspace the caller's session names.
//
// There are no defaults here any more. This route used to hold four form
// constants and a booking URL, with one saved override row for the whole install,
// so every workspace — including one created five minutes ago — came up wearing
// the first workspace's forms and its booking link. A workspace now shows exactly
// what somebody set up for it, which for a new one is nothing.

async function isOwner(req) {
  var access = await resolveAccess(req);
  return access.isOperator || access.email === OWNER_EMAIL;
}

function maskKey(key) {
  if (!key) return '';
  if (key.length <= 8) return '••••';
  return key.slice(0, 4) + '••••' + key.slice(-4);
}

export async function GET(req) {
  await initStore();
  try {
    var access = await resolveAccess(req);
    if (!access.email) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });

    // The workspace comes from the session. A query parameter can narrow an
    // operator's view but can never widen a member's.
    var url = new URL(req.url);
    var workspaceId = await effectiveReadWorkspace(req, url.searchParams.get('workspace'));
    if (Array.isArray(workspaceId) || workspaceId === '__all__') workspaceId = access.workspaceIds[0] || 'default';

    var forms = await listForms(workspaceId);
    var booking = await bookingLinkFor(workspaceId);
    var key = await getIngestKey();
    var cfg = (await loadAppConfig('forms')) || {};
    var owner = await isOwner(req);

    return NextResponse.json({
      success: true,
      workspaceId: workspaceId,
      // An array, in the order an admin arranged them — not a map keyed by four
      // hardcoded names.
      forms: forms,
      // Null means there is no booking link for this workspace, and the card is
      // not rendered. It is never another workspace's calendar.
      bookingLink: booking,
      emptyMessage: EMPTY_FORMS_MESSAGE,
      canSetUp: !!access.canSeeTeam,
      // Live forms that would refuse a submission, so the page can warn the
      // people who can fix it rather than letting a rep find out.
      missingRoutes: access.canSeeTeam ? await formsMissingRoutes(workspaceId) : [],
      useExternalForms: cfg.useExternalForms !== false,
      ingestKeyConfigured: !!key,
      ingestKeySource: process.env.FORM_INGEST_KEY ? 'env' : (cfg.ingestKey ? 'settings' : 'none'),
      ingestKeyMasked: owner ? maskKey(key) : '',
    });
  } catch (e) {
    console.error('[Forms config]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// Only the install-wide settings still live here: the ingest key n8n authenticates
// with, and whether the hosted forms are shown at all. Forms, links and
// destinations moved to /api/admin/workspace/forms, where they are per workspace.
export async function POST(req) {
  await initStore();
  try {
    if (!(await isOwner(req))) {
      return NextResponse.json({ error: 'Operator access required' }, { status: 403 });
    }
    var body = await req.json();
    var cfg = (await loadAppConfig('forms')) || {};

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
      useExternalForms: cfg.useExternalForms !== false,
      ingestKey: generated || undefined,
      ingestKeyConfigured: !!(process.env.FORM_INGEST_KEY || cfg.ingestKey),
      movedNote: 'Forms, booking links and destinations are per workspace now — '
        + 'set them in Workspace settings → Submit forms.',
      note: process.env.FORM_INGEST_KEY
        ? 'FORM_INGEST_KEY is set in the environment and takes precedence over this saved key.'
        : undefined,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
