import { NextResponse } from 'next/server';
export async function POST(req) {
  try {
    var body = await req.json();
    if (!body.password) return NextResponse.json({ error: 'Password required' }, { status: 400 });
    var teamPassword = process.env.TEAM_PASSWORD || 'I2I2026!';
    if (body.password !== teamPassword) return NextResponse.json({ verified: false, error: 'Incorrect' }, { status: 401 });
    return NextResponse.json({ verified: true });
  } catch(e) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
