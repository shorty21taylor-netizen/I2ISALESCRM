import { NextResponse } from 'next/server';
import { setWhatsAppConfig, getWhatsAppConfig, isWhatsAppConfigured } from '@/lib/whatsapp';
import { updateSchedulerConfig, initScheduler } from '@/lib/scheduler';
import { initStore, setWhatsappConfig, getWhatsappConfig } from '@/lib/store';

export async function POST(req) {
  await initStore();
  try {
    var body = await req.json();

    // Update legacy WhatsApp config (whatsapp.js — used by scheduler)
    if (body.assistroApiUrl !== undefined || body.assistroApiKey !== undefined || body.whatsappGroupId !== undefined || body.adminPhone !== undefined) {
      setWhatsAppConfig(body);
    }

    // Update NEW server-side WhatsApp config (store.js — used by webhooks)
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

    schedulerUpdate.eodReminder = { groupId: body.eodReminderGroupId || body.whatsappGroupId || '' };
    schedulerUpdate.morningDigest = { groupId: body.morningDigestGroupId || body.whatsappGroupId || '' };
    schedulerUpdate.adminMorningReport = { phone: body.adminMorningReportPhone || body.adminPhone || '' };

    updateSchedulerConfig(schedulerUpdate);

    var host = req.headers.get('host');
    var proto = req.headers.get('x-forwarded-proto') || 'https';
    var baseUrl = host ? (proto + '://' + host) : '';
    initScheduler(baseUrl);

    var wc = getWhatsappConfig();
    return NextResponse.json({
      success: true,
      configured: !!(wc.assistroApiUrl && (wc.bookedCallGroupId || wc.closedDealGroupId || wc.eodReportGroupId)),
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET() {
  await initStore();
  try {
    var wc = getWhatsappConfig();
    return NextResponse.json({
      success: true,
      configured: !!(wc.assistroApiUrl && (wc.bookedCallGroupId || wc.closedDealGroupId || wc.eodReportGroupId)),
      hasApiUrl: !!wc.assistroApiUrl,
      hasApiKey: !!wc.assistroApiKey,
      hasGroupId: !!(wc.bookedCallGroupId || wc.closedDealGroupId || wc.eodReportGroupId),
      hasAdminPhone: false,
      config: {
        bookedCallGroupId: wc.bookedCallGroupId ? 'set' : 'empty',
        bookedCallEnabled: wc.bookedCallEnabled,
        closedDealGroupId: wc.closedDealGroupId ? 'set' : 'empty',
        closedDealEnabled: wc.closedDealEnabled,
        eodReportGroupId: wc.eodReportGroupId ? 'set' : 'empty',
        eodReportEnabled: wc.eodReportEnabled,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
