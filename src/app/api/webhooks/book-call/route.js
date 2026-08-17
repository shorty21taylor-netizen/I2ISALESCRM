import { NextResponse } from 'next/server';
import { addBookedCall, getStore, registerCloser, initStore, getWhatsappConfig } from '@/lib/store';

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

    // WhatsApp — read config from SERVER store (pushed from browser on page load)
    var wc = getWhatsappConfig();
    var waGroupId = wc.bookedCallGroupId || '';
    var waResult = { sent: false };

    // Also accept client-side _whatsapp as fallback
    if (!waGroupId && body._whatsapp && body._whatsapp.groupId) {
      wc = { assistroApiUrl: body._whatsapp.apiUrl, assistroApiKey: body._whatsapp.apiKey };
      waGroupId = body._whatsapp.groupId;
    }

    if (wc.assistroApiUrl && waGroupId) {
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
      } catch (e) { console.error('[Book Call WhatsApp]', e.message); }
    } else {
      console.log('[Book Call] WhatsApp skipped — apiUrl:', !!wc.assistroApiUrl, 'groupId:', !!waGroupId);
    }

    return NextResponse.json({ success: true, submission: entry, whatsapp: waResult });
  } catch (e) {
    console.error('[Book Call Error]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET(req) {
  await initStore();
  var store = getStore();
  var workspaceId = new URL(req.url).searchParams.get('workspace');
  var data = store.bookedCalls;
  if (workspaceId && workspaceId !== '__all__') {
    data = data.filter(function(r) { return (r.workspaceId || 'default') === workspaceId; });
  }
  return NextResponse.json({ success: true, data: data, workspaceId: workspaceId || null });
}
