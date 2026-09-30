import { NextResponse } from 'next/server';
import { initStore, getStore } from '@/lib/store';
import { effectiveReadWorkspace, matchesWorkspace } from '@/lib/access';
import { repScope, scopeList } from '@/lib/rep-scope';
import { dmSetterBreakdown } from '@/lib/dm-setter-breakdown';
import { recordDay } from '@/lib/report-date';

export var dynamic = 'force-dynamic';

// The DM setters' board. Scoped exactly like every other team read: the server
// resolves the workspace, and a rep is filtered to their own reports rather than
// shown the floor.
export async function GET(req) {
  await initStore();
  try {
    var url = new URL(req.url);
    var start = url.searchParams.get('start') || '';
    var end = url.searchParams.get('end') || '';
    var workspaceId = await effectiveReadWorkspace(req, url.searchParams.get('workspace'));

    var rows = (getStore().eodReports || [])
      .filter(Boolean)
      .filter(function(r) { return matchesWorkspace(r, workspaceId); })
      .filter(function(r) {
        var day = recordDay(r);
        if (!day) return false;
        if (start && day < start) return false;
        if (end && day > end) return false;
        return true;
      });

    // A rep sees only their own; senior roles see the whole workspace.
    var scope = await repScope(req);
    rows = scopeList(scope, rows, 'eod');

    return NextResponse.json({
      success: true,
      workspaceId: workspaceId || null,
      scopedToSelf: !!scope,
      range: { start: start, end: end },
      board: dmSetterBreakdown(rows),
    });
  } catch (e) {
    console.error('[DM setters]', e);
    return NextResponse.json({ error: 'Could not read the DM board.' }, { status: 500 });
  }
}
