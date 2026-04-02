'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Activity, ArrowRight } from 'lucide-react';
import { saveUser, isLoggedIn } from '@/lib/auth';

export default function LoginPage() {
  var router = useRouter();
  var searchParams = useSearchParams();
  var s1 = useState(''), name = s1[0], setName = s1[1];
  var s2 = useState(''), email = s2[0], setEmail = s2[1];
  var s3 = useState(''), inviteMsg = s3[0], setInviteMsg = s3[1];

  useEffect(function() {
    if (isLoggedIn()) { router.replace('/'); return; }
    var invite = searchParams.get('invite');
    if (invite) setInviteMsg('Invite link accepted — enter your details to continue.');
  }, [router, searchParams]);

  function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    saveUser({ name: name.trim(), email: email.trim().toLowerCase(), role: 'closer', joinedAt: new Date().toISOString() });
    // Register the closer in the CRM store
    fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase(), name: name.trim() }),
    }).catch(function() {});
    router.push('/verify');
  }

  return (
    <div className="min-h-screen bg-crm-bg flex items-center justify-center p-4 bg-orbs relative">
      <div className="w-full max-w-md stagger-1">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="glow-red rounded-lg p-1">
            <Activity className="w-8 h-8 text-crm-accent" />
          </div>
          <span className="font-display font-bold text-2xl text-crm-text-bright">
            Summit<span className="text-crm-accent">CRM</span>
          </span>
        </div>

        <div className="glass-card-accent p-8">
          <h1 className="font-display font-bold text-xl text-crm-text-bright text-center mb-2">Sign in to your account</h1>
          <p className="text-sm text-crm-muted text-center mb-6">Enter your name and email to continue</p>

          {inviteMsg && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-crm-positive/10 border border-crm-positive/20 mb-4">
              <div className="glow-dot-green" />
              <span className="text-xs text-crm-positive">{inviteMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-crm-muted uppercase tracking-wider mb-2">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={function(e) { setName(e.target.value); }}
                placeholder="Anthony Taylor"
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-crm-muted uppercase tracking-wider mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={function(e) { setEmail(e.target.value); }}
                placeholder="anthony@summit.com"
                className="input-field"
                required
              />
            </div>
            <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2 py-3">
              Continue
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>

        <p className="text-xs text-crm-muted text-center mt-6">Summit CRM &middot; Sales Performance Intelligence</p>
      </div>
    </div>
  );
}
