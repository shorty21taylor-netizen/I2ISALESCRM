// The shared team password — the fallback sign-in for people who don't yet have
// their own account. Stored hashed in app_config so the operator can change it
// from Settings and the change survives a redeploy.
//
// It is deliberately NOT readable back. Nothing needs to retrieve it: the operator
// types the new one, so they already know it, and if it's forgotten they simply set
// another. Storing it in a form we could read back would mean storing it in a form
// anyone with database access could read too.

import crypto from 'crypto';
import { saveAppConfig, loadAppConfig } from '@/lib/db';

var KEY = 'team-password';
var KEYLEN = 64;

function hash(password, salt) {
  return crypto.scryptSync(String(password), salt, KEYLEN).toString('hex');
}

// The compiled-in default, used until the operator sets one.
function envPassword() {
  return process.env.TEAM_PASSWORD || 'I2I2026!';
}

var cached = null;
var loaded = false;

async function readStored() {
  if (loaded) return cached;
  try {
    cached = await loadAppConfig(KEY);
  } catch (e) {
    console.error('[TeamPassword] load error:', e.message);
    cached = null;
  }
  loaded = true;
  return cached;
}

export async function setTeamPassword(password) {
  if (!password || String(password).length < 6) {
    throw new Error('Team password must be at least 6 characters');
  }
  var salt = crypto.randomBytes(16).toString('hex');
  var record = {
    salt: salt,
    hash: hash(password, salt),
    updatedAt: new Date().toISOString(),
  };
  cached = record;
  loaded = true;
  await saveAppConfig(KEY, record);
  return { success: true, updatedAt: record.updatedAt };
}

export async function verifyTeamPassword(password) {
  if (!password) return false;
  var stored = await readStored();

  // Nothing set yet — fall back to the environment/default so existing users and
  // deployments keep working until the operator chooses a password.
  if (!stored || !stored.hash || !stored.salt) {
    return String(password) === envPassword();
  }

  try {
    var candidate = Buffer.from(hash(password, stored.salt), 'hex');
    var expected = Buffer.from(stored.hash, 'hex');
    if (candidate.length !== expected.length) return false;
    return crypto.timingSafeEqual(candidate, expected);
  } catch (e) {
    return false;
  }
}

// Status only — never the password itself.
export async function getTeamPasswordStatus() {
  var stored = await readStored();
  return {
    isCustom: !!(stored && stored.hash),
    updatedAt: (stored && stored.updatedAt) || null,
    usingEnvFallback: !(stored && stored.hash),
  };
}
