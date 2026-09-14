import { NextResponse } from 'next/server';
import {
  initStore, getOnboardingSteps, setOnboardingStep, getOnboardingResources, getCloserProfile,
} from '@/lib/store';
import { callerEmail, resolveAccess, effectiveReadWorkspace } from '@/lib/access';
import { getUser } from '@/lib/users';
import { stepById, progressFor, PHASES } from '@/lib/onboarding-plan';

export var dynamic = 'force-dynamic';

// A rep's onboarding: where they are, and what the workspace has attached to each
// step. Never the secrets themselves — those come one at a time from
// /api/onboarding/resources, so a page load does not put every password on the
// wire whether or not anyone asked to see one.
export async function GET(req) {
  await initStore();
  try {
    var viewer = await callerEmail(req);
    if (!viewer) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });

    var url = new URL(req.url);
    var access = await resolveAccess(req);
    var requested = (url.searchParams.get('rep') || '').trim().toLowerCase();
    // A manager may look at someone else's progress. A rep asking for another
    // rep gets their own — there is nothing to explain and nothing to leak.
    var email = (access.canSeeTeam && requested) ? requested : viewer;
    var workspaceId = await effectiveReadWorkspace(req, url.searchParams.get('workspace'));

    var steps = getOnboardingSteps(email);
    var resources = getOnboardingResources(workspaceId);
    var profile = getCloserProfile(email);
    var account = await getUser(email).catch(function() { return null; });

    // Which slots have something behind them, without saying what.
    var logins = {};
    Object.keys(resources.logins || {}).forEach(function(slot) {
      var entry = resources.logins[slot] || {};
      logins[slot] = {
        label: entry.label || '',
        url: entry.url || '',
        username: entry.username || '',
        note: entry.note || '',
        owner: entry.owner || '',
        hasSecret: !!entry.secret,
      };
    });

    return NextResponse.json({
      success: true,
      rep: {
        email: email,
        name: (profile && profile.displayName) || (account && account.name) || email,
        role: (account && account.role) || 'closer',
      },
      viewingSomeoneElse: email !== viewer,
      canVerify: !!access.canSeeTeam,
      phases: PHASES,
      steps: steps,
      progress: progressFor(steps),
      looms: resources.looms || {},
      logins: logins,
    });
  } catch (err) {
    console.error('[api/onboarding]', err);
    return NextResponse.json({ error: 'Could not load onboarding' }, { status: 500 });
  }
}

// Ticking a step, signing an attestation, a manager confirming a demo.
export async function POST(req) {
  await initStore();
  try {
    var viewer = await callerEmail(req);
    if (!viewer) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });

    var body = await req.json();
    var access = await resolveAccess(req);
    var step = stepById(body.step);
    if (!step) return NextResponse.json({ error: 'No such step' }, { status: 400 });

    var target = (body.rep || '').trim().toLowerCase() || viewer;
    var editingSomeoneElse = target !== viewer;
    if (editingSomeoneElse && !access.canSeeTeam) {
      return NextResponse.json({ error: 'You can only update your own onboarding' }, { status: 403 });
    }

    var now = new Date().toISOString();
    var action = body.action || 'toggle';
    var patch;

    if (action === 'verify' || action === 'unverify') {
      // The point of a demo step is that the rep cannot pass themselves.
      if (!access.canSeeTeam) {
        return NextResponse.json({ error: 'Only a manager can confirm a demo' }, { status: 403 });
      }
      if (step.kind !== 'demo') {
        return NextResponse.json({ error: 'That step is not a demo' }, { status: 400 });
      }
      patch = action === 'verify'
        ? { verifiedAt: now, verifiedBy: viewer }
        : { verifiedAt: '', verifiedBy: '' };

    } else if (action === 'own' || action === 'unown') {
      // Phase 0 belongs to the company. The rep cannot tick it, and cannot be
      // blamed for it being untouched.
      if (!access.canSeeTeam) {
        return NextResponse.json({ error: 'Only a manager can tick this one' }, { status: 403 });
      }
      if (step.kind !== 'owner') {
        return NextResponse.json({ error: 'That step is not the company\'s to tick' }, { status: 400 });
      }
      patch = action === 'own' ? { doneAt: now, doneBy: viewer } : { doneAt: '', doneBy: '' };

    } else if (action === 'sign') {
      // A signature is the rep's own. A manager cannot sign on their behalf —
      // that would make the line worthless in exactly the argument it exists for.
      if (editingSomeoneElse) {
        return NextResponse.json({ error: 'An attestation can only be signed by the rep themselves' }, { status: 403 });
      }
      if (step.kind !== 'attest') {
        return NextResponse.json({ error: 'That step is not an attestation' }, { status: 400 });
      }
      var typed = String(body.signature || '').trim();
      if (typed.length < 2) {
        return NextResponse.json({ error: 'Type your name to sign' }, { status: 400 });
      }
      patch = { signedAt: now, signature: typed.slice(0, 80) };

    } else {
      if (step.kind === 'owner') {
        return NextResponse.json({ error: 'That one is the company\'s to tick, not yours' }, { status: 403 });
      }
      if (step.kind === 'attest') {
        return NextResponse.json({ error: 'Sign this one rather than ticking it' }, { status: 400 });
      }
      // A rep marking a demo step only records that they are ready for it.
      patch = body.done === false
        ? { doneAt: '', doneBy: '' }
        : { doneAt: now, doneBy: viewer };
    }

    var result = setOnboardingStep(target, step.id, patch);
    if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });

    var steps = getOnboardingSteps(target);
    return NextResponse.json({ success: true, steps: steps, progress: progressFor(steps) });
  } catch (err) {
    console.error('[api/onboarding POST]', err);
    return NextResponse.json({ error: 'Could not save that' }, { status: 500 });
  }
}
