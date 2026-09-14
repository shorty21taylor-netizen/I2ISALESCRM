import { NextResponse } from 'next/server';

// The front door for the API.
//
// Before this existed, a request with no identity at all read as "not a rep",
// which several routes took to mean "senior enough to see the whole team". A
// missing credential must never be the same thing as a privileged one, so
// anything that reads the floor's data now needs a session cookie to get past
// here at all.
//
// This is a presence check, deliberately. Middleware runs on the edge runtime
// where neither node:crypto nor the database is available, so the signature,
// the expiry and the four revocation rules are all checked in access.js, on the
// request itself. This closes the anonymous hole; that closes the forged one.

var COOKIE_NAME = 'summit_session';

// Machine-facing or pre-sign-in, and each authenticated its own way (an ingest
// key, a webhook, or nothing to protect).
var PUBLIC_PREFIXES = [
  '/api/auth/login',
  '/api/auth/logout',
  '/api/forms/ingest',
  '/api/webhooks/',
  '/api/health',
  '/api/brand',
  '/api/scheduler',
  '/api/notify',
  '/api/notify-direct',
  '/api/daily-summary',
  '/api/morning-digest',
  '/api/admin-morning-report',
];

function isPublic(pathname) {
  for (var i = 0; i < PUBLIC_PREFIXES.length; i++) {
    if (pathname === PUBLIC_PREFIXES[i] || pathname.indexOf(PUBLIC_PREFIXES[i]) === 0) return true;
  }
  return false;
}

export function middleware(req) {
  var pathname = req.nextUrl.pathname;
  // Belt and braces with the matcher below: this guard is plain runtime code, so
  // it holds even if the matcher is ever mis-edited. Without it, one bad matcher
  // turns every page in the product — the sign-in page included — into a 401.
  if (pathname.indexOf('/api/') !== 0) return NextResponse.next();
  if (isPublic(pathname)) return NextResponse.next();

  var token = req.cookies.get(COOKIE_NAME);
  if (token && token.value) return NextResponse.next();

  return NextResponse.json(
    { success: false, signedIn: false, error: 'Sign in first' },
    { status: 401 }
  );
}

// `const`, not `var`, and a literal: Next reads this statically at build time to
// decide which requests reach the middleware at all. Declared any other way it is
// silently ignored and the middleware runs on every route in the app.
export const config = {
  matcher: ['/api/:path*'],
};
