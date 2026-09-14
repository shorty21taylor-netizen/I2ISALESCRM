import { NextResponse } from 'next/server';
import { initStore, getWorkspaces, addWorkspaceMember } from '@/lib/store';
import { resolveAccess, effectiveReadWorkspace, effectiveWriteWorkspace, ALL_WORKSPACES } from '@/lib/access';
import { membershipRows } from '@/lib/workspace-auth';
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
    // Accounts belong to workspaces, and this screen belongs to the one the
    // caller is standing in. Unscoped, an operator who had switched to a new
    // client was shown every account on the platform, each one labelled with
    // somebody else's company.
    var workspaceId = await effectiveReadWorkspace(req, new URL(req.url).searchParams.get('workspace'));
    var everyone = await listUsers();
    var users = (workspaceId === ALL_WORKSPACES)
      ? everyone
      : everyone.filter(function(u) {
          if ((u.workspaceIds || []).indexOf(workspaceId) !== -1) return true;
          // A roster row counts too — it is the thing an admin actually created,
          // and an account added through Access & Sign-ins has one before its
          // workspaceIds are ever touched.
          return membershipRows(u.email).some(function(m) {
            return m.workspaceId === workspaceId && m.active !== false;
          });
        });

    return NextResponse.json({
      success: true,
      users: users,
      workspaceId: workspaceId,
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
    // The workspace comes from the session, never the request. A manager could
    // otherwise post another company's workspace id and mint themselves a seat
    // inside it; the operator still switches workspace to add somebody there.
    var target = await effectiveWriteWorkspace(req, null);
    var user = await createUser({
      email: body.email,
      name: body.name,
      password: body.password,
      role: body.role,
      workspaceIds: [target],
    });
    // A roster row too, so the new account shows up on the workspace's own list
    // rather than only on the account list.
    await addWorkspaceMember(target, body.email, body.name || '', body.role || 'closer')
      .catch(function(e) { console.error('[Users] roster row:', e.message); });
    return NextResponse.json({ success: true, user: user, workspaceId: target });
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
    // Only the operator may move somebody between workspaces; a manager editing
    // a rep can change their name and role, not which company they belong to.
    var patch = Object.assign({}, body);
    if (!gate.access.canSeeAll) delete patch.workspaceIds;
    var user = await updateUser(body.email, patch);
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
