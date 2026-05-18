import { NextResponse } from 'next/server';
import { addUserToWorkspace, getWorkspaceUserList, initStore } from '@/lib/store';

export var dynamic = 'force-dynamic';

export async function GET(req, { params }) {
  await initStore();
  var p = await params;
  var users = await getWorkspaceUserList(p.id);
  return NextResponse.json({ success: true, users: users });
}

export async function POST(req, { params }) {
  await initStore();
  var p = await params;
  var body = await req.json();
  if (!body.email) return NextResponse.json({ error: 'email required' }, { status: 400 });
  var user = await addUserToWorkspace(p.id, body.email, body.name || '', body.role || 'closer');
  return NextResponse.json({ success: true, user: user });
}
