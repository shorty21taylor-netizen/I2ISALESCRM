import { NextResponse } from 'next/server';
import { initStore } from '@/lib/store';
import { resolveAccess } from '@/lib/access';
import { setTeamPassword, getTeamPasswordStatus } from '@/lib/team-password';

export var dynamic = 'force-dynamic';

async function requireOperator(req) {
  var access = await resolveAccess(req);
  if (!access.canSeeAll) return NextResponse.json({ error: 'Operator access required' }, { status: 403 });
  return null;
}

export async function GET(req) {
  await initStore();
  var denied = await requireOperator(req);
  if (denied) return denied;
  try {
    return NextResponse.json({ success: true, ...(await getTeamPasswordStatus()) });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  await initStore();
  var denied = await requireOperator(req);
  if (denied) return denied;
  try {
    var body = await req.json();
    var result = await setTeamPassword(body.password);
    return NextResponse.json({ success: true, updatedAt: result.updatedAt });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
