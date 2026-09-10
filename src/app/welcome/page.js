'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isLoggedIn } from '@/lib/auth';
import { apiFetch } from '@/lib/workspace-client';
import SummitMark from '@/components/SummitMark';

// The three seconds between signing in and the app. It is also the moment the
// first request goes out, so the wait is doing something rather than just being
// watched: by the time the mark finishes drawing we already know where to land.

var HOLD_MS = 3000;
var REDUCED_MS = 400;

export default function WelcomePage() {
  var router = useRouter();
  var [destination, setDestination] = useState('/');

  useEffect(function() {
    if (!isLoggedIn()) { router.replace('/login'); return; }

    var cancelled = false;
    var target = '/';

    // A rep has no team dashboard to land on, so send them to their own.
    apiFetch('/api/auth/me')
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (cancelled) return;
        target = d && d.success && d.canSeeTeam === false ? '/me' : '/';
        setDestination(target);
      })
      .catch(function() {});

    var reduced = typeof window !== 'undefined'
      && window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var timer = setTimeout(function() {
      if (!cancelled) router.replace(target);
    }, reduced ? REDUCED_MS : HOLD_MS);

    return function() { cancelled = true; clearTimeout(timer); };
  }, [router]);

  return (
    <div className="welcome">
      <div className="welcome-glow" />
      <div className="welcome-inner">
        <div className="welcome-mark">
          <span className="welcome-ring" />
          <span className="welcome-ring r2" />
          <SummitMark size={132} animate />
        </div>
        <p className="welcome-word">
          Summit<span>CRM</span>
        </p>
        <p className="welcome-sub">Sales performance intelligence</p>
        <button className="welcome-skip" onClick={function() { router.replace(destination); }}>
          Skip
        </button>
      </div>
    </div>
  );
}
