import { NextResponse } from 'next/server';
import { initStore, getWorkspaces } from '@/lib/store';
import { resolveAccess } from '@/lib/access';
import { listUsers, createUser, updateUser, deleteUser } from '@/lib/users';
import { grantableRoles, roleGrants, roleLabel } from '@/lib/roles';
import { OWNER_EMAIL } from '@/lib/access';

export var dynamic = 'force-dynamic';

// Managing accounts is for the owner and for roles that are allowed to grant.
async function requireGranter(req) {
  var access = await resolveAccess(req);
  if (access.canSeeAll || roleGrants(access.role)) return { access: access };
  return { denied: NextResponse.json({ error: 'You cannot manage accounts' }, { status: 403 }) };
}

// Guards that hold whoever is asking:
//   - nobody edits the owner account
//   - nobody changes their own role, so no one can promote themselves
//   - a granter may only assign roles they are allowed to hand out, which stops an
//     admin minting another admin
function checkRoleChange(access, targetEmail, nextRole) {
  var target = String(targetEmail || '').trim().toLowerCase();
  if (target === OWNER_EMAIL) {
    return 'The owner account cannot be changed here.';
  }
  if (nextRole === undefined || nextRole === null || nextRole === '') return '';
  if (target && target === String(access.email || '').toLowerCase()) {
    return 'You cannot change your own role. Ask the owner.';
  }
  var allowed = grantableRoles(access.role, access.canSeeAll);
  if (allowed.indexOf(String(nextRole).toLowerCase()) === -1) {
    return 'You cannot grant the ' + roleLabel(nextRole) + ' role.';
  }
  return '';
}

export async function GET(req) {
  await initStore();
  var gate = await requireGranter(req);
  if (gate.denied) return gate.denied;
  try {
    return NextResponse.json({
      success: true,
      users: await listUsers(),
      workspaces: getWorkspaces(),
      // What this particular caller is allowed to hand out, so the screen offers
      // exactly those and nothing it would be refused for.
      grantable: grantableRoles(gate.access.role, gate.access.canSeeAll),
      me: gate.access.email,
    });
  } catch (e) {
    console.error('[Users API GET]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  await initStore();
  var gate = await requireGranter(req);
  if (gate.denied) return gate.denied;
  try {
    var body = await req.json();
    var problem = checkRoleChange(gate.access, body.email, body.role || 'closer');
    if (problem) return NextResponse.json({ error: problem }, { status: 403 });
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
  var gate = await requireGranter(req);
  if (gate.denied) return gate.denied;
  try {
    var body = await req.json();
    if (!body.email) return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    var problem = checkRoleChange(gate.access, body.email, body.role);
    if (problem) return NextResponse.json({ error: problem }, { status: 403 });
    var user = await updateUser(body.email, body);
    return NextResponse.json({ success: true, user: user });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

export async function DELETE(req) {
  await initStore();
  var gate = await requireGranter(req);
  if (gate.denied) return gate.denied;
  try {
    var email = new URL(req.url).searchParams.get('email');
    if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    var key = String(email).trim().toLowerCase();
    if (key === OWNER_EMAIL) {
      return NextResponse.json({ error: 'The owner account cannot be removed' }, { status: 403 });
    }
    if (key === String(gate.access.email || '').toLowerCase()) {
      return NextResponse.json({ error: 'You cannot remove your own account' }, { status: 403 });
    }
    return NextResponse.json({ success: true, ...(await deleteUser(email)) });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
