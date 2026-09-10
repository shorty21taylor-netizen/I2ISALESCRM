import { NextResponse } from 'next/server';
import { repScope, scopeList } from '@/lib/rep-scope';
import { effectiveReadWorkspace, effectiveWriteWorkspace, matchesWorkspace } from '@/lib/access';
import { addEODReport, getStore, registerCloser, initStore } from '@/lib/store';
import { sendFormNotification } from '@/lib/notify-server';
import { checkEODSanity } from '@/lib/form-ingest';

export async function POST(req) {
  await initStore();
  try {
    var body = await req.json();
    if (!body.salesRep) {
      return NextResponse.json({ error: 'salesRep required' }, { status: 400 });
    }
    // The server decides the owning workspace; a member cannot write into
    // another client's workspace by posting a different workspaceId.
    var insane = checkEODSanity({
      closes: parseFloat(body.closes) || 0,
      callsTaken: parseFloat(body.callsTaken) || 0,
      callsTakenAndPitched: parseFloat(body.callsTakenAndPitched) || 0,
      callsNoShowed: parseFloat(body.callsNoShowed) || 0,
      netNewCallsBooked: parseFloat(body.netNewCallsBooked) || 0,
      sets: parseFloat(body.sets) || 0,
      outboundDials: parseFloat(body.outboundDials) || 0,
      conversations: parseFloat(body.conversations) || 0,
      liveCalls: parseFloat(body.liveCalls) || 0,
      followUpsScheduled: parseFloat(body.followUpsScheduled) || 0,
    });
    if (insane) return NextResponse.json({ error: insane }, { status: 400 });

    body.workspaceId = await effectiveWriteWorkspace(req, body.workspaceId);
    var entry = addEODReport(body);
    if (body.closerEmail || body.salesRep) {
      registerCloser(body.closerEmail || '', body.salesRep || body.closerName || '');
    }
    var totalCash = entry.cashCollectedMYFM + entry.cashCollectedI2I;
    console.log('[EOD]', entry.salesRep, '- dials:', entry.outboundDials, 'closes:', entry.closes, 'cash:', totalCash);

    // WhatsApp — routed through the shared sender so the send is logged
    // alongside the ones that come in from the n8n forms.
    var waResult = await sendFormNotification({
      req: req,
      formType: 'eod-report',
      entry: entry,
      source: 'crm',
      override: body._whatsapp,
    });

    return NextResponse.json({ success: true, submission: entry, whatsapp: waResult });
  } catch (e) {
    console.error('[EOD Error]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET(req) {
  await initStore();
  var store = getStore();
  var workspaceId = await effectiveReadWorkspace(req, new URL(req.url).searchParams.get('workspace'));
  var data = store.eodReports;
  data = data.filter(function(r) { return matchesWorkspace(r, workspaceId); });
  // A rep sees their own records; senior roles see the whole workspace.
  var scope = await repScope(req);
  data = scopeList(scope, data, 'eod');
  return NextResponse.json({
    success: true, data: data, workspaceId: workspaceId || null,
    scopedToSelf: !!scope,
  });
}
