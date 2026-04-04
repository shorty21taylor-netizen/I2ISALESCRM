import { NextResponse } from 'next/server';
import { runMorningDigest } from '@/lib/scheduler';
import { initStore } from '@/lib/store';

export async function POST() {
  await initStore();
  try {
    var result = await runMorningDigest();
    return NextResponse.json({ success: true, result: result });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
