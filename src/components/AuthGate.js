'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { saveUser, logout } from '@/lib/auth';

var PUBLIC_PATHS = ['/login', '/verify', '/test'];

// The door is the server's to open now. It used to be a localStorage flag, which
// meant a rep who had been deactivated — or whose team password had been rotated
// out from under them — kept a working-looking app until the tab was closed.
export default function AuthGate({ children }) {
  var pathname = usePathname();
  var router = useRouter();
  var s = useState(false), ready = s[0], setReady = s[1];

  useEffect(function() {
    var isPublic = PUBLIC_PATHS.some(function(p) { return pathname === p; }) || pathname.startsWith('/api/');
    if (isPublic) { setReady(true); return; }

    var cancelled = false;
    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, d: d }; }); })
      .then(function(res) {
        if (cancelled) return;
        if (!res.ok || !res.d.success) {
          logout();
          router.replace('/login');
          return;
        }
        // Keep the locally cached name in step with the server's, so the nav and
        // the avatar never show a name the records are not filed under.
        saveUser({
          email: res.d.email,
          name: res.d.name || '',
          role: res.d.role || 'closer',
        });
        setReady(true);
      })
      .catch(function() {
        // A network blip should not throw somebody out mid-shift. The APIs each
        // enforce access on their own, so rendering here is safe.
        if (!cancelled) setReady(true);
      });

    return function() { cancelled = true; };
  }, [pathname, router]);

  if (!ready) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-crm-bg">
        <div className="w-8 h-8 border-2 border-crm-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return children;
}
