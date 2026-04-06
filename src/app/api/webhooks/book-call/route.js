import { NextResponse } from 'next/server';
import { addBookedCall, getStore, registerCloser, initStore, getWhatsappConfig } from '@/lib/store';
import { sendWhatsApp } from '@/lib/whatsapp';

var OFFER_LABELS = { 'saas': 'SaaS (Fund2Grow)', 'coaching': 'Coaching (Digital Programs)', 'dfy-funding': 'DFY Funding (Inner Circle)' };
function offerLabel(p) { return OFFER_LABELS[(p || '').toLowerCase()] || p || 'N/A'; }

export async function POST(req) {
  console.log('[BOOK-CALL] === REQUEST RECEIVED ===');
  await initStore();
  console.log('[BOOK-CALL] initStore done');
  try {
    var body = await req.json();
    console.log('[BOOK-CALL] Body parsed, leadsName:', body.leadsName);
    console.log('[BOOK-CALL] body._whatsapp present:', !!body._whatsapp);
    if (body._whatsapp) {
      console.log('[BOOK-CALL] _whatsapp:', JSON.stringify({ enabled: body._whatsapp.enabled, apiUrl: !!body._whatsapp.apiUrl, apiKey: !!body._whatsapp.apiKey, groupId: body._whatsapp.groupId ? body._whatsapp.groupId.substring(0, 15) : 'NONE' }));
    }

    if (!body.leadsName) {
      return NextResponse.json({ error: 'leadsName required' }, { status: 400 });
    }
    var entry = addBookedCall(body);
    console.log('[BOOK-CALL] Saved to store, id:', entry.id);
    if (body.closerEmail || body.closer) {
      registerCloser(body.closerEmail || '', body.closer || '');
    }

    // Read server-side WhatsApp config
    var waCfg = getWhatsappConfig();
    console.log('[BOOK-CALL] Server config — apiUrl:', waCfg.assistroApiUrl ? 'SET' : 'EMPTY');
    console.log('[BOOK-CALL] Server config — apiKey:', waCfg.assistroApiKey ? 'SET' : 'EMPTY');
    console.log('[BOOK-CALL] Server config — bookedCallEnabled:', waCfg.bookedCallEnabled);
    console.log('[BOOK-CALL] Server config — bookedCallGroupId:', waCfg.bookedCallGroupId ? 'SET (' + waCfg.bookedCallGroupId.substring(0, 15) + '...)' : 'EMPTY');

    var waResult = { sent: false };

    // Determine API URL + group ID (server config first, client fallback)
    var apiUrl = waCfg.assistroApiUrl || '';
    var apiKey = waCfg.assistroApiKey || '';
    var groupId = waCfg.bookedCallGroupId || '';
    var enabled = waCfg.bookedCallEnabled !== false;
    var source = 'server';

    if (!apiUrl && body._whatsapp && body._whatsapp.apiUrl) {
      apiUrl = body._whatsapp.apiUrl;
      apiKey = body._whatsapp.apiKey || '';
      groupId = body._whatsapp.groupId || groupId;
      source = 'client';
    }

    console.log('[BOOK-CALL] WhatsApp source:', (apiUrl && groupId) ? source : 'NONE');

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
      console.log('[BOOK-CALL] Message built, length:', msg.length);
      console.log('[BOOK-CALL] Calling sendWhatsApp...');
      waResult = await sendWhatsApp(apiUrl, apiKey, groupId, msg);
      console.log('[BOOK-CALL] sendWhatsApp returned:', JSON.stringify(waResult));
    } else {
      console.log('[BOOK-CALL] NO WHATSAPP — url:', !!apiUrl, 'on:', enabled, 'gid:', !!groupId);
    }

    return NextResponse.json({ success: true, submission: entry, whatsapp: waResult });
  } catch (e) {
    console.error('[BOOK-CALL] FATAL ERROR:', e.message, e.stack);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET() {
  await initStore();
  var store = getStore();
  return NextResponse.json({ success: true, data: store.bookedCalls });
}
