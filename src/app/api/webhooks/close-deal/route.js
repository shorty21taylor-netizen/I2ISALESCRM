import { NextResponse } from 'next/server';
import { effectiveReadWorkspace, effectiveWriteWorkspace, matchesWorkspace } from '@/lib/access';
import { addClosedDeal, getStore, registerCloser, initStore } from '@/lib/store';
import { sendFormNotification } from '@/lib/notify-server';

export async function POST(req) {
  await initStore();
  try {
    var body = await req.json();
    if (!body.leadsName || !body.cashCollected) {
      return NextResponse.json({ error: 'leadsName and cashCollected required' }, { status: 400 });
    }
    // The server decides the owning workspace; a member cannot write into
    // another client's workspace by posting a different workspaceId.
    body.workspaceId = await effectiveWriteWorkspace(req, body.workspaceId);
    var entry = addClosedDeal(body);
    if (body.closerEmail || body.closer) {
      registerCloser(body.closerEmail || '', body.closer || body.closerName || '');
    }
    console.log('[Close Deal]', entry.closer, '->', entry.leadsName, '$' + entry.cashCollected);

    // WhatsApp — routed through the shared sender so the send is logged
    // alongside the ones that come in from the n8n forms.
    var waResult = await sendFormNotification({
      req: req,
      formType: 'close-deal',
      entry: entry,
      source: 'crm',
      override: body._whatsapp,
    });

    return NextResponse.json({ success: true, submission: entry, whatsapp: waResult });
  } catch (e) {
    console.error('[Close Deal Error]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET(req) {
  await initStore();
  var store = getStore();
  var workspaceId = await effectiveReadWorkspace(req, new URL(req.url).searchParams.get('workspace'));
  var data = store.closedDeals;
  data = data.filter(function(r) { return matchesWorkspace(r, workspaceId); });
  return NextResponse.json({ success: true, data: data, workspaceId: workspaceId || null });
}
