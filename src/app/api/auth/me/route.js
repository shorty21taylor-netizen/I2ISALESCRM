import { NextResponse } from 'next/server';
import { initStore, getWorkspaces } from '@/lib/store';
import { resolveAccess } from '@/lib/access';

export var dynamic = 'force-dynamic';

// Who is this caller, and which workspaces may they use? The client uses this to
// decide whether to show the workspace switcher and the Owner View.
export async function GET(req) {
  await initStore();
  try {
    var access = await resolveAccess(req);
    var all = getWorkspaces();
    var visible = access.canSeeAll
      ? all
      : all.filter(function(w) { return w.id === access.workspaceId; });

    return NextResponse.json({
      success: true,
      email: access.email,
      role: access.role,
      isOwner: access.isOwner,
      canSeeAll: access.canSeeAll,
      workspaceId: access.workspaceId,
      workspaces: visible,
    });
  } catch (e) {
    console.error('[Auth Me]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
