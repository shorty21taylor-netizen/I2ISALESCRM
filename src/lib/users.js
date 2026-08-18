// Per-user accounts: credentials plus the workspaces each person may access.
//
// Passwords are hashed with scrypt from Node's built-in crypto — no extra
// dependency, and the salt is per user. Plaintext is never stored or returned.

import crypto from 'crypto';
import { saveAppUser, loadAppUsers, deleteAppUserDB } from '@/lib/db';

var SCRYPT_KEYLEN = 64;

export function hashPassword(password) {
  var salt = crypto.randomBytes(16).toString('hex');
  var hash = crypto.scryptSync(String(password), salt, SCRYPT_KEYLEN).toString('hex');
  return { salt: salt, hash: hash };
}

export function verifyPassword(password, salt, expectedHash) {
  if (!password || !salt || !expectedHash) return false;
  try {
    var hash = crypto.scryptSync(String(password), salt, SCRYPT_KEYLEN);
    var expected = Buffer.from(expectedHash, 'hex');
    // Constant-time compare so a wrong password can't be probed by timing.
    if (hash.length !== expected.length) return false;
    return crypto.timingSafeEqual(hash, expected);
  } catch (e) {
    return false;
  }
}

// Never let the hash or salt leave the server.
export function publicUser(u) {
  if (!u) return null;
  return {
    email: u.email,
    name: u.name || '',
    role: u.role || 'closer',
    workspaceIds: u.workspaceIds || [],
    active: u.active !== false,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}

var users = null; // email -> record, mirrored in memory

export async function loadUsers() {
  if (users) return users;
  users = {};
  try {
    var rows = await loadAppUsers();
    (rows || []).forEach(function(r) { if (r && r.email) users[r.email.toLowerCase()] = r; });
  } catch (e) {
    console.error('[Users] load error:', e.message);
  }
  return users;
}

export async function listUsers() {
  var all = await loadUsers();
  return Object.keys(all).map(function(k) { return publicUser(all[k]); })
    .sort(function(a, b) { return (a.name || a.email).localeCompare(b.name || b.email); });
}

export async function getUser(email) {
  var all = await loadUsers();
  return all[(email || '').toLowerCase()] || null;
}

export async function createUser(input) {
  var email = (input.email || '').trim().toLowerCase();
  if (!email) throw new Error('Email is required');
  if (!input.password || String(input.password).length < 6) {
    throw new Error('Password must be at least 6 characters');
  }
  var all = await loadUsers();
  if (all[email]) throw new Error('A user with that email already exists');

  var pw = hashPassword(input.password);
  var record = {
    email: email,
    name: (input.name || '').trim() || email,
    role: input.role || 'closer',
    workspaceIds: Array.isArray(input.workspaceIds) ? input.workspaceIds.filter(Boolean) : [],
    passwordSalt: pw.salt,
    passwordHash: pw.hash,
    active: true,
    createdAt: new Date().toISOString(),
  };
  all[email] = record;
  await saveAppUser(record);
  return publicUser(record);
}

export async function updateUser(email, patch) {
  var key = (email || '').trim().toLowerCase();
  var all = await loadUsers();
  var record = all[key];
  if (!record) throw new Error('User not found');

  if (patch.name !== undefined) record.name = String(patch.name).trim() || record.email;
  if (patch.role !== undefined) record.role = patch.role;
  if (patch.active !== undefined) record.active = !!patch.active;
  if (patch.workspaceIds !== undefined && Array.isArray(patch.workspaceIds)) {
    record.workspaceIds = patch.workspaceIds.filter(Boolean);
  }
  if (patch.password) {
    if (String(patch.password).length < 6) throw new Error('Password must be at least 6 characters');
    var pw = hashPassword(patch.password);
    record.passwordSalt = pw.salt;
    record.passwordHash = pw.hash;
  }
  record.updatedAt = new Date().toISOString();
  await saveAppUser(record);
  return publicUser(record);
}

export async function deleteUser(email) {
  var key = (email || '').trim().toLowerCase();
  var all = await loadUsers();
  if (!all[key]) throw new Error('User not found');
  delete all[key];
  await deleteAppUserDB(key);
  return { success: true };
}

// Returns the public record on success, or null when the credentials do not match.
export async function authenticate(email, password) {
  var record = await getUser(email);
  if (!record || record.active === false) return null;
  if (!verifyPassword(password, record.passwordSalt, record.passwordHash)) return null;
  return publicUser(record);
}

export async function hasAnyUsers() {
  var all = await loadUsers();
  return Object.keys(all).length > 0;
}
