import { NextResponse } from 'next/server';
import { initStore, getAfterCallReports } from '@/lib/store';
import { effectiveReadWorkspace } from '@/lib/access';
import { repScope, scopeList } from '@/lib/rep-scope';

// After-call reports arrive through /api/forms/ingest?type=after-call. This route
// is the read side the After-Call page renders from.
export async function GET(req) {
  await initStore();
  var workspaceId = await effectiveReadWorkspace(req, new URL(req.url).searchParams.get('workspace'));
  var data = getAfterCallReports(workspaceId);
  var scope = await repScope(req);
  data = scopeList(scope, data, 'afterCall');
  return NextResponse.json({
    success: true, data: data, workspaceId: workspaceId || null,
    scopedToSelf: !!scope,
  });
}
