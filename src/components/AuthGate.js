'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { isLoggedIn } from '@/lib/auth';

var PUBLIC_PATHS = ['/login', '/verify', '/test'];

export default function AuthGate({ children }) {
  var pathname = usePathname();
  var router = useRouter();
  var s = useState(false), ready = s[0], setReady = s[1];

  useEffect(function() {
    var isPublic = PUBLIC_PATHS.some(function(p) { return pathname === p; }) || pathname.startsWith('/api/');
    if (isPublic) {
      setReady(true);
      return;
    }
    if (!isLoggedIn()) {
      router.replace('/login');
      return;
    }
    setReady(true);
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
