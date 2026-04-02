'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, ArrowLeft, Lock, CheckCircle } from 'lucide-react';
import { getUser, setVerified, isLoggedIn, logout } from '@/lib/auth';

export default function VerifyPage() {
  var router = useRouter();
  var s1 = useState(''), password = s1[0], setPassword = s1[1];
  var s2 = useState(''), error = s2[0], setError = s2[1];
  var s3 = useState(false), loading = s3[0], setLoading = s3[1];
  var s4 = useState(null), user = s4[0], setUser = s4[1];

  useEffect(function() {
    if (isLoggedIn()) { router.replace('/'); return; }
    var u = getUser();
    if (!u) { router.replace('/login'); return; }
    setUser(u);
  }, [router]);

  function handleBack() {
    logout();
    router.push('/login');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!password.trim()) return;
    setLoading(true);
    setError('');
    try {
      var res = await fetch('/api/auth/verify-team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: password }),
      });
      var data = await res.json();
      if (data.verified) {
        setVerified(true);
        // Register the closer in the CRM store
        fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: user.email, name: user.name }),
        }).catch(function() {});
        router.push('/');
      } else {
        setError(data.error || 'Incorrect password');
      }
    } catch(err) {
      setError('Connection error. Try again.');
    }
    setLoading(false);
  }

  if (!user) return null;

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
          <div className="flex items-center gap-2 mb-6">
            <button onClick={handleBack} className="btn-ghost p-1.5">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h1 className="font-display font-bold text-xl text-crm-text-bright">Team verification</h1>
          </div>

          <div className="flex items-center gap-3 p-3 glass-surface mb-6">
            <div className="avatar avatar-md bg-crm-accent/10 text-crm-accent">
              {user.name.split(' ').map(function(n) { return n[0]; }).join('').toUpperCase()}
            </div>
            <div>
              <div className="text-sm font-medium text-crm-text-bright">{user.name}</div>
              <div className="text-xs text-crm-muted">{user.email}</div>
            </div>
            <CheckCircle className="w-4 h-4 text-crm-positive ml-auto" />
          </div>

          <p className="text-sm text-crm-muted mb-4">Enter the team password to access the CRM dashboard.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-crm-muted uppercase tracking-wider mb-2">Team Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-crm-muted z-10" />
                <input
                  type="password"
                  value={password}
                  onChange={function(e) { setPassword(e.target.value); }}
                  placeholder="Enter team password"
                  className="input-field pl-10"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="px-3 py-2 rounded-lg bg-crm-negative/10 border border-crm-negative/20">
                <span className="text-xs text-crm-negative">{error}</span>
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 py-3 disabled:opacity-50">
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                'Verify & Enter'
              )}
            </button>
          </form>
        </div>

        <p className="text-xs text-crm-muted text-center mt-6">Ask your team lead for the password if you don&apos;t have it.</p>
      </div>
    </div>
  );
}
