import { NextResponse } from 'next/server';
import { addBookedCall, getStore } from '@/lib/store';

export async function POST(req) {
  try {
    var body = await req.json();
    if (!body.closerName || !body.leadName) {
      return NextResponse.json({ error: 'closerName and leadName required' }, { status: 400 });
    }
    var entry = addBookedCall(body);
    console.log('[Book Call]', entry.closerName, '->', entry.leadName);
    return NextResponse.json({ success: true, submission: entry });
  } catch (e) {
    console.error('[Book Call Error]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET() {
  var store = getStore();
  return NextResponse.json({ success: true, data: store.bookedCalls });
}
