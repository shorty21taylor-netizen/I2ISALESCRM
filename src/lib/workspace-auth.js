// Email + team password, per workspace.
//
// The access control is the roster: only an email with an active membership can
// sign in at all. The team password proves you are inside the org; the email says
// who you are and which workspace you get.
//
// That trade is deliberate and it has one sharp edge — anyone holding the
// password plus a roster email can sign in as that rep. Three things carry the
// model, and all three are built here rather than left to procedure:
// deactivation is instant and needs no rotation, the password is per workspace so
// one does not open another, and every attempt is logged with its IP.

import crypto from 'crypto';
import { getWorkspaces, getWorkspace, updateWorkspace, getStore, saveAuthAttemptRow, getAuthAttempts, addWorkspaceMember } from '@/lib/store';
import { getUser, listUsers } from '@/lib/users';
import { loadAppConfig, ensureLowerEmailIndex, saveWorkspaceUser } from '@/lib/db';
import { OWNER_EMAIL } from '@/lib/owner';
import { hasRecordsIn } from '@/lib/rep-roster-scope';

var KEYLEN = 64;

// ---- the one string the login form is allowed to show ----
//
// The same message for a wrong password, an unknown email and a deactivated rep.
// Any difference between them is an oracle telling an outsider which of your
// people are real.
export var GENERIC_FAILURE = "That email and team password don't match an active account.";

export function rateLimitMessage(minutes) {
  return 'Too many attempts. Try again in ' + minutes + ' minutes.';
}

export function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

// ---- password storage ----

function hashWith(password, salt) {
  return crypto.scryptSync(String(password), salt, KEYLEN).toString('hex');
}

// scrypt rather than bcrypt: it is what the rest of this codebase already hashes
// with, it is in Node's standard library, and it does not add a dependency to a
// deploy that has to keep working.
export function hashTeamPassword(password) {
  var salt = crypto.randomBytes(16).toString('hex');
  return { salt: salt, hash: hashWith(password, salt) };
}

function compare(password, salt, expectedHash) {
  if (!password || !salt || !expectedHash) return false;
  try {
    var a = Buffer.from(hashWith(password, salt), 'hex');
    var b = Buffer.from(expectedHash, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch (e) {
    return false;
  }
}

// Burn the same work a real comparison would, so an unknown email does not come
// back measurably faster than a known one. This is the whole of the enumeration
// defence, so it runs on every path that fails before a real compare.
var DUMMY_SALT = crypto.randomBytes(16).toString('hex');
var DUMMY_HASH = hashWith('summit-os-dummy-compare', DUMMY_SALT);
export function dummyCompare(password) {
  compare(password || 'x', DUMMY_SALT, DUMMY_HASH);
}

// ---- migrating the existing shared password onto the workspaces ----
//
// The team password used to be one global value in app_config. Each workspace now
// holds its own, and the first one is seeded from that global record so nobody has
// to be told a new password on the day this ships.
var seeded = false;

export async function ensureWorkspacePasswords() {
  if (seeded) return;
  var all = getWorkspaces();
  var legacy = null;
  try { legacy = await loadAppConfig('team-password'); } catch (e) { legacy = null; }

  for (var i = 0; i < all.length; i++) {
    var ws = getWorkspace(all[i].id);
    if (!ws) continue;
    if (ws.teamPasswordHash && ws.teamPasswordSalt) continue;

    var creds = null;
    if (legacy && legacy.hash && legacy.salt) {
      // Reuse the stored hash as-is. It cannot be read back, which is the point,
      // so the only way to carry the password forward is to carry the hash.
      creds = { salt: legacy.salt, hash: legacy.hash };
    } else if (ws.teamPassword) {
      // The default workspace shipped with a plaintext password in its record.
      // Hash it and drop the plaintext while we are here.
      creds = hashTeamPassword(ws.teamPassword);
    } else {
      creds = hashTeamPassword(process.env.TEAM_PASSWORD || 'I2I2026!');
    }

    await updateWorkspace(ws.id, {
      teamPasswordSalt: creds.salt,
      teamPasswordHash: creds.hash,
      passwordRotatedAt: ws.passwordRotatedAt || new Date().toISOString(),
      teamPassword: undefined,
    });
  }
  seeded = true;
}

export function workspaceStamp(ws) {
  return (ws && ws.passwordRotatedAt) || '';
}

export function verifyWorkspacePassword(ws, password) {
  if (!ws) return false;
  return compare(password, ws.teamPasswordSalt, ws.teamPasswordHash);
}

// Rotating moves password_rotated_at, and every session was stamped with the old
// value — so everyone in this workspace is signed out by the next request they
// make, with no session table to sweep.
export async function rotateWorkspacePassword(workspaceId, password) {
  if (!password || String(password).length < 8) {
    throw new Error('Use at least 8 characters');
  }
  var ws = getWorkspace(workspaceId);
  if (!ws) throw new Error('No such workspace');
  var creds = hashTeamPassword(password);
  await updateWorkspace(workspaceId, {
    teamPasswordSalt: creds.salt,
    teamPasswordHash: creds.hash,
    passwordRotatedAt: new Date().toISOString(),
    teamPassword: undefined,
  });
  return { rotatedAt: getWorkspace(workspaceId).passwordRotatedAt };
}

var NINETY_DAYS = 90 * 24 * 60 * 60 * 1000;

export function rotationOverdue(ws) {
  var at = ws && ws.passwordRotatedAt;
  if (!at) return false;
  var t = Date.parse(at);
  if (isNaN(t)) return false;
  return Date.now() - t > NINETY_DAYS;
}

// ---- membership ----
//
// A membership row is the roster entry: which workspace, what role, and whether
// it is still live. Deactivating one is the offboarding action — it takes effect
// on that rep's next request and costs nobody else their password.
export function membershipRows(email) {
  var key = normalizeEmail(email);
  var store = getStore();
  return (store.workspaceUsers || []).filter(function(u) {
    return normalizeEmail(u.email) === key;
  });
}

export async function activeMemberships(email) {
  var key = normalizeEmail(email);

  // The operator's account owns every workspace; there is no roster row to add
  // or forget, and locking them out of their own product on a bad row would be
  // its own outage.
  if (key === OWNER_EMAIL) {
    return getWorkspaces().map(function(w) { return { workspaceId: w.id, role: 'operator' }; });
  }

  var account = await getUser(key).catch(function() { return null; });
  if (account && account.active === false) return [];

  var rows = membershipRows(key);
  var live = rows
    .filter(function(u) { return u.active !== false; })
    .filter(function(u) { return !!getWorkspace(u.workspaceId); })
    .map(function(u) { return { workspaceId: u.workspaceId, role: u.role || (account && account.role) || 'closer' }; });

  // No roster row AT ALL, but an account that names its workspaces: honour it, so
  // the team that existed before this change keeps working on the day it ships.
  //
  // Deliberately not "no *live* row". A row that exists and is switched off is
  // somebody's decision to offboard this person, and falling back to the account
  // would quietly undo it — deactivation would kill their open session and then
  // let them sign straight back in.
  if (!rows.length && account && Array.isArray(account.workspaceIds)) {
    live = account.workspaceIds
      .filter(function(id) { return !!getWorkspace(id); })
      .map(function(id) { return { workspaceId: id, role: account.role || 'closer' }; });
  }

  // Drop duplicates, keeping the first role seen for a workspace.
  var seen = {};
  return live.filter(function(m) {
    if (seen[m.workspaceId]) return false;
    seen[m.workspaceId] = true;
    return true;
  });
}

// ---- rate limiting ----
//
// One shared secret across the org means a single guessed password opens every
// roster email at once. These two ceilings are the whole brute-force defence, so
// they are checked before anything else the login route does.
export var IP_LIMIT = 8;
export var EMAIL_LIMIT = 5;
export var WINDOW_MS = 15 * 60 * 1000;

function failuresSince(list, cutoff, match) {
  var n = 0;
  for (var i = 0; i < list.length; i++) {
    var a = list[i];
    if (a.success) continue;
    if (Date.parse(a.at) < cutoff) continue;
    if (match(a)) n++;
  }
  return n;
}

// Returns null when the attempt may proceed, or { minutes } when it may not.
export function rateLimit(email, ip) {
  var attempts = getAuthAttempts();
  var now = Date.now();
  var cutoff = now - WINDOW_MS;
  var key = normalizeEmail(email);

  var byIp = failuresSince(attempts, cutoff, function(a) { return a.ip === ip; });
  var byEmail = failuresSince(attempts, cutoff, function(a) { return normalizeEmail(a.email) === key; });

  if (byIp < IP_LIMIT && byEmail < EMAIL_LIMIT) return null;

  // How long until the oldest failure in the window ages out — a real number, not
  // a flat fifteen, so someone one minute from the door is told one minute.
  var oldest = now;
  for (var i = 0; i < attempts.length; i++) {
    var a = attempts[i];
    if (a.success) continue;
    var t = Date.parse(a.at);
    if (t < cutoff) continue;
    var counts = (byIp >= IP_LIMIT && a.ip === ip) || (byEmail >= EMAIL_LIMIT && normalizeEmail(a.email) === key);
    if (counts && t < oldest) oldest = t;
  }
  var waitMs = Math.max(0, (oldest + WINDOW_MS) - now);
  return { minutes: Math.max(1, Math.ceil(waitMs / 60000)) };
}

export function clientIp(req) {
  var fwd = '';
  try {
    fwd = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '';
  } catch (e) { fwd = ''; }
  // The first hop is the client; the rest are proxies we put there ourselves.
  var first = String(fwd).split(',')[0].trim();
  return first || 'unknown';
}

export function userAgent(req) {
  try { return (req.headers.get('user-agent') || '').slice(0, 300); } catch (e) { return ''; }
}

// Never write the submitted password here, truncated or otherwise. There is no
// field for it on purpose.
export function noteAttempt(req, fields) {
  return saveAuthAttemptRow({
    email: normalizeEmail(fields.email),
    ip: clientIp(req),
    userAgent: userAgent(req),
    success: !!fields.success,
    workspaceId: fields.workspaceId || null,
  });
}

// Two successful sign-ins for one rep from different IPs inside ten minutes. With
// a shared password that is the shape a borrowed login makes, so the admin list
// flags it rather than leaving it to be noticed.
var SHARED_WINDOW_MS = 10 * 60 * 1000;

export function flagSharedSignIns(rows) {
  var byEmail = {};
  (rows || []).forEach(function(r) {
    if (!r.success) return;
    var key = normalizeEmail(r.email);
    (byEmail[key] = byEmail[key] || []).push(r);
  });
  var flagged = {};
  Object.keys(byEmail).forEach(function(key) {
    var list = byEmail[key];
    for (var i = 0; i < list.length; i++) {
      for (var j = i + 1; j < list.length; j++) {
        if (list[i].ip === list[j].ip) continue;
        if (Math.abs(Date.parse(list[i].at) - Date.parse(list[j].at)) <= SHARED_WINDOW_MS) {
          flagged[list[i].id] = true;
          flagged[list[j].id] = true;
        }
      }
    }
  });
  return flagged;
}

export async function rosterFor(workspaceId) {
  var accounts = await listUsers().catch(function() { return []; });
  var byEmail = {};
  accounts.forEach(function(a) { byEmail[normalizeEmail(a.email)] = a; });

  var store = getStore();
  return (store.workspaceUsers || [])
    .filter(function(u) { return u.workspaceId === workspaceId; })
    .map(function(u) {
      var key = normalizeEmail(u.email);
      var account = byEmail[key];
      return {
        email: key,
        name: (account && (account.name || '')) || u.name || key,
        role: u.role || (account && account.role) || 'closer',
        active: u.active !== false && !(account && account.active === false),
        deactivatedAt: u.deactivatedAt || null,
        joinedAt: u.joinedAt || null,
        hasAccount: !!account,
      };
    })
    .sort(function(a, b) { return a.name.localeCompare(b.name); });
}

// ---- one-time readiness ----
//
// Three things the new sign-in needs that the old one did not, all idempotent and
// all safe to run on every boot: a hashed password on each workspace, a roster row
// for everyone who already had an account, and a unique index on lower(email).

var rosterSeeded = false;
var indexState = null;

async function seedRoster() {
  if (rosterSeeded) return;
  var accounts = await listUsers().catch(function() { return []; });
  var store = getStore();
  var have = {};
  (store.workspaceUsers || []).forEach(function(u) {
    have[normalizeEmail(u.email) + '|' + u.workspaceId] = true;
  });

  // Somebody already on a roster somewhere has been placed. This backfill exists
  // for accounts that predate the roster table, not to have an opinion about
  // people who are already on it.
  var placed = {};
  (store.workspaceUsers || []).forEach(function(u) {
    if (u.active === false) return;
    placed[normalizeEmail(u.email)] = true;
  });

  for (var i = 0; i < accounts.length; i++) {
    var a = accounts[i];
    if (a.active === false) continue;
    var email = normalizeEmail(a.email);

    // An account that does not say where it belongs gets NO row invented for it.
    //
    // It used to get one in 'default'. That is how a rep hired into RWH turned up
    // on Influence2Impact's compliance board: the account said nothing, the
    // backfill said "default", and 'default' is a real company's books. A missing
    // workspace means "wherever they are", never "the first one" — and when
    // nothing knows where they are, the answer is to add nothing and leave them
    // to whatever the roster table already says.
    var ids = (a.workspaceIds && a.workspaceIds.length) ? a.workspaceIds : [];
    if (!ids.length) continue;
    if (placed[email]) continue;

    for (var j = 0; j < ids.length; j++) {
      var key = email + '|' + ids[j];
      // Already on the roster: leave it exactly as it is, including a
      // deactivation somebody made on purpose.
      if (have[key]) continue;
      if (!getWorkspace(ids[j])) continue;
      await addWorkspaceMember(ids[j], a.email, a.name, a.role || 'closer');
      have[key] = true;
    }
  }
  rosterSeeded = true;
}

// Two accounts whose addresses differ only in case are two records for one
// person, and the index would fail on them. Report rather than fail.
async function checkEmailIndex() {
  if (indexState) return indexState;
  try {
    indexState = await ensureLowerEmailIndex();
  } catch (e) {
    indexState = { created: false, duplicates: [], error: e.message };
  }
  if (indexState.duplicates && indexState.duplicates.length) {
    console.error('[Auth] duplicate-case emails block the lower(email) index:',
      JSON.stringify(indexState.duplicates));
  }
  return indexState;
}

// ---- clearing up after the old backfill ----
//
// Before seedRoster() learned to fail closed, every account that did not name a
// workspace was handed a roster row in 'default' — and 'default' is
// Influence2Impact, a real company with real books. Those rows were written to
// Postgres, so fixing the code does not unwrite them: a rep hired into another
// workspace still shows up on Influence2Impact's compliance board, because a
// roster row is the strongest claim there is that somebody works somewhere.
//
// This retires exactly those rows and no others. A 'default' row is retired only
// when the person's own account names the workspaces they work in and 'default'
// is not one of them — that is an admin's explicit statement, and a row
// contradicting it was invented rather than chosen. Soft, like every delete here,
// so re-adding them brings it straight back; and if they turn out to have filed
// real work in Influence2Impact, rep-roster-scope still places them there on the
// strength of the records.
var repairedRoster = false;

async function retireInventedDefaultRows() {
  if (repairedRoster) return;
  repairedRoster = true;

  var accounts = await listUsers().catch(function() { return []; });
  var stated = {};
  accounts.forEach(function(a) {
    if (!a || !a.workspaceIds || !a.workspaceIds.length) return;
    stated[normalizeEmail(a.email)] = a.workspaceIds;
  });

  var store = getStore();
  var rows = (store.workspaceUsers || []).filter(function(u) {
    if (u.workspaceId !== 'default' || u.active === false) return false;
    var email = normalizeEmail(u.email);
    if (email === OWNER_EMAIL) return false;
    var says = stated[email];
    // No stated workspaces means nobody has said otherwise. Left alone.
    if (!says) return false;
    if (says.indexOf('default') !== -1) return false;

    // They have filed real work here. Whatever their account says, taking them
    // off this roster would drop somebody off a board they genuinely appear on,
    // and losing a person a workspace does have is the worse failure of the two.
    if (hasRecordsIn('default', u.email, u.name)) {
      console.log('[Auth] kept a default roster row for', email, '— they have filed work in Influence2Impact');
      return false;
    }
    return true;
  });

  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    row.active = false;
    row.deactivatedAt = new Date().toISOString();
    row.retiredReason = 'Account names ' + (stated[normalizeEmail(row.email)] || []).join(', ')
      + ' and not default; this row was invented by the pre-fix roster backfill.';
    await saveWorkspaceUser(row).catch(function(e) { console.error('[DB]', e.message); });
    console.log('[Auth] retired an invented default roster row for', normalizeEmail(row.email),
      '— their account says', JSON.stringify(stated[normalizeEmail(row.email)]));
  }
  if (rows.length) console.log('[Auth] retired', rows.length, 'invented default roster row(s)');
}

export async function ensureAuthReady() {
  await ensureWorkspacePasswords();
  await seedRoster();
  // After the backfill, so a row it legitimately added this boot is already in
  // memory and is judged by the same rule as everything else.
  await retireInventedDefaultRows();
  await checkEmailIndex();
}

export function emailIndexState() {
  return indexState || { created: false, duplicates: [], pending: true };
}
