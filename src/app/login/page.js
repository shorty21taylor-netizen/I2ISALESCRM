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
    router.push('/verify');
  }

  return (
    <div className="min-h-screen bg-crm-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <Activity className="w-8 h-8 text-crm-accent" />
          <span className="font-display font-bold text-2xl text-crm-text-bright">
            Summit<span className="text-crm-accent">CRM</span>
          </span>
        </div>

        <div className="glass-card p-8">
          <h1 className="font-display font-bold text-xl text-crm-text-bright text-center mb-2">Sign in to your account</h1>
          <p className="text-sm text-crm-muted text-center mb-6">Enter your name and email to continue</p>

          {inviteMsg && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-crm-positive/10 border border-crm-positive/20 mb-4">
              <div className="w-2 h-2 rounded-full bg-crm-positive" />
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
                className="w-full bg-crm-bg border border-crm-border rounded-lg text-crm-text text-sm px-4 py-3 font-body focus:border-crm-accent/50 focus:outline-none placeholder:text-crm-muted/50"
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
                className="w-full bg-crm-bg border border-crm-border rounded-lg text-crm-text text-sm px-4 py-3 font-body focus:border-crm-accent/50 focus:outline-none placeholder:text-crm-muted/50"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 bg-crm-accent hover:bg-crm-accent-glow text-white font-display font-semibold py-3 rounded-lg transition-colors"
            >
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
