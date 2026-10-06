/* Read-only audit of workspace team passwords and the Influence2Impact roster.
 *
 * WRITES NOTHING. It opens the database, reads, prints, and closes.
 *
 * Unlike the other scripts here it talks to Postgres directly rather than to the
 * app, because the two questions it answers have no endpoint: "does this
 * password open any workspace" is deliberately not a thing the API will tell
 * you, and it should not become one.
 *
 *   railway run node scripts/audit-workspace-passwords.js
 *
 * The candidate password is read from the environment so it never lands in a
 * shell history, a commit, or a chat transcript:
 *
 *   railway run --service <svc> sh -c 'CANDIDATE="..." node scripts/audit-workspace-passwords.js'
 *
 * Without CANDIDATE it still prints the roster and the rotation dates.
 */

var crypto = require('crypto');
var Client = require('pg').Client;

// Must match hashWith() in src/lib/workspace-auth.js exactly, or every
// comparison below comes back a false negative.
var KEYLEN = 64;
function hashWith(password, salt) {
  return crypto.scryptSync(String(password), salt, KEYLEN).toString('hex');
}
function opens(ws, password) {
  if (!password || !ws || !ws.teamPasswordSalt || !ws.teamPasswordHash) return false;
  try {
    var a = Buffer.from(hashWith(password, ws.teamPasswordSalt), 'hex');
    var b = Buffer.from(ws.teamPasswordHash, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch (e) { return false; }
}

var TARGET = process.env.WORKSPACE_ID || 'default';
var CANDIDATE = process.env.CANDIDATE || '';

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('No DATABASE_URL. Run this through `railway run` so it sees the live database.');
    process.exit(1);
  }
  var c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();

  var ws = (await c.query('SELECT id, data FROM workspaces')).rows.map(function(r) {
    return Object.assign({ id: r.id }, r.data || {});
  });

  console.log('\n=== WORKSPACES (' + ws.length + ') ===');
  ws.forEach(function(w) {
    console.log('  ' + (w.id === TARGET ? '*' : ' ') + ' ' + w.id
      + '  ' + JSON.stringify(w.name || '')
      + '  active=' + (w.active !== false)
      + '  rotated=' + (w.passwordRotatedAt || 'never'));
  });

  if (CANDIDATE) {
    console.log('\n=== WHICH WORKSPACES DOES THE CANDIDATE PASSWORD OPEN? ===');
    var hits = ws.filter(function(w) { return opens(w, CANDIDATE); });
    if (!hits.length) {
      console.log('  none');
    } else {
      hits.forEach(function(w) {
        console.log('  ' + w.id + '  ' + JSON.stringify(w.name || '')
          + (w.id === TARGET ? '   <- the one you intended' : '   <- SHARED, change this one'));
      });
    }
    var others = hits.filter(function(w) { return w.id !== TARGET; });
    console.log(others.length
      ? '\n  VERDICT: ' + others.length + ' OTHER workspace(s) use this password.'
      : '\n  VERDICT: no other workspace uses it.');
  } else {
    console.log('\n(set CANDIDATE to also check which workspaces a given password opens)');
  }

  var members = (await c.query(
    'SELECT email, data FROM workspace_users WHERE workspace_id = $1 ORDER BY email', [TARGET]
  )).rows.map(function(r) { return Object.assign({ email: r.email }, r.data || {}); });

  console.log('\n=== ROSTER FOR "' + TARGET + '" (' + members.length + ') ===');
  if (!members.length) console.log('  (no rows)');
  members.forEach(function(m) {
    console.log('  ' + (m.active === false ? '[off] ' : '[on ]  ')
      + (m.email || '').padEnd(34)
      + ' role=' + (m.role || '?')
      + '  name=' + JSON.stringify(m.name || ''));
  });

  var owner = members.filter(function(m) {
    return String(m.email || '').toLowerCase() === 'shorty21taylor@gmail.com';
  })[0];
  console.log('\n  owner row: ' + (owner
    ? (owner.active === false ? 'PRESENT BUT DEACTIVATED, role=' + owner.role : 'active, role=' + owner.role)
    : 'NONE — note that OWNER_EMAIL in src/lib/owner.js is treated as operator'
      + ' everywhere by resolveAccess whether or not a row exists, so access can'
      + ' work without one.'));

  await c.end();
  console.log('\nNothing was written.\n');
}

main().catch(function(e) { console.error(e); process.exit(1); });
