import { NextResponse } from 'next/server';
import { initStore, getWorkspace, getDisplayNameState, getOnboardingSteps } from '@/lib/store';
import { resolveAccess, visibleWorkspaces } from '@/lib/access';
import { progressFor } from '@/lib/onboarding-plan';
import { rotationOverdue } from '@/lib/workspace-auth';
import { mintSession, attachSession, shouldSlide, sessionTokenFrom, readSession } from '@/lib/session';

export var dynamic = 'force-dynamic';

// Who is this caller, which workspaces may they use, and are they finished
// signing in? Every page asks this, so it is also where the session's expiry
// slides forward on activity.
export async function GET(req) {
  await initStore();
  try {
    var access = await resolveAccess(req);

    if (!access.email) {
      // Named plainly so the client can tell "never signed in" from "signed out
      // from under you" and say the right thing.
      return NextResponse.json({
        success: false,
        signedIn: false,
        reason: access.sessionReason || 'none',
      }, { status: 401 });
    }

    var workspaces = await visibleWorkspaces(access);
    var nameState = getDisplayNameState(access.email);
    var current = access.workspaceIds[0] ? getWorkspace(access.workspaceIds[0]) : null;

    var payload = {
      success: true,
      signedIn: true,
      email: access.email,
      role: access.role,
      name: nameState.displayName || '',
      needsNameConfirmation: !nameState.confirmedAt,
      isOwner: access.isOperator,
      isOperator: access.isOperator,
      canSeeAll: access.canSeeAll,
      canSeeTeam: access.canSeeTeam,
      canSwitch: access.canSeeAll || workspaces.length > 1,
      workspaceIds: access.workspaceIds,
      workspaceId: access.canSeeAll ? null : access.workspaceIds[0],
      workspaces: workspaces,
      // Nobody should be sitting in the product with nowhere to be. The copy for
      // it lives on the client; this is the flag that raises it.
      noWorkspace: !access.canSeeAll && workspaces.length === 0,
      // The nav needs this on every page, so it rides along with the access
      // check rather than costing a second request everywhere.
      onboarding: progressFor(getOnboardingSteps(access.email)),
      // Only the people who could act on it are told.
      rotationOverdue: !!(current && access.canSeeTeam && rotationOverdue(current)),
    };

    var response = NextResponse.json(payload);

    // Sliding expiry: a rep working a full day never gets logged out mid-EOD,
    // and a laptop left alone still closes its own door after twelve hours.
    var body = await readSession(sessionTokenFrom(req));
    if (body && shouldSlide(body)) {
      var fresh = await mintSession({
        email: body.email,
        workspaceId: body.workspaceId,
        role: body.role,
        wsStamp: body.wsStamp,
        proven: body.proven,
      });
      attachSession(response, fresh);
    }

    return response;
  } catch (e) {
    console.error('[Auth Me]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
