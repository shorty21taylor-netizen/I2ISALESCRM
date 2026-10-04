import { NextResponse } from 'next/server';
import { initStore, getAfterCallReports, addAfterCallReport, registerCloser } from '@/lib/store';
import { effectiveReadWorkspace, effectiveWriteWorkspace } from '@/lib/access';
import { repScope, scopeList } from '@/lib/rep-scope';
import { sendFormNotification } from '@/lib/notify-server';
import { requireRoute } from '@/lib/submit-guard';

export var dynamic = 'force-dynamic';

// After-call reports used to arrive only through /api/forms/ingest?type=after-call,
// which meant the only way to file one was a hosted n8n form. The POST below is the
// same write the ingest path performs, so a rep can file one in the product itself
// and n8n stops being load-bearing for this record type.
export async function POST(req) {
  await initStore();
  try {
    var body = await req.json();
    if (!body.leadsName) {
      return NextResponse.json({ error: 'leadsName required' }, { status: 400 });
    }
    // The server decides the owning workspace; a member cannot write into
    // another client's workspace by posting a different workspaceId.
    body.workspaceId = await effectiveWriteWorkspace(req, body.workspaceId);

    // No route means no record, so a submission is never saved into a state where
    // nobody was told about it — or worse, where the wrong company was.
    var unrouted = await requireRoute(body.workspaceId, 'after-call');
    if (unrouted) return unrouted;

    body.formSource = 'crm';
    var entry = addAfterCallReport(body);
    if (body.closerEmail || body.closer) {
      registerCloser(body.closerEmail || '', body.closer || '');
    }

    var waResult = await sendFormNotification({
      req: req,
      formType: 'after-call',
      entry: entry,
      source: 'crm',
    });

    return NextResponse.json({ success: true, submission: entry, whatsapp: waResult });
  } catch (e) {
    console.error('[After Call Error]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// The read side the After-Call page renders from.
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
