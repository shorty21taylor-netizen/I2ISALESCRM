import { NextResponse } from 'next/server';
import { addClosedDeal, getStore, registerCloser, initStore } from '@/lib/store';
import { sendGroupMessage } from '@/lib/whatsapp';

export async function POST(req) {
  await initStore();
  try {
    await initStore();
    var body = await req.json();
    if (!body.leadsName || !body.cashCollected) {
      return NextResponse.json({ error: 'leadsName and cashCollected required' }, { status: 400 });
    }
    var entry = addClosedDeal(body);
    // Auto-register closer on submission
    if (body.closerEmail || body.closer) {
      registerCloser(body.closerEmail || '', body.closer || body.closerName || '');
    }
    console.log('[Close Deal]', entry.closer, '->', entry.leadsName, '$' + entry.cashCollected);

    // Send WhatsApp celebration to team group
    var message = '🔥 *DEAL CLOSED!* 🔥\n\n';
    message += entry.closer + ' just closed ' + entry.leadsName + '!\n\n';
    message += '💰 $' + entry.cashCollected.toLocaleString() + '\n';
    message += 'Program: ' + (entry.program || 'N/A') + '\n';
    message += 'Processor: ' + (entry.paymentProcessor || 'N/A') + '\n';
    if (entry.setter) message += 'Setter: ' + entry.setter + '\n';
    message += '\nLet\'s go! 🚀';

    sendGroupMessage(message).catch(function(e) {
      console.error('[Close Deal] WhatsApp error:', e.message);
    });

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
