import { NextResponse } from 'next/server';
import { initStore, getWorkspaces } from '@/lib/store';
import { resolveAccess } from '@/lib/access';
import { listUsers, createUser, updateUser, deleteUser } from '@/lib/users';

export var dynamic = 'force-dynamic';

// Only the operator may create accounts or change who can reach which workspace.
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
    return NextResponse.json({ success: true, users: await listUsers(), workspaces: getWorkspaces() });
  } catch (e) {
    console.error('[Users API GET]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  await initStore();
  var denied = await requireOperator(req);
  if (denied) return denied;
  try {
    var body = await req.json();
    var user = await createUser({
      email: body.email,
      name: body.name,
      password: body.password,
      role: body.role,
      workspaceIds: body.workspaceIds,
    });
    return NextResponse.json({ success: true, user: user });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

export async function PATCH(req) {
  await initStore();
  var denied = await requireOperator(req);
  if (denied) return denied;
  try {
    var body = await req.json();
    if (!body.email) return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    var user = await updateUser(body.email, body);
    return NextResponse.json({ success: true, user: user });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

export async function DELETE(req) {
  await initStore();
  var denied = await requireOperator(req);
  if (denied) return denied;
  try {
    var email = new URL(req.url).searchParams.get('email');
    if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    return NextResponse.json({ success: true, ...(await deleteUser(email)) });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
