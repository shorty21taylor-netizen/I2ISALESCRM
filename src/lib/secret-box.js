import crypto from 'crypto';

// Encryption for the login details a workspace hands a new rep.
//
// A CRM is the wrong permanent home for shared passwords — a password manager is
// the right one, and the resource editor lets an admin store a vault link and
// nothing else. But teams do keep these in a doc today, and a doc is worse than
// this: no encryption, no access rules, no record of who looked. So where a
// secret is stored here it is encrypted at rest with a key that lives in the
// environment rather than the database, and every reveal is written down.
//
// Without a key we refuse to store secrets rather than quietly writing them in
// the clear. Failing closed is the only safe default: an admin who thinks a
// password is encrypted when it is not is worse off than one who was told no.
//
// Two places the key can come from, and the order matters:
//
//   CREDENTIALS_KEY  — a passphrase set on purpose. Best: it is independent of
//     everything else, so rotating a database does not strand what was stored.
//
//   DATABASE_URL     — derived, when no passphrase was set. Not as good, but far
//     better than refusing: the ciphertext lives in that database and the
//     connection string does not, so a dump, a backup file or a stray SELECT
//     yields nothing readable. It does not protect against someone who already
//     has the running server's environment.
//
// The consequence of the second is real and worth saying out loud: if the
// database URL changes, anything sealed under it can no longer be opened and has
// to be entered again. keySource() exists so a screen can say so.

var ALGO = 'aes-256-gcm';

export function hasKey() {
  return !!keyBytes();
}

export function keySource() {
  if (process.env.CREDENTIALS_KEY) return 'passphrase';
  if (process.env.DATABASE_URL) return 'database-url';
  return 'none';
}

function keyBytes() {
  var raw = process.env.CREDENTIALS_KEY || '';
  if (raw) {
    // Any passphrase is accepted and stretched, so nobody has to generate a
    // 32-byte value by hand to get this working.
    return crypto.createHash('sha256').update(String(raw)).digest();
  }
  var url = process.env.DATABASE_URL || '';
  if (!url) return null;
  // Separated by a fixed label so this key can never collide with any other use
  // of the same connection string.
  return crypto.createHash('sha256').update('summit-os/secret-box/v1\n' + url).digest();
}

export function seal(plaintext) {
  var key = keyBytes();
  if (!key) return { error: 'No CREDENTIALS_KEY is set on the server, so secrets cannot be stored.' };
  if (!plaintext) return { value: '' };

  var iv = crypto.randomBytes(12);
  var cipher = crypto.createCipheriv(ALGO, key, iv);
  var body = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  var tag = cipher.getAuthTag();
  return { value: 'v1.' + iv.toString('base64url') + '.' + tag.toString('base64url') + '.' + body.toString('base64url') };
}

export function open(sealed) {
  var key = keyBytes();
  if (!key || !sealed) return null;
  try {
    var parts = String(sealed).split('.');
    if (parts.length !== 4 || parts[0] !== 'v1') return null;
    var decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(parts[1], 'base64url'));
    decipher.setAuthTag(Buffer.from(parts[2], 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(parts[3], 'base64url')), decipher.final()]).toString('utf8');
  } catch (e) {
    // A wrong or rotated key looks exactly like tampering from here. Either way
    // the honest answer is that we cannot read it.
    return null;
  }
}
