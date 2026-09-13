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
// Without that key we refuse to store secrets rather than quietly writing them
// in the clear. Failing closed is the only safe default: an admin who thinks a
// password is encrypted when it is not is worse off than one who was told no.

var ALGO = 'aes-256-gcm';

export function hasKey() {
  return !!keyBytes();
}

function keyBytes() {
  var raw = process.env.CREDENTIALS_KEY || '';
  if (!raw) return null;
  // Any passphrase is accepted and stretched, so nobody has to generate a
  // 32-byte value by hand to get this working.
  return crypto.createHash('sha256').update(String(raw)).digest();
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
