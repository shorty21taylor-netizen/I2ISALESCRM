import { NextResponse } from 'next/server';
import { initStore, getWorkspaces } from '@/lib/store';
import { resolveAccess } from '@/lib/access';

export var dynamic = 'force-dynamic';

// Who is this caller, and which workspaces may they use? The client uses this to
// decide whether to show the workspace switcher and the Operator View.
export async function GET(req) {
  await initStore();
  try {
    var access = await resolveAccess(req);
    var all = getWorkspaces();
    var visible = access.canSeeAll
      ? all
      : all.filter(function(w) { return access.workspaceIds.indexOf(w.id) !== -1; });

    return NextResponse.json({
      success: true,
      email: access.email,
      role: access.role,
      isOwner: access.isOperator,
      isOperator: access.isOperator,
      canSeeAll: access.canSeeAll,
      // Someone in more than one workspace can still switch between their own.
      canSwitch: access.canSeeAll || visible.length > 1,
      workspaceIds: access.workspaceIds,
      workspaceId: access.canSeeAll ? null : access.workspaceIds[0],
      workspaces: visible,
    });
  } catch (e) {
    console.error('[Auth Me]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
