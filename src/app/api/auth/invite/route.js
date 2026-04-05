import { NextResponse } from 'next/server';
import { initStore } from '@/lib/store';
var invites = [];
export async function POST(req) {
  await initStore();
  try {
    var body = await req.json();
    var code = Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    var invite = { id: 'inv-' + Date.now(), code: code, email: body.email || null, role: body.role || 'closer', createdBy: body.createdBy || 'admin', createdAt: new Date().toISOString(), used: false };
    invites.push(invite);
    var baseUrl = process.env.RAILWAY_PUBLIC_DOMAIN ? 'https://' + process.env.RAILWAY_PUBLIC_DOMAIN : 'http://localhost:3000';
    return NextResponse.json({ success: true, invite: invite, inviteLink: baseUrl + '/login?invite=' + code });
  } catch(e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
export async function GET() {
  await initStore();
  return NextResponse.json({ success: true, invites: invites });
}
