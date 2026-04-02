import { NextResponse } from 'next/server';
import { addClosedDeal, getStore } from '@/lib/store';

export async function POST(req) {
  try {
    var body = await req.json();
    if (!body.closerName || !body.leadName || !body.dealValue) {
      return NextResponse.json({ error: 'closerName, leadName, dealValue required' }, { status: 400 });
    }
    var entry = addClosedDeal(body);
    console.log('[Close Deal]', entry.closerName, '->', entry.leadName, '$' + entry.dealValue);
    return NextResponse.json({ success: true, submission: entry });
  } catch (e) {
    console.error('[Close Deal Error]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET() {
  var store = getStore();
  return NextResponse.json({ success: true, data: store.closedDeals });
}
