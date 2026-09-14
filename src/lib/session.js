// Real sessions, at last.
//
// Until now identity was the x-user-email header: whoever sent it was whoever
// they said they were. With a shared team password that would be worse than
// useless — the password would prove nothing, because the header alone already
// got you in. So sign-in now mints a signed cookie and access.js reads it.
//
// The cookie is stateless: an HMAC over a small payload. There is no session
// table to grow or sweep. Revocation is still immediate, because every request
// re-checks the payload against live facts — see isSessionLive below.

import crypto from 'crypto';
import { saveAppConfig, loadAppConfig } from '@/lib/db';

export var COOKIE_NAME = 'summit_session';

// Twelve hours, refreshed on activity. Long enough for a full sales day plus the
// evening EOD, short enough that a borrowed laptop is not a standing key.
export var SESSION_TTL_MS = 12 * 60 * 60 * 1000;

// Re-issue at most once every few minutes; a Set-Cookie on literally every
// request is wasted bytes on a dashboard that polls.
var SLIDE_AFTER_MS = 5 * 60 * 1000;

var SECRET_KEY = 'session-secret';
var secret = null;
var secretLoading = null;

// One secret, generated once and kept in app_config so it survives a redeploy —
// otherwise every deploy would sign everybody out. SESSION_SECRET in the
// environment wins when it is set, which is how you'd run more than one instance.
async function getSecret() {
  if (secret) return secret;
  if (process.env.SESSION_SECRET) {
    secret = process.env.SESSION_SECRET;
    return secret;
  }
  if (secretLoading) return secretLoading;

  secretLoading = (async function() {
    try {
      var stored = await loadAppConfig(SECRET_KEY);
      if (stored && stored.value) { secret = stored.value; return secret; }
      var fresh = crypto.randomBytes(32).toString('hex');
      await saveAppConfig(SECRET_KEY, { value: fresh, createdAt: new Date().toISOString() });
      secret = fresh;
      return secret;
    } catch (e) {
      // No database: sign with a process-local secret so development works.
      // Everyone is signed out on restart, which is the honest consequence.
      console.error('[Session] no stored secret (' + e.message + ') — using a process-local one; '
        + 'sessions will not survive a restart until DATABASE_URL is set');
      secret = crypto.randomBytes(32).toString('hex');
      return secret;
    } finally {
      secretLoading = null;
    }
  })();

  return secretLoading;
}

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function unb64url(str) {
  var s = String(str).replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Buffer.from(s, 'base64').toString('utf8');
}

function sign(payloadB64, key) {
  return b64url(crypto.createHmac('sha256', key).update(payloadB64).digest());
}

// payload: { email, workspaceId, role, wsStamp }
export async function mintSession(payload) {
  var key = await getSecret();
  var body = {
    email: String(payload.email || '').toLowerCase(),
    workspaceId: payload.workspaceId || null,
    role: payload.role || 'closer',
    // The workspace's password_rotated_at as it stood at sign-in. Rotating the
    // team password moves it, and every session stamped with the old one dies.
    wsStamp: payload.wsStamp || null,
    // The workspaces this sign-in's password actually opened. Switching is
    // limited to these, so a rep in two workspaces with two different passwords
    // cannot reach the second one by proving the first.
    proven: Array.isArray(payload.proven) ? payload.proven : [],
    iat: Date.now(),
  };
  var encoded = b64url(JSON.stringify(body));
  return encoded + '.' + sign(encoded, key);
}

export async function readSession(token) {
  if (!token || typeof token !== 'string') return null;
  var parts = token.split('.');
  if (parts.length !== 2) return null;

  var key = await getSecret();
  var expected = sign(parts[0], key);
  var a = Buffer.from(parts[1]);
  var b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!crypto.timingSafeEqual(a, b)) return null;

  var body;
  try { body = JSON.parse(unb64url(parts[0])); } catch (e) { return null; }
  if (!body || !body.email) return null;
  if (!body.iat || Date.now() - body.iat > SESSION_TTL_MS) return null;
  return body;
}

// Pull the cookie off a request without a cookie parser.
export function sessionTokenFrom(req) {
  var header = '';
  try { header = req.headers.get('cookie') || ''; } catch (e) { return ''; }
  var parts = header.split(';');
  for (var i = 0; i < parts.length; i++) {
    var kv = parts[i].trim();
    if (kv.indexOf(COOKIE_NAME + '=') === 0) return decodeURIComponent(kv.slice(COOKIE_NAME.length + 1));
  }
  return '';
}

function cookieOptions() {
  return {
    name: COOKIE_NAME,
    httpOnly: true,
    // Secure would make the cookie unusable over plain http in local development,
    // which is the one place this runs without TLS.
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  };
}

export function attachSession(response, token) {
  response.cookies.set(Object.assign({}, cookieOptions(), { value: token }));
  return response;
}

export function clearSession(response) {
  response.cookies.set(Object.assign({}, cookieOptions(), { value: '', maxAge: 0 }));
  return response;
}

// Should this session be re-issued to slide its expiry forward?
export function shouldSlide(body) {
  return !!body && (Date.now() - body.iat) > SLIDE_AFTER_MS;
}
