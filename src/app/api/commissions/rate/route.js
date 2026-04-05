import { NextResponse } from 'next/server';
import { setCommissionRate, getAllCommissionRates, initStore } from '@/lib/store';

export async function POST(req) {
  await initStore();
  try {
    await initStore();
    var body = await req.json();
    if (!body.email || body.rate === undefined) {
      return NextResponse.json({ error: 'email and rate required' }, { status: 400 });
    }
    setCommissionRate(body.email, body.rate, body.name || '');
    return NextResponse.json({ success: true, email: body.email, rate: body.rate });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET() {
  await initStore();
  return NextResponse.json({ success: true, rates: getAllCommissionRates() });
}
