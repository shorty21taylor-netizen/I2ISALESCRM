import { NextResponse } from 'next/server';
import { runDailySummary } from '@/lib/scheduler';
import { initStore } from '@/lib/store';

export async function POST() {
  await initStore();
  try {
    await initStore();
    var today = new Date().toISOString().split('T')[0];
    var summary = getDailyTeamSummary(today);
    return NextResponse.json({ success: true, summary: summary });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
