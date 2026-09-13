'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Check, KeyRound } from 'lucide-react';
import { saveUser, setVerified, isLoggedIn } from '@/lib/auth';
import SummitMark from '@/components/SummitMark';
import useBrand from '@/lib/use-brand';

function SignIn() {
  var router = useRouter();
  var searchParams = useSearchParams();
  var s1 = useState(''), email = s1[0], setEmail = s1[1];
  var s2 = useState(''), password = s2[0], setPassword = s2[1];
  var s3 = useState(''), inviteMsg = s3[0], setInviteMsg = s3[1];
  var s4 = useState(''), error = s4[0], setError = s4[1];
  var s5 = useState(false), busy = s5[0], setBusy = s5[1];
  // Set when the shared team password got them in but they have no password of
  // their own yet. That is the only route to this panel.
  var s6 = useState(null), claim = s6[0], setClaim = s6[1];
  var s7 = useState(''), newPassword = s7[0], setNewPassword = s7[1];
  var s8 = useState(''), confirm = s8[0], setConfirm = s8[1];
  var s9 = useState(''), name = s9[0], setName = s9[1];
  var s10 = useState(false), showHelp = s10[0], setShowHelp = s10[1];
  var brand = useBrand();

  useEffect(function() {
    if (isLoggedIn()) { router.replace('/'); return; }
    var invite = searchParams.get('invite');
    if (invite) setInviteMsg('Invite accepted — sign in to finish setting up.');
  }, [router, searchParams]);

  // The name is never typed here once an account exists. It comes back from the
  // server and is written as given, because one person spelling themselves two
  // ways at sign-in is how the same rep used to end up on the board twice.
  function land(user) {
    saveUser({
      name: user.name,
      email: user.email,
      role: user.role || 'closer',
      joinedAt: new Date().toISOString(),
    });
    setVerified(true);
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
        if (!res.ok || !res.d.success) { setError(res.d.error || 'Incorrect email or password'); return; }
        if (res.d.via === 'account') { land(res.d.user); return; }
        // Got in on the shared password. They finish by choosing their own, and
        // the shared one stops working for them from then on.
        //
        // The server echoes the email back as a name when there is no account
        // yet. Prefilling that would create a profile called
        // "brandnew@i2i.com" — the exact kind of badly named record this whole
        // change exists to stop — so only a real name is carried over.
        var given = (res.d.user && res.d.user.name) || '';
        var known = given && given.toLowerCase() !== email.trim().toLowerCase() ? given : '';
        setClaim({ teamPassword: password });
        setName(known);
        setPassword('');
      })
      .catch(function() { setBusy(false); setError('Could not reach the server'); });
  }

  function handleClaim(e) {
    e.preventDefault();
    if (newPassword !== confirm) { setError('Those two passwords do not match'); return; }
    setBusy(true); setError('');
    fetch('/api/auth/set-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        name: name.trim(),
        teamPassword: claim.teamPassword,
        newPassword: newPassword,
      }),
    })
      .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, d: d }; }); })
      .then(function(res) {
        setBusy(false);
        if (!res.ok || !res.d.success) { setError(res.d.error || 'Could not set that password'); return; }
        land(res.d.user);
      })
      .catch(function() { setBusy(false); setError('Could not reach the server'); });
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
          {claim ? (
            <>
              <h1 className="signin-title">Set your password</h1>
              <p className="signin-lede">
                You are in. Choose a password of your own — from now on it is the only one
                that signs you in, and the team password will not.
              </p>

              <form onSubmit={handleClaim}>
                <label className="signin-field">
                  <span>Full name</span>
                  <input type="text" value={name} className="input-field" autoComplete="name" required
                    placeholder="Anthony Taylor"
                    onChange={function(e) { setName(e.target.value); }} />
                </label>
                <label className="signin-field">
                  <span>New password</span>
                  <input type="password" value={newPassword} className="input-field"
                    autoComplete="new-password" required minLength={8}
                    placeholder="At least 8 characters"
                    onChange={function(e) { setNewPassword(e.target.value); }} />
                </label>
                <label className="signin-field">
                  <span>Confirm password</span>
                  <input type="password" value={confirm} className="input-field"
                    autoComplete="new-password" required
                    onChange={function(e) { setConfirm(e.target.value); }} />
                </label>

                {error ? <p className="signin-err">{error}</p> : null}

                <button type="submit" disabled={busy}
                  className="btn-primary w-full flex items-center justify-center gap-2 py-3">
                  {busy ? 'Saving…' : 'Save and continue'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>

              <p className="signin-foot">
                Spell your name the way it should appear on the board. It is what your closes
                and EODs get filed under, and only an admin can change it later.
              </p>
            </>
          ) : (
            <>
              <h1 className="signin-title">Sign in</h1>
              <p className="signin-lede">Your email and your own password.</p>

              {inviteMsg ? (
                <div className="signin-note"><Check size={14} />{inviteMsg}</div>
              ) : null}

              <form onSubmit={handleSubmit}>
                <label className="signin-field">
                  <span>Email</span>
                  <input type="email" value={email} className="input-field" autoComplete="email" required
                    placeholder="anthony@influence2impact.com"
                    onChange={function(e) { setEmail(e.target.value); }} />
                </label>
                <label className="signin-field">
                  <span>Password</span>
                  <input type="password" value={password} className="input-field"
                    autoComplete="current-password" required
                    onChange={function(e) { setPassword(e.target.value); }} />
                </label>

                {error ? <p className="signin-err">{error}</p> : null}

                <button type="submit" disabled={busy}
                  className="btn-primary w-full flex items-center justify-center gap-2 py-3">
                  {busy ? 'Checking…' : 'Continue'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>

              <button type="button" className="signin-help" onClick={function() { setShowHelp(!showHelp); }}>
                <KeyRound size={12} /> First time signing in?
              </button>
              {showHelp ? (
                <p className="signin-foot">
                  Put in the team password your manager gave you. It gets you in once, and then
                  you choose a password of your own on the next screen.
                </p>
              ) : null}
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
