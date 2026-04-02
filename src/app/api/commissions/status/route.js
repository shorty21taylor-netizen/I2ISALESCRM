import { NextResponse } from 'next/server';
import { updateCommissionStatus, initStore } from '@/lib/store';

export async function POST(req) {
  try {
    await initStore();
    var body = await req.json();
    if (!body.dealId || !body.status) {
      return NextResponse.json({ error: 'dealId and status required' }, { status: 400 });
    }
    if (['pending', 'approved', 'paid'].indexOf(body.status) === -1) {
      return NextResponse.json({ error: 'status must be pending, approved, or paid' }, { status: 400 });
    }
    var deal = updateCommissionStatus(body.dealId, body.status);
    if (!deal) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, deal: deal });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
