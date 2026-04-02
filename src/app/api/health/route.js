import { NextResponse } from 'next/server';
import { initStore } from '@/lib/store';
import { initScheduler } from '@/lib/scheduler';

export async function GET(req) {
  await initStore();

  var protocol = req.headers.get('x-forwarded-proto') || 'http';
  var host = req.headers.get('host') || 'localhost:3000';
  initScheduler(protocol + '://' + host);

  return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() });
}
