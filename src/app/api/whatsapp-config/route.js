import { NextResponse } from 'next/server';
import { setWhatsAppConfig, getWhatsAppConfig, isWhatsAppConfigured } from '@/lib/whatsapp';
import { updateSchedulerConfig, initScheduler } from '@/lib/scheduler';

export async function POST(req) {
  try {
    var body = await req.json();

    // Update WhatsApp config
    if (body.assistroApiUrl !== undefined || body.assistroApiKey !== undefined || body.whatsappGroupId !== undefined || body.adminPhone !== undefined) {
      setWhatsAppConfig(body);
    }

    // Update scheduler config
    if (body.timezone !== undefined || body.eodReminderEnabled !== undefined || body.schedulerEnabled !== undefined) {
      updateSchedulerConfig(body);
    }

    // Start scheduler if not running
    initScheduler();

    return NextResponse.json({ success: true, configured: isWhatsAppConfigured() });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    var config = getWhatsAppConfig();
    return NextResponse.json({
      success: true,
      configured: isWhatsAppConfigured(),
      hasApiUrl: !!config.assistroApiUrl,
      hasApiKey: !!config.assistroApiKey,
      hasGroupId: !!config.whatsappGroupId,
      hasAdminPhone: !!config.adminPhone,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
