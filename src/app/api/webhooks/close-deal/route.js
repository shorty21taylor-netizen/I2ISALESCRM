import { NextResponse } from 'next/server';
import { addClosedDeal, getStore, registerCloser, initStore, getWhatsappConfig } from '@/lib/store';
import { sendWhatsApp } from '@/lib/whatsapp';

var OFFER_LABELS = { 'saas': 'SaaS (Fund2Grow)', 'coaching': 'Coaching (Digital Programs)', 'dfy-funding': 'DFY Funding (Inner Circle)' };
function offerLabel(p) { return OFFER_LABELS[(p || '').toLowerCase()] || p || 'N/A'; }

export async function POST(req) {
  console.log('[CLOSE-DEAL] === REQUEST RECEIVED ===');
  await initStore();
  console.log('[CLOSE-DEAL] initStore done');
  try {
    var body = await req.json();
    console.log('[CLOSE-DEAL] Body parsed, leadsName:', body.leadsName);
    console.log('[CLOSE-DEAL] body._whatsapp present:', !!body._whatsapp);
    if (body._whatsapp) {
      console.log('[CLOSE-DEAL] _whatsapp:', JSON.stringify({ enabled: body._whatsapp.enabled, apiUrl: !!body._whatsapp.apiUrl, apiKey: !!body._whatsapp.apiKey, groupId: body._whatsapp.groupId ? body._whatsapp.groupId.substring(0, 15) : 'NONE' }));
    }

    if (!body.leadsName || !body.cashCollected) {
      return NextResponse.json({ error: 'leadsName and cashCollected required' }, { status: 400 });
    }
    var entry = addClosedDeal(body);
    console.log('[CLOSE-DEAL] Saved to store, id:', entry.id);
    if (body.closerEmail || body.closer) {
      registerCloser(body.closerEmail || '', body.closer || body.closerName || '');
    }

    // Read server-side WhatsApp config
    var waCfg = getWhatsappConfig();
    console.log('[CLOSE-DEAL] Server config — apiUrl:', waCfg.assistroApiUrl ? 'SET' : 'EMPTY');
    console.log('[CLOSE-DEAL] Server config — apiKey:', waCfg.assistroApiKey ? 'SET' : 'EMPTY');
    console.log('[CLOSE-DEAL] Server config — closedDealEnabled:', waCfg.closedDealEnabled);
    console.log('[CLOSE-DEAL] Server config — closedDealGroupId:', waCfg.closedDealGroupId ? 'SET (' + waCfg.closedDealGroupId.substring(0, 15) + '...)' : 'EMPTY');

    var waResult = { sent: false };

    // Merge server + client config: prefer server, fill gaps from client _whatsapp
    var clientWa = body._whatsapp || {};
    var apiUrl = waCfg.assistroApiUrl || clientWa.apiUrl || '';
    var apiKey = waCfg.assistroApiKey || clientWa.apiKey || '';
    var groupId = waCfg.closedDealGroupId || clientWa.groupId || '';
    var enabled = waCfg.closedDealEnabled !== false;

    console.log('[CLOSE-DEAL] Merged config — apiUrl:', apiUrl ? 'SET' : 'EMPTY', 'groupId:', groupId ? groupId.substring(0, 15) + '...' : 'EMPTY');

    if (apiUrl && enabled && groupId) {
      var ts = new Date().toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
      var cash = '$' + Number(entry.cashCollected).toLocaleString();
      var msg = '🔥💰 CLOSED DEAL 💰🔥\n'
        + '═══════════════════════\n\n'
        + 'Lead: ' + entry.leadsName + '\n'
        + 'Phone: ' + (entry.leadsPhone || 'N/A') + '\n'
        + 'Email: ' + (entry.leadsEmail || 'N/A') + '\n'
        + 'Program: ' + offerLabel(entry.program) + '\n\n'
        + 'Cash Collected: ' + cash + '\n'
        + 'Payment: ' + (entry.paymentDetails || 'N/A') + '\n'
        + 'Processor: ' + (entry.paymentProcessor || 'N/A') + '\n'
        + 'Agreement: ' + (entry.paymentAgreement || 'N/A') + '\n\n'
        + 'Setter: ' + (entry.setter || 'N/A') + '\n'
        + 'Closer: ' + (entry.closer || 'N/A') + '\n\n'
        + ts + '\n'
        + '═══════════════════════';
      console.log('[CLOSE-DEAL] Message built, length:', msg.length);
      console.log('[CLOSE-DEAL] Calling sendWhatsApp...');
      waResult = await sendWhatsApp(apiUrl, apiKey, groupId, msg);
      console.log('[CLOSE-DEAL] sendWhatsApp returned:', JSON.stringify(waResult));
    } else {
      console.log('[CLOSE-DEAL] NO WHATSAPP — url:', !!apiUrl, 'on:', enabled, 'gid:', !!groupId);
    }

    return NextResponse.json({ success: true, submission: entry, whatsapp: waResult });
  } catch (e) {
    console.error('[CLOSE-DEAL] FATAL ERROR:', e.message, e.stack);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET() {
  await initStore();
  var store = getStore();
  return NextResponse.json({ success: true, data: store.closedDeals });
}
