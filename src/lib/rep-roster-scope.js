// Which people belong to a workspace.
//
// Closer profiles are keyed by email and carry no workspace of their own —
// registerCloser has never set one, and it is not this module's place to change
// what that function writes. So membership is derived, from the two things that
// do know: the roster rows an admin created, and the records a rep has filed.
//
// The order matters, and so does the fallback. A workspace listing people who do
// not work there is the bug this fixes; a workspace that silently loses people it
// does have would be a worse one.

import { getStore } from '@/lib/store';

function key(value) { return String(value || '').toLowerCase().trim(); }

function nameKey(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

// email -> { workspaceId: true }, from the roster rows an admin actually created.
function membershipIndex(store) {
  var out = {};
  (store.workspaceUsers || []).forEach(function(u) {
    if (u.active === false) return;
    var k = key(u.email);
    if (!k) return;
    (out[k] = out[k] || {})[u.workspaceId || 'default'] = true;
  });
  return out;
}

// email/name -> { workspaceId: true }, from where their work is filed. This is
// what catches a profile that predates the roster: somebody whose records are all
// in one workspace plainly belongs to it, whatever rows exist.
function recordIndex(store) {
  var byEmail = {};
  var byName = {};
  function note(record, emailField, nameField) {
    var ws = record.workspaceId || 'default';
    var e = key(record[emailField]);
    if (e) (byEmail[e] = byEmail[e] || {})[ws] = true;
    var n = nameKey(record[nameField]);
    if (n) (byName[n] = byName[n] || {})[ws] = true;
  }
  (store.closedDeals || []).forEach(function(r) { note(r, 'closerEmail', 'closer'); });
  (store.eodReports || []).forEach(function(r) { note(r, 'closerEmail', 'salesRep'); });
  (store.bookedCalls || []).forEach(function(r) { note(r, 'closerEmail', 'setter'); });
  (store.afterCallReports || []).forEach(function(r) { note(r, 'closerEmail', 'closer'); });
  return { byEmail: byEmail, byName: byName };
}

// Has this person actually filed work in a given workspace?
//
// Separate from the scope predicate because the roster repair needs the opposite
// question: not "where should we show them" but "is there anything here that
// would be lost by taking them off this roster".
export function hasRecordsIn(workspaceId, email, name) {
  var records = recordIndex(getStore());
  var byEmail = records.byEmail[key(email)];
  if (byEmail && byEmail[workspaceId]) return true;
  var byName = name ? records.byName[nameKey(name)] : null;
  return !!(byName && byName[workspaceId]);
}

// Returns a predicate: does this profile belong in the workspace being viewed?
//
// Pass ALL_WORKSPACES (or nothing) and everyone is in — that is the operator's
// combined view, which is allowed to see the whole account.
export function repScopeFilter(workspaceId) {
  if (!workspaceId || workspaceId === '__all__') {
    return function() { return true; };
  }
  var wanted = Array.isArray(workspaceId) ? workspaceId : [workspaceId];
  var store = getStore();
  var members = membershipIndex(store);
  var records = recordIndex(store);

  function anyMatch(map) {
    if (!map) return false;
    for (var i = 0; i < wanted.length; i++) if (map[wanted[i]]) return true;
    return false;
  }

  return function(email, profile) {
    var k = key(email);

    // 1. On somebody's roster. That is a decision an admin made, so it is the
    //    answer — including when it means they are not on this one.
    if (members[k]) return anyMatch(members[k]);

    // 2. No roster row anywhere, but they have filed work. Their records say
    //    where they belong.
    var name = nameKey(profile && (profile.displayName || profile.name));
    var fromRecords = records.byEmail[k] || (name ? records.byName[name] : null);
    if (fromRecords) return anyMatch(fromRecords);

    // 3. Neither. A profile with no roster row and no records predates all of
    //    this; it stays with the original workspace rather than vanishing from
    //    every screen at once.
    return wanted.indexOf('default') !== -1;
  };
}

// The same thing over a profiles map, since that is what most callers hold.
export function scopeProfiles(profiles, workspaceId) {
  var keep = repScopeFilter(workspaceId);
  var out = {};
  Object.keys(profiles || {}).forEach(function(email) {
    if (keep(email, profiles[email])) out[email] = profiles[email];
  });
  return out;
}
