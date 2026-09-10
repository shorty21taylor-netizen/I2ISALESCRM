'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Check } from 'lucide-react';
import { saveUser, isLoggedIn } from '@/lib/auth';
import SummitMark from '@/components/SummitMark';
import useBrand from '@/lib/use-brand';

function SignIn() {
  var router = useRouter();
  var searchParams = useSearchParams();
  var s1 = useState(''), name = s1[0], setName = s1[1];
  var s2 = useState(''), email = s2[0], setEmail = s2[1];
  var s3 = useState(''), inviteMsg = s3[0], setInviteMsg = s3[1];
  var brand = useBrand();

  useEffect(function() {
    if (isLoggedIn()) { router.replace('/'); return; }
    var invite = searchParams.get('invite');
    if (invite) setInviteMsg('Invite accepted — enter your details to continue.');
  }, [router, searchParams]);

  function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    saveUser({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role: 'closer',
      joinedAt: new Date().toISOString(),
    });
    fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase(), name: name.trim() }),
    }).catch(function() {});
    router.push('/verify');
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
          <h1 className="signin-title">Sign in</h1>
          <p className="signin-lede">Your name and email get you to your dashboard.</p>

          {inviteMsg ? (
            <div className="signin-note"><Check size={14} />{inviteMsg}</div>
          ) : null}

          <form onSubmit={handleSubmit}>
            <label className="signin-field">
              <span>Full name</span>
              <input
                type="text"
                value={name}
                onChange={function(e) { setName(e.target.value); }}
                placeholder="Anthony Taylor"
                className="input-field"
                autoComplete="name"
                required
              />
            </label>
            <label className="signin-field">
              <span>Email</span>
              <input
                type="email"
                value={email}
                onChange={function(e) { setEmail(e.target.value); }}
                placeholder="anthony@influence2impact.com"
                className="input-field"
                autoComplete="email"
                required
              />
            </label>
            <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2 py-3">
              Continue
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <p className="signin-foot">
            The name here is how the floor sees you. Your records stay linked by email.
          </p>
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
