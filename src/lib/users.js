// Accounts: who is on the roster, what they do, and which workspaces they work.
//
// These records used to hold a per-user password. Sign-in is now email plus the
// workspace's team password, so there is no credential in this file at all — no
// hashing, no comparing, and no way for an account edit to look like it set one.

import { saveAppUser, loadAppUsers, deleteAppUserDB } from '@/lib/db';

// The old records still carry passwordHash and passwordSalt. Nothing reads them
// and nothing writes them any more; they are left exactly where they are, because
// deprecating a field means ceasing to use it, not deleting somebody's data.
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
  var all = await loadUsers();
  if (all[email]) throw new Error('A user with that email already exists');

  var record = {
    email: email,
    name: (input.name || '').trim() || email,
    role: input.role || 'closer',
    workspaceIds: Array.isArray(input.workspaceIds) ? input.workspaceIds.filter(Boolean) : [],
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

export async function hasAnyUsers() {
  var all = await loadUsers();
  return Object.keys(all).length > 0;
}
