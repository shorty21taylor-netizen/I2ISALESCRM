import { NextResponse } from 'next/server';
import { addBookedCall, getStore, registerCloser, initStore } from '@/lib/store';

var OFFER_LABELS = { 'saas': 'SaaS (Fund2Grow)', 'coaching': 'Coaching (Digital Programs)', 'dfy-funding': 'DFY Funding (Inner Circle)' };
function offerLabel(p) { return OFFER_LABELS[(p || '').toLowerCase()] || p || 'N/A'; }

export async function POST(req) {
  await initStore();
  try {
    var body = await req.json();
    if (!body.leadsName) {
      return NextResponse.json({ error: 'leadsName required' }, { status: 400 });
    }
    var entry = addBookedCall(body);
    if (body.closerEmail || body.closer) {
      registerCloser(body.closerEmail || '', body.closer || '');
    }
    console.log('[Book Call]', entry.closer || entry.setter, '->', entry.leadsName);
    console.log('[Book Call] _whatsapp:', body._whatsapp ? ('enabled=' + body._whatsapp.enabled + ' groupId=' + (body._whatsapp.groupId || 'NONE').substring(0, 15)) : 'NOT ATTACHED');

    // INSTANT WhatsApp — fires right now
    if (body._whatsapp && body._whatsapp.enabled && body._whatsapp.groupId) {
      try {
        var ts = new Date().toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });

        var msg = '📞 NEW BOOKED CALL 📞\n'
          + '═══════════════════════\n\n'
          + '👤 Lead: ' + entry.leadsName + '\n'
          + '📱 Phone: ' + (entry.leadsPhone || 'N/A') + '\n'
          + '🎯 Program: ' + offerLabel(entry.program) + '\n'
          + '✅ Qualified: ' + (entry.qualified || 'N/A') + '\n'
          + '📅 Booked For: ' + (entry.bookedDay || 'TBD') + ' at ' + (entry.bookedTime || 'TBD') + '\n'
          + '🔗 Source: ' + (entry.outboundInbound || 'N/A') + '\n\n'
          + '👥 Setter: ' + (entry.setter || 'N/A') + '\n'
          + '🎯 Closer: ' + (entry.closer || 'N/A') + '\n'
          + (entry.notes ? '\n📝 Notes: ' + entry.notes + '\n' : '')
          + '\n⏰ ' + ts + '\n'
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
      } catch (e) { console.error('[Book Call WhatsApp]', e.message); }
    }

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
