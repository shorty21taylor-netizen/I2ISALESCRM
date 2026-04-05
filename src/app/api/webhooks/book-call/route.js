import { NextResponse } from 'next/server';
import { addBookedCall, getStore, registerCloser, initStore } from '@/lib/store';
import { sendGroupMessage } from '@/lib/whatsapp';

export async function POST(req) {
  await initStore();
  try {
    await initStore();
    var body = await req.json();
    if (!body.leadsName) {
      return NextResponse.json({ error: 'leadsName required' }, { status: 400 });
    }
    var entry = addBookedCall(body);
    // Auto-register closer on submission
    if (body.closerEmail || body.closer) {
      registerCloser(body.closerEmail || '', body.closer || '');
    }
    console.log('[Book Call]', entry.closer || entry.setter, '->', entry.leadsName);

    // Send WhatsApp notification to team group
    var message = '📞 *New Call Booked!*\n\n';
    message += 'Lead: ' + entry.leadsName + '\n';
    message += 'Program: ' + (entry.program || 'N/A') + '\n';
    message += 'Closer: ' + (entry.closer || 'TBD') + '\n';
    message += 'Setter: ' + (entry.setter || 'N/A') + '\n';
    message += 'Day: ' + (entry.bookedDay || 'TBD') + '\n';
    message += 'Time: ' + (entry.bookedTime || 'TBD') + '\n';
    message += 'Source: ' + (entry.outboundInbound || 'N/A') + '\n';
    if (entry.notes) message += 'Notes: ' + entry.notes;

    sendGroupMessage(message).catch(function(e) {
      console.error('[Book Call] WhatsApp error:', e.message);
    });

    return NextResponse.json({ success: true, submission: entry });
  } catch (e) {
    console.error('[Book Call Error]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET() {
  await initStore();
  var store = getStore();
  return NextResponse.json({ success: true, data: store.bookedCalls });
}
