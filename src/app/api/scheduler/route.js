import { NextResponse } from 'next/server';
import { getSchedulerState, updateSchedulerConfig, initScheduler, runEODReminder } from '@/lib/scheduler';

export var dynamic = 'force-dynamic';

export async function GET() {
  try {
    var state = getSchedulerState();
    return NextResponse.json({ success: true, scheduler: state });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    var body = await req.json();

    // Run now action
    if (body.action === 'run-eod-reminder') {
      var result = await runEODReminder();
      return NextResponse.json({ success: true, result: result });
    }

    // Update config
    updateSchedulerConfig(body);
    initScheduler();
    return NextResponse.json({ success: true, scheduler: getSchedulerState() });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
