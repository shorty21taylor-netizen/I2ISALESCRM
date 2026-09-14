import { NextResponse } from 'next/server';
import {
  initStore, getOnboardingResources, setOnboardingResources, noteCredentialReveal,
  getCredentialReveals, getOnboardingSteps,
} from '@/lib/store';
import { callerEmail, resolveAccess, effectiveReadWorkspace, effectiveWriteWorkspace } from '@/lib/access';
import { seal, open as unseal, hasKey } from '@/lib/secret-box';
import { SLOTS } from '@/lib/onboarding-plan';

export var dynamic = 'force-dynamic';

var MAX_FIELD = 400;
var MAX_NOTE = 600;

function clean(v, max) { return String(v == null ? '' : v).trim().slice(0, max || MAX_FIELD); }

// Only http(s). A javascript: or data: URL in an admin-authored field becomes a
// link every new rep is told to click.
function safeUrl(v) {
  var s = clean(v);
  if (!s) return '';
  return /^https?:\/\//i.test(s) ? s : '';
}

// What Admin sees: every attachment, and whether a secret exists — never the
// secret itself. Revealing is a separate, deliberate request.
export async function GET(req) {
  await initStore();
  try {
    if (!(await callerEmail(req))) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
    var access = await resolveAccess(req);
    if (!access.canSeeTeam) return NextResponse.json({ error: 'Manager access required' }, { status: 403 });

    var url = new URL(req.url);
    var workspaceId = await effectiveReadWorkspace(req, url.searchParams.get('workspace'));
    var resources = getOnboardingResources(workspaceId);

    var logins = {};
    Object.keys(resources.logins || {}).forEach(function(slot) {
      var e = resources.logins[slot] || {};
      logins[slot] = {
        label: e.label || '', url: e.url || '', username: e.username || '',
        note: e.note || '', owner: e.owner || '', hasSecret: !!e.secret,
      };
    });

    return NextResponse.json({
      success: true,
      slots: SLOTS,
      looms: resources.looms || {},
      logins: logins,
      // The editor needs to know before an admin types a password into a field
      // that will refuse it.
      canStoreSecrets: hasKey(),
      reveals: getCredentialReveals(workspaceId).slice(-40),
    });
  } catch (err) {
    console.error('[api/onboarding/resources]', err);
    return NextResponse.json({ error: 'Could not load resources' }, { status: 500 });
  }
}

// Authoring the Looms and logins, and revealing one secret at a time.
export async function POST(req) {
  await initStore();
  try {
    var viewer = await callerEmail(req);
    if (!viewer) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });

    var body = await req.json();
    var access = await resolveAccess(req);
    var url = new URL(req.url);

    // ---- a rep opening one login ----
    if (body.action === 'reveal') {
      var readWs = await effectiveReadWorkspace(req, url.searchParams.get('workspace'));
      var res = getOnboardingResources(readWs);
      var entry = (res.logins || {})[body.slot];
      if (!entry || !entry.secret) return NextResponse.json({ error: 'Nothing stored for that one' }, { status: 404 });

      // Credentials are the reward for finishing the access handover, not a
      // consolation for skipping it — and a rep who has not confirmed their
      // seats has no business pulling a password out of the system.
      if (!access.canSeeTeam) {
        var mine = getOnboardingSteps(viewer);
        var confirmed = mine['acc-confirm'] && mine['acc-confirm'].signedAt;
        if (!confirmed) {
          return NextResponse.json({
            error: 'Sign the access confirmation first — then these open up.',
          }, { status: 403 });
        }
      }

      var value = unseal(entry.secret);
      if (value === null) {
        return NextResponse.json({
          error: 'This is stored but cannot be read — the server key has changed. An admin needs to re-enter it.',
        }, { status: 409 });
      }
      await noteCredentialReveal(readWs, body.slot, viewer);
      return NextResponse.json({ success: true, slot: body.slot, secret: value });
    }

    // ---- an admin authoring them ----
    if (!access.canSeeTeam) return NextResponse.json({ error: 'Manager access required' }, { status: 403 });
    var writeWs = await effectiveWriteWorkspace(req, url.searchParams.get('workspace'));
    var current = getOnboardingResources(writeWs);
    var next = {
      looms: Object.assign({}, current.looms || {}),
      logins: Object.assign({}, current.logins || {}),
    };

    if (body.action === 'loom') {
      var link = safeUrl(body.url);
      if (body.url && !link) {
        return NextResponse.json({ error: 'That needs to be a full https:// link' }, { status: 400 });
      }
      if (link) next.looms[clean(body.step, 60)] = link;
      else delete next.looms[clean(body.step, 60)];

    } else if (body.action === 'login') {
      var slot = clean(body.slot, 60);
      if (!SLOTS.some(function(s) { return s.id === slot; })) {
        return NextResponse.json({ error: 'No such login slot' }, { status: 400 });
      }
      var existing = next.logins[slot] || {};
      var entryNext = {
        label: clean(body.label),
        url: safeUrl(body.url),
        username: clean(body.username),
        note: clean(body.note, MAX_NOTE),
        owner: clean(body.owner),
        secret: existing.secret || '',
      };

      // An empty secret field leaves whatever is stored alone; clearing is an
      // explicit act, so nobody wipes a password by editing a note.
      if (body.clearSecret) {
        entryNext.secret = '';
      } else if (body.secret) {
        var sealed = seal(String(body.secret));
        if (sealed.error) return NextResponse.json({ error: sealed.error }, { status: 400 });
        entryNext.secret = sealed.value;
      }
      next.logins[slot] = entryNext;

    } else if (body.action === 'login-delete') {
      delete next.logins[clean(body.slot, 60)];

    } else {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    var saved = await setOnboardingResources(writeWs, next);
    if (saved.error) return NextResponse.json({ error: saved.error }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[api/onboarding/resources POST]', err);
    return NextResponse.json({ error: 'Could not save that' }, { status: 500 });
  }
}
