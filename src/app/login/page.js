'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Check } from 'lucide-react';
import { saveUser, setVerified } from '@/lib/auth';
import { setActiveWorkspace } from '@/lib/workspace-client';
import SummitMark from '@/components/SummitMark';
import useBrand from '@/lib/use-brand';

// Email and the team password. That is the whole screen — no password to create,
// nothing to reset, no sign-up. The roster is the access control: an address
// nobody put on it does not get in, whatever password it arrives with.
function SignIn() {
  var router = useRouter();
  var searchParams = useSearchParams();
  var s1 = useState(''), email = s1[0], setEmail = s1[1];
  var s2 = useState(''), password = s2[0], setPassword = s2[1];
  var s3 = useState(''), inviteMsg = s3[0], setInviteMsg = s3[1];
  var s4 = useState(''), error = s4[0], setError = s4[1];
  var s5 = useState(false), busy = s5[0], setBusy = s5[1];
  // Set only when one sign-in opened more than one workspace.
  var s6 = useState(null), choice = s6[0], setChoice = s6[1];
  var brand = useBrand();

  useEffect(function() {
    var invite = searchParams.get('invite');
    if (invite) setInviteMsg('Invite accepted — sign in to get started.');
  }, [searchParams]);

  // The name is never typed on this screen. It comes back from the server, and
  // a rep confirms their own spelling once on /welcome — one person spelling
  // themselves two ways at sign-in is how the board used to grow duplicates.
  function land(user, workspaceId) {
    saveUser({
      name: user.name || '',
      email: user.email,
      role: user.role || 'closer',
      joinedAt: new Date().toISOString(),
    });
    setVerified(true);
    if (workspaceId) setActiveWorkspace(workspaceId);
    router.push('/welcome');
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setBusy(true); setError('');
    fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase(), password: password }),
    })
      .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, d: d }; }); })
      .then(function(res) {
        setBusy(false);
        if (!res.ok || !res.d.success) {
          setError(res.d.error || "That email and team password don't match an active account.");
          return;
        }
        setPassword('');
        var spaces = res.d.workspaces || [];
        // One workspace and there is nothing to choose, so nobody is asked.
        if (spaces.length > 1) { setChoice({ user: res.d.user, workspaces: spaces }); return; }
        land(res.d.user, res.d.workspaceId);
      })
      .catch(function() { setBusy(false); setError('Could not reach the server.'); });
  }

  function pick(workspaceId) {
    setBusy(true); setError('');
    fetch('/api/auth/switch-workspace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId: workspaceId }),
    })
      .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, d: d }; }); })
      .then(function(res) {
        setBusy(false);
        if (!res.ok || !res.d.success) { setError(res.d.error || 'Could not open that workspace.'); return; }
        land(choice.user, workspaceId);
      })
      .catch(function() { setBusy(false); setError('Could not reach the server.'); });
  }

  return (
    <div className="signin">
      <div className="signin-glow" />
      <div className="signin-inner">
        <div className="signin-head">
          <SummitMark size={78} wordmark pending={!brand.ready}
            src={brand.logoUrl} name={brand.name} />
        </div>

        <div className="glass-card signin-card">
          {choice ? (
            <>
              <h1 className="signin-title">Choose a workspace</h1>
              <p className="signin-lede">You work more than one offer. Pick the one you are in today.</p>

              <div className="ws-pick">
                {choice.workspaces.map(function(w) {
                  return (
                    <button key={w.id} type="button" className="ws-pick-card" disabled={busy}
                      onClick={function() { pick(w.id); }}>
                      <span className="ws-pick-name">{w.name}</span>
                      <span className="ws-pick-role">{w.role}</span>
                      <ArrowRight className="w-4 h-4 ws-pick-go" />
                    </button>
                  );
                })}
              </div>

              {error ? <p className="signin-err">{error}</p> : null}
              <p className="signin-foot">You can switch between them from the nav at any time.</p>
            </>
          ) : (
            <>
              <h1 className="signin-title">Sign in</h1>
              <p className="signin-lede">Your email and the team password.</p>

              {inviteMsg ? (
                <div className="signin-note"><Check size={14} />{inviteMsg}</div>
              ) : null}

              <form onSubmit={handleSubmit}>
                <label className="signin-field">
                  <span>Email</span>
                  <input type="email" value={email} className="input-field" autoComplete="username" required
                    placeholder="anthony@influence2impact.com"
                    onChange={function(e) { setEmail(e.target.value); }} />
                </label>
                <label className="signin-field">
                  <span>Team password</span>
                  <input type="password" value={password} className="input-field"
                    autoComplete="current-password" required
                    onChange={function(e) { setPassword(e.target.value); }} />
                </label>

                {error ? <p className="signin-err">{error}</p> : null}

                <button type="submit" disabled={busy}
                  className="btn-primary w-full flex items-center justify-center gap-2 py-3">
                  {busy ? 'Checking…' : 'Sign in'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="signin" />}>
      <SignIn />
    </Suspense>
  );
}
