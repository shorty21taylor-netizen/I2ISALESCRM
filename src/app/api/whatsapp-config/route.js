import { NextResponse } from 'next/server';
import { setWhatsAppConfig, getWhatsAppConfig, isWhatsAppConfigured } from '@/lib/whatsapp';
import { updateSchedulerConfig, initScheduler } from '@/lib/scheduler';
import { initStore, getWhatsappConfig, setWhatsappConfig } from '@/lib/store';

export async function POST(req) {
  await initStore();
  try {
    var body = await req.json();
    console.log('[WA-CONFIG] POST received — keys:', Object.keys(body).join(', '));
    console.log('[WA-CONFIG] apiUrl:', body.assistroApiUrl ? 'SET' : 'empty');
    console.log('[WA-CONFIG] apiKey:', body.assistroApiKey ? 'SET' : 'empty');
    console.log('[WA-CONFIG] bookedCallGroupId:', body.bookedCallGroupId ? body.bookedCallGroupId.substring(0, 15) : 'empty');
    console.log('[WA-CONFIG] closedDealGroupId:', body.closedDealGroupId ? body.closedDealGroupId.substring(0, 15) : 'empty');
    console.log('[WA-CONFIG] eodReportGroupId:', body.eodReportGroupId ? body.eodReportGroupId.substring(0, 15) : 'empty');
    console.log('[WA-CONFIG] whatsappGroupId (legacy):', body.whatsappGroupId ? body.whatsappGroupId.substring(0, 15) : 'empty');

    // Update WhatsApp config in whatsapp.js (for scheduler)
    if (body.assistroApiUrl !== undefined || body.assistroApiKey !== undefined || body.whatsappGroupId !== undefined || body.adminPhone !== undefined) {
      setWhatsAppConfig(body);
    }

    // Update WhatsApp config in store.js (for webhooks)
    setWhatsappConfig(body);

    // Map per-destination config to scheduler
    var schedulerUpdate = {};
    if (body.assistroApiUrl !== undefined) schedulerUpdate.assistroApiUrl = body.assistroApiUrl;
    if (body.assistroApiKey !== undefined) schedulerUpdate.assistroApiKey = body.assistroApiKey;
    if (body.timezone !== undefined) schedulerUpdate.timezone = body.timezone;
    if (body.crmUrl !== undefined) schedulerUpdate.crmUrl = body.crmUrl;
    if (body.eodReminderEnabled !== undefined) schedulerUpdate.eodReminderEnabled = body.eodReminderEnabled;
    if (body.morningDigestEnabled !== undefined) schedulerUpdate.morningDigestEnabled = body.morningDigestEnabled;
    if (body.adminMorningReportEnabled !== undefined) schedulerUpdate.adminMorningReportEnabled = body.adminMorningReportEnabled;

    // Per-destination: use specific IDs if provided, fall back to defaults
    schedulerUpdate.eodReminder = { groupId: body.eodReminderGroupId || body.whatsappGroupId || '' };
    schedulerUpdate.morningDigest = { groupId: body.morningDigestGroupId || body.whatsappGroupId || '' };
    schedulerUpdate.adminMorningReport = { phone: body.adminMorningReportPhone || body.adminPhone || '' };

    updateSchedulerConfig(schedulerUpdate);

    // Start scheduler if not running
    var host = req.headers.get('host');
    var proto = req.headers.get('x-forwarded-proto') || 'https';
    var baseUrl = host ? (proto + '://' + host) : '';
    initScheduler(baseUrl);

    var wc = getWhatsappConfig();
    return NextResponse.json({
      success: true,
      configured: isWhatsAppConfigured(),
      serverConfig: {
        hasApiUrl: !!wc.assistroApiUrl,
        bookedCallGroupId: !!wc.bookedCallGroupId,
        closedDealGroupId: !!wc.closedDealGroupId,
        eodReportGroupId: !!wc.eodReportGroupId,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET() {
  await initStore();
  try {
    var config = getWhatsAppConfig();
    var wc = getWhatsappConfig();
    return NextResponse.json({
      success: true,
      configured: isWhatsAppConfigured(),
      hasApiUrl: !!config.assistroApiUrl,
      hasApiKey: !!config.assistroApiKey,
      hasGroupId: !!config.whatsappGroupId,
      hasAdminPhone: !!config.adminPhone,
      serverConfig: {
        hasApiUrl: !!wc.assistroApiUrl,
        bookedCallGroupId: !!wc.bookedCallGroupId,
        closedDealGroupId: !!wc.closedDealGroupId,
        eodReportGroupId: !!wc.eodReportGroupId,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
