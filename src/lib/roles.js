// What a role is allowed to do, in one place, so the nav, the API and the screen
// that grants it can never disagree about what "manager" means.
//
// Dependency-free on purpose: the access layer, the server routes and the client
// pages all read from here.

export var ROLES = [
  {
    id: 'admin',
    label: 'Admin',
    summary: 'Everything except owning the account.',
    can: [
      'See every rep’s numbers and the team dashboard',
      'Set targets, edit the roster, change workspace branding',
      'Grant and change roles below their own',
    ],
    seesTeam: true,
    grants: true,
  },
  {
    id: 'manager',
    label: 'Manager',
    summary: 'Runs the floor. Sees everyone, changes no one’s access.',
    can: [
      'See every rep’s numbers and the team dashboard',
      'Open any rep’s dashboard and set their monthly target',
      'Export the full team report',
    ],
    cannot: ['Grant roles or create accounts'],
    seesTeam: true,
    grants: false,
  },
  {
    id: 'closer',
    label: 'Closer',
    summary: 'Their own numbers, plus the team leaderboard.',
    can: [
      'My Dashboard, their own calls, deals, EODs and commissions',
      'The team leaderboard',
      'Submit forms',
    ],
    cannot: ['See another rep’s figures or the team dashboard'],
    seesTeam: false,
    grants: false,
  },
  {
    id: 'setter',
    label: 'Setter',
    summary: 'Same as a closer, framed around booking calls.',
    can: [
      'My Dashboard, their own bookings and EODs',
      'The team leaderboard',
      'Submit forms',
    ],
    cannot: ['See another rep’s figures or the team dashboard'],
    seesTeam: false,
    grants: false,
  },
];

// The account that owns everything. Not grantable — there is exactly one, and it
// is the email the app was set up with.
export var OWNER_ROLE = {
  id: 'operator',
  label: 'Owner',
  summary: 'The account that owns every workspace.',
  seesTeam: true,
  grants: true,
};

export function roleById(id) {
  var key = String(id || '').toLowerCase();
  if (key === 'operator' || key === 'owner') return OWNER_ROLE;
  for (var i = 0; i < ROLES.length; i++) {
    if (ROLES[i].id === key) return ROLES[i];
  }
  return null;
}

export function roleLabel(id) {
  var role = roleById(id);
  return role ? role.label : (id || 'Closer');
}

// Does this role see other people's numbers?
export function roleSeesTeam(id) {
  var role = roleById(id);
  return !!(role && role.seesTeam);
}

// May this role hand out roles at all?
export function roleGrants(id) {
  var role = roleById(id);
  return !!(role && role.grants);
}

// Roles this actor is allowed to assign. The owner may grant anything below
// themselves; an admin may not create another admin, so the only way to widen the
// top of the tree is the owner doing it deliberately.
export function grantableRoles(actorRole, actorIsOwner) {
  if (actorIsOwner) return ROLES.map(function(r) { return r.id; });
  if (!roleGrants(actorRole)) return [];
  return ROLES.filter(function(r) { return !r.grants; }).map(function(r) { return r.id; });
}
