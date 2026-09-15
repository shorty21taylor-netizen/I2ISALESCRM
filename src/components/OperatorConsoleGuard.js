'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAccess } from '@/lib/workspace-client';

// The operator's console workspace holds one page and nothing else.
//
// Hiding the other links from the sidebar is not the same as closing them. The
// operator opening this workspace still landed on the team dashboard at '/' —
// a client's screen, scoped to a workspace with no clients in it — and sat there
// with a sidebar offering no way forward. This sends them to the one page that
// workspace is for.
//
// Settings stays reachable: it is where the account's own keys and branding live,
// and locking the operator out of it inside their own console would be its own
// small trap.
var ALLOWED = ['/operator', '/settings'];

export default function OperatorConsoleGuard() {
  var access = useAccess();
  var pathname = usePathname();
  var router = useRouter();

  useEffect(function() {
    // Null while /auth/me is in flight. Redirecting on a guess would bounce the
    // operator out of a client workspace every time the call was slow.
    if (!access) return;
    if (!access.isOperator) return;

    var consoleWs = access.operatorWorkspaceId || '';
    var activeWs = access.activeWorkspaceId || '';
    if (!consoleWs || !activeWs || consoleWs !== activeWs) return;

    var allowed = ALLOWED.some(function(p) {
      return pathname === p || pathname.indexOf(p + '/') === 0;
    });
    if (allowed) return;

    router.replace('/operator');
  }, [access, pathname, router]);

  return null;
}
