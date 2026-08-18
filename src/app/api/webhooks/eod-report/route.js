import { NextResponse } from 'next/server';
import { effectiveReadWorkspace, effectiveWriteWorkspace, matchesWorkspace } from '@/lib/access';
import { addEODReport, getStore, registerCloser, initStore, getWhatsappConfig } from '@/lib/store';

export async function POST(req) {
  await initStore();
  try {
    var body = await req.json();
    if (!body.salesRep) {
      return NextResponse.json({ error: 'salesRep required' }, { status: 400 });
    }
    // The server decides the owning workspace; a member cannot write into
    // another client's workspace by posting a different workspaceId.
    body.workspaceId = await effectiveWriteWorkspace(req, body.workspaceId);
    var entry = addEODReport(body);
    if (body.closerEmail || body.salesRep) {
      registerCloser(body.closerEmail || '', body.salesRep || body.closerName || '');
    }
    var totalCash = entry.cashCollectedMYFM + entry.cashCollectedI2I;
    console.log('[EOD]', entry.salesRep, '- dials:', entry.outboundDials, 'closes:', entry.closes, 'cash:', totalCash);

    // WhatsApp — read config from SERVER store
    var wc = getWhatsappConfig();
    var waGroupId = wc.eodReportGroupId || '';
    var waResult = { sent: false };

    // Fallback to client-side _whatsapp
    if (!waGroupId && body._whatsapp && body._whatsapp.groupId) {
      wc = { assistroApiUrl: body._whatsapp.apiUrl, assistroApiKey: body._whatsapp.apiKey };
      waGroupId = body._whatsapp.groupId;
    }

    if (wc.assistroApiUrl && waGroupId) {
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
      } catch (e) { console.error('[EOD WhatsApp]', e.message); }
    } else {
      console.log('[EOD] WhatsApp skipped — apiUrl:', !!wc.assistroApiUrl, 'groupId:', !!waGroupId);
    }

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
  return NextResponse.json({ success: true, data: data, workspaceId: workspaceId || null });
}
