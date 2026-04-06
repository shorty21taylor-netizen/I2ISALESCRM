import { NextResponse } from 'next/server';
import { addBookedCall, getStore, registerCloser, initStore, getWhatsappConfig } from '@/lib/store';
import { sendWhatsApp } from '@/lib/whatsapp';

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

    // Send WhatsApp — read from server config
    var waCfg = getWhatsappConfig();
    var waResult = { sent: false };

    // Determine API URL + group ID (server config first, client fallback)
    var apiUrl = waCfg.assistroApiUrl || '';
    var apiKey = waCfg.assistroApiKey || '';
    var groupId = waCfg.bookedCallGroupId || '';
    var enabled = waCfg.bookedCallEnabled !== false;

    if (!apiUrl && body._whatsapp && body._whatsapp.apiUrl) {
      apiUrl = body._whatsapp.apiUrl;
      apiKey = body._whatsapp.apiKey || '';
      groupId = body._whatsapp.groupId || groupId;
    }

    if (apiUrl && enabled && groupId) {
      var ts = new Date().toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
      var msg = '📞 NEW BOOKED CALL 📞\n'
        + '═══════════════════════\n\n'
        + 'Lead: ' + entry.leadsName + '\n'
        + 'Phone: ' + (entry.leadsPhone || 'N/A') + '\n'
        + 'Program: ' + offerLabel(entry.program) + '\n'
        + 'Qualified: ' + (entry.qualified || 'N/A') + '\n'
        + 'Booked For: ' + (entry.bookedDay || 'TBD') + ' at ' + (entry.bookedTime || 'TBD') + '\n'
        + 'Source: ' + (entry.outboundInbound || 'N/A') + '\n'
        + 'Setter: ' + (entry.setter || 'N/A') + '\n'
        + 'Closer: ' + (entry.closer || 'N/A') + '\n'
        + (entry.notes ? '\nNotes: ' + entry.notes + '\n' : '')
        + '\n' + ts + '\n'
        + '═══════════════════════';
      waResult = await sendWhatsApp(apiUrl, apiKey, groupId, msg);
    } else {
      console.log('[Book] WA skip — url:', !!apiUrl, 'on:', enabled, 'gid:', !!groupId);
    }

    return NextResponse.json({ success: true, submission: entry, whatsapp: waResult });
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
