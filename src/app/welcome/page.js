'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { saveUser, getUser } from '@/lib/auth';
import SummitMark from '@/components/SummitMark';
import useBrand from '@/lib/use-brand';

// The moment between signing in and the app. For most people it is three seconds
// of the mark drawing while the first request goes out. For somebody on their
// first sign-in it is the one question we ask them: how their name is spelled.

var HOLD_MS = 3000;
var REDUCED_MS = 400;

export default function WelcomePage() {
  var router = useRouter();
  var s1 = useState('/'), destination = s1[0], setDestination = s1[1];
  var s2 = useState(null), me = s2[0], setMe = s2[1];
  var s3 = useState(''), name = s3[0], setName = s3[1];
  var s4 = useState(''), error = s4[0], setError = s4[1];
  var s5 = useState(false), busy = s5[0], setBusy = s5[1];
  var brand = useBrand();

  useEffect(function() {
    var cancelled = false;

    fetch('/api/auth/me')
      .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, d: d }; }); })
      .then(function(res) {
        if (cancelled) return;
        if (!res.ok || !res.d.success) { router.replace('/login'); return; }
        var d = res.d;
        setMe(d);
        // A rep has no team dashboard to land on, so send them to their own.
        var target = d.canSeeTeam === false ? '/me' : '/';
        setDestination(target);
        setName(d.name || '');

        // Only the splash waits. Somebody with a question to answer is not
        // bounced off it by a timer.
        if (d.needsNameConfirmation || d.noWorkspace) return;

        var reduced = typeof window !== 'undefined'
          && window.matchMedia
          && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        setTimeout(function() {
          if (!cancelled) router.replace(target);
        }, reduced ? REDUCED_MS : HOLD_MS);
      })
      .catch(function() { if (!cancelled) router.replace('/login'); });

    return function() { cancelled = true; };
  }, [router]);

  function save(e) {
    e.preventDefault();
    var clean = name.trim();
    if (!clean) return;
    setBusy(true); setError('');
    fetch('/api/auth/confirm-name', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: clean }),
    })
      .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, d: d }; }); })
      .then(function(res) {
        setBusy(false);
        if (!res.ok || !res.d.success) { setError(res.d.error || 'Could not save that name.'); return; }
        var held = getUser() || {};
        saveUser(Object.assign({}, held, { name: res.d.name }));
        router.replace(destination);
      })
      .catch(function() { setBusy(false); setError('Could not reach the server.'); });
  }

  // Signed in, but on nobody's roster. Creating a workspace for them would be
  // guessing at which offer they belong to, so this says who can fix it instead.
  if (me && me.noWorkspace) {
    return (
      <div className="signin">
        <div className="signin-glow" />
        <div className="signin-inner">
          <div className="signin-head">
            <SummitMark size={78} wordmark pending={!brand.ready} src={brand.logoUrl} name={brand.name} />
          </div>
          <div className="glass-card signin-card">
            <h1 className="signin-title">Almost there</h1>
            <p className="signin-lede">
              Your account isn&rsquo;t attached to a workspace yet. Ask your manager to finish setup.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (me && me.needsNameConfirmation) {
    return (
      <div className="signin">
        <div className="signin-glow" />
        <div className="signin-inner">
          <div className="signin-head">
            <SummitMark size={78} wordmark pending={!brand.ready} src={brand.logoUrl} name={brand.name} />
          </div>

          <div className="glass-card signin-card">
            <h1 className="signin-title">Confirm your name</h1>
            <p className="signin-lede">
              Spell your name the way it should appear on the board. It&rsquo;s what your closes
              and EODs get filed under, and only an admin can change it later.
            </p>

            <form onSubmit={save}>
              <label className="signin-field">
                <span>Full name</span>
                <input type="text" value={name} className="input-field" autoComplete="name" required
                  placeholder="Anthony Taylor"
                  onChange={function(e) { setName(e.target.value); }} />
              </label>

              {error ? <p className="signin-err">{error}</p> : null}

              <button type="submit" disabled={busy || !name.trim()}
                className="btn-primary w-full flex items-center justify-center gap-2 py-3">
                {busy ? 'Saving…' : 'Save and continue'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="welcome">
      <div className="welcome-glow" />
      <div className="welcome-inner">
        <div className="welcome-mark">
          <span className="welcome-ring" />
          <span className="welcome-ring r2" />
          <SummitMark size={150} animate wordmark pending={!brand.ready}
            src={brand.logoUrl} name={brand.name} />
        </div>
        <button className="welcome-skip" onClick={function() { router.replace(destination); }}>
          Skip
        </button>
      </div>
    </div>
  );
}
