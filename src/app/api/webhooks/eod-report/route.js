import { NextResponse } from 'next/server';
import { addEODReport, getStore, registerCloser, initStore } from '@/lib/store';

export async function POST(req) {
  await initStore();
  try {
    var body = await req.json();
    if (!body.salesRep) {
      return NextResponse.json({ error: 'salesRep required' }, { status: 400 });
    }
    var entry = addEODReport(body);
    if (body.closerEmail || body.salesRep) {
      registerCloser(body.closerEmail || '', body.salesRep || body.closerName || '');
    }
    var totalCash = entry.cashCollectedMYFM + entry.cashCollectedI2I;
    console.log('[EOD]', entry.salesRep, '- dials:', entry.outboundDials, 'closes:', entry.closes, 'cash:', totalCash);
    console.log('[EOD] _whatsapp:', body._whatsapp ? ('enabled=' + body._whatsapp.enabled + ' groupId=' + (body._whatsapp.groupId || 'NONE').substring(0, 15)) : 'NOT ATTACHED');

    // INSTANT WhatsApp
    if (body._whatsapp && body._whatsapp.enabled && body._whatsapp.groupId) {
      try {
        var ts = new Date().toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
        var cashMYFM = Number(entry.cashCollectedMYFM || 0);
        var cashI2I = Number(entry.cashCollectedI2I || 0);
        var revenue = Number(entry.revenueOnDay || 0);

        var msg = '📋 EOD REPORT 📋\n'
          + '═══════════════════════\n\n'
          + '👤 Sales Rep: ' + entry.salesRep + '\n'
          + '📅 Date: ' + (entry.date || 'Today') + '\n\n'
          + '📊 CALL METRICS\n'
          + '────────────────\n'
          + '📞 Net New Booked: ' + (entry.netNewCallsBooked || 0) + '\n'
          + '📅 On Calendar: ' + (entry.callsOnCalendar || 0) + '\n'
          + '✅ Calls Taken: ' + (entry.callsTaken || 0) + '\n'
          + '❌ No Showed: ' + (entry.callsNoShowed || 0) + '\n'
          + '🚫 Canceled: ' + (entry.callsCanceled || 0) + '\n'
          + '🔄 Rescheduled: ' + (entry.callsRescheduled || 0) + '\n\n'
          + '🎯 PERFORMANCE\n'
          + '────────────────\n'
          + '🗣️ Taken & Pitched: ' + (entry.callsTakenAndPitched || 0) + '\n'
          + '🏆 Closes: ' + (entry.closes || 0) + '\n'
          + '📱 Outbound Dials: ' + (entry.outboundDials || 0) + '\n\n'
          + '💰 REVENUE\n'
          + '────────────────\n'
          + '💵 Cash MYFM: $' + cashMYFM.toLocaleString() + '\n'
          + '💵 Cash I2I: $' + cashI2I.toLocaleString() + '\n'
          + '📈 Revenue: $' + revenue.toLocaleString() + '\n'
          + (entry.improvementPlan ? '\n🔮 TOMORROW\n────────────────\n' + entry.improvementPlan + '\n' : '')
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
      } catch (e) { console.error('[EOD WhatsApp]', e.message); }
    }

    return NextResponse.json({ success: true, submission: entry });
  } catch (e) {
    console.error('[EOD Error]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET() {
  await initStore();
  var store = getStore();
  return NextResponse.json({ success: true, data: store.eodReports });
}
