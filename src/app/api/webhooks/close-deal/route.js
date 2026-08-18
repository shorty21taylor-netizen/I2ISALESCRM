import { NextResponse } from 'next/server';
import { effectiveReadWorkspace, effectiveWriteWorkspace, matchesWorkspace } from '@/lib/access';
import { addClosedDeal, getStore, registerCloser, initStore, getWhatsappConfig } from '@/lib/store';

var OFFER_LABELS = { 'saas': 'SaaS (Fund2Grow)', 'coaching': 'Coaching (Digital Programs)', 'dfy-funding': 'DFY Funding (Inner Circle)' };
function offerLabel(p) { return OFFER_LABELS[(p || '').toLowerCase()] || p || 'N/A'; }

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

    // WhatsApp — read config from SERVER store
    var wc = getWhatsappConfig();
    var waGroupId = wc.closedDealGroupId || '';
    var waResult = { sent: false };

    if (!waGroupId && body._whatsapp && body._whatsapp.groupId) {
      wc = { assistroApiUrl: body._whatsapp.apiUrl, assistroApiKey: body._whatsapp.apiKey };
      waGroupId = body._whatsapp.groupId;
    }

    if (wc.assistroApiUrl && waGroupId) {
      try {
        var ts = new Date().toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
        var cash = '$' + Number(entry.cashCollected).toLocaleString();
        var msg = '🔥💰 CLOSED DEAL 💰🔥\n'
          + '═══════════════════════\n\n'
          + '👤 Lead: ' + entry.leadsName + '\n'
          + '📱 Phone: ' + (entry.leadsPhone || 'N/A') + '\n'
          + '📧 Email: ' + (entry.leadsEmail || 'N/A') + '\n'
          + '🎯 Program: ' + offerLabel(entry.program) + '\n\n'
          + '💵 Cash Collected: ' + cash + '\n'
          + '💳 Payment: ' + (entry.paymentDetails || 'N/A') + '\n'
          + '🏦 Processor: ' + (entry.paymentProcessor || 'N/A') + '\n'
          + '📄 Agreement: ' + (entry.paymentAgreement || 'N/A') + '\n\n'
          + '👥 Setter: ' + (entry.setter || 'N/A') + '\n'
          + '🎯 Closer: ' + (entry.closer || 'N/A') + '\n\n'
          + '🚀 Let\'s go! Another one! 🚀\n\n'
          + '⏰ ' + ts + '\n'
          + '═══════════════════════';

        var notifyRes = await fetch(new URL('/api/notify', req.url).href, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            assistroApiUrl: wc.assistroApiUrl,
            assistroApiKey: wc.assistroApiKey,
            whatsappGroupId: waGroupId,
            message: msg,
          }),
        });
        waResult = await notifyRes.json().catch(function() { return { sent: false }; });
      } catch (e) { console.error('[Close Deal WhatsApp]', e.message); }
    } else {
      console.log('[Close Deal] WhatsApp skipped — apiUrl:', !!wc.assistroApiUrl, 'groupId:', !!waGroupId);
    }

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
