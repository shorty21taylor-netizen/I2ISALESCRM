import { NextResponse } from 'next/server';
import { setCommissionRate, getAllCommissionRates, initStore } from '@/lib/store';
import { resolveAccess } from '@/lib/access';

// Commission rates are keyed by email across the whole install, so setting one is
// the account owner's act. Unguarded, any signed-in rep could raise their own rate.
export async function POST(req) {
  await initStore();
  try {
    var access = await resolveAccess(req);
    if (!access.isOperator) {
      return NextResponse.json({ error: 'Operator access required' }, { status: 403 });
    }
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

// The full rate table is every rep on the platform, including other clients'.
export async function GET(req) {
  await initStore();
  var access = await resolveAccess(req);
  if (!access.isOperator) {
    return NextResponse.json({ error: 'Operator access required' }, { status: 403 });
  }
  return NextResponse.json({ success: true, rates: getAllCommissionRates() });
}
