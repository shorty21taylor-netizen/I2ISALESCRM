import { NextResponse } from 'next/server';
import { initStore } from '@/lib/store';

export async function GET() {
  await initStore();
  return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() });
}
