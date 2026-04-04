import { NextResponse } from 'next/server';
import { getSchedulerState, updateSchedulerConfig, initScheduler, runEODReminder, runMorningDigest, runAdminMorningReport } from '@/lib/scheduler';
import { initStore } from '@/lib/store';

export var dynamic = 'force-dynamic';

export async function GET() {
  await initStore();
  try {
    var state = getSchedulerState();
    return NextResponse.json({ success: true, scheduler: state });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  await initStore();
  try {
    var body = await req.json();

    // Run now actions
    if (body.action === 'run-eod-reminder') {
      await runEODReminder();
      return NextResponse.json({ success: true, task: 'eodReminder', message: 'EOD reminder sent' });
    }

    if (body.action === 'run-morning-digest') {
      await runMorningDigest();
      return NextResponse.json({ success: true, task: 'morningDigest', message: 'Morning digest sent' });
    }

    if (body.action === 'run-admin-report') {
      await runAdminMorningReport();
      return NextResponse.json({ success: true, task: 'adminMorningReport', message: 'Admin report sent' });
    }

    // Update config
    updateSchedulerConfig(body);
    initScheduler();
    return NextResponse.json({ success: true, scheduler: getSchedulerState() });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
