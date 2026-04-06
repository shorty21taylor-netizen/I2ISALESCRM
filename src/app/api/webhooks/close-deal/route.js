import { NextResponse } from 'next/server';
import { addClosedDeal, getStore, registerCloser, initStore } from '@/lib/store';

var OFFER_LABELS = { 'saas': 'SaaS (Fund2Grow)', 'coaching': 'Coaching (Digital Programs)', 'dfy-funding': 'DFY Funding (Inner Circle)' };
function offerLabel(p) { return OFFER_LABELS[(p || '').toLowerCase()] || p || 'N/A'; }

export async function POST(req) {
  await initStore();
  try {
    var body = await req.json();
    if (!body.leadsName || !body.cashCollected) {
      return NextResponse.json({ error: 'leadsName and cashCollected required' }, { status: 400 });
    }
    var entry = addClosedDeal(body);
    if (body.closerEmail || body.closer) {
      registerCloser(body.closerEmail || '', body.closer || body.closerName || '');
    }
    console.log('[Close Deal]', entry.closer, '->', entry.leadsName, '$' + entry.cashCollected);
    console.log('[Close Deal] _whatsapp:', body._whatsapp ? ('enabled=' + body._whatsapp.enabled + ' groupId=' + (body._whatsapp.groupId || 'NONE').substring(0, 15)) : 'NOT ATTACHED');

    // INSTANT WhatsApp
    if (body._whatsapp && body._whatsapp.enabled && body._whatsapp.groupId) {
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

        await fetch(new URL('/api/notify', req.url).href, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            assistroApiUrl: body._whatsapp.apiUrl,
            assistroApiKey: body._whatsapp.apiKey,
            whatsappGroupId: body._whatsapp.groupId,
            message: msg,
          }),
        });
      } catch (e) { console.error('[Close Deal WhatsApp]', e.message); }
    }

    return NextResponse.json({ success: true, submission: entry });
  } catch (e) {
    console.error('[Close Deal Error]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET() {
  await initStore();
  var store = getStore();
  return NextResponse.json({ success: true, data: store.closedDeals });
}
