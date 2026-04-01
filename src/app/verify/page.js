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
    <div className="min-h-screen bg-crm-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <Activity className="w-8 h-8 text-crm-accent" />
          <span className="font-display font-bold text-2xl text-crm-text-bright">
            Summit<span className="text-crm-accent">CRM</span>
          </span>
        </div>

        <div className="glass-card p-8">
          <div className="flex items-center gap-2 mb-6">
            <button onClick={handleBack} className="p-1.5 rounded-lg hover:bg-white/5 text-crm-muted hover:text-crm-text transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h1 className="font-display font-bold text-xl text-crm-text-bright">Team verification</h1>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.03] border border-crm-border mb-6">
            <div className="w-10 h-10 rounded-full bg-crm-accent/10 flex items-center justify-center text-sm font-bold text-crm-accent">
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
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-crm-muted" />
                <input
                  type="password"
                  value={password}
                  onChange={function(e) { setPassword(e.target.value); }}
                  placeholder="Enter team password"
                  className="w-full bg-crm-bg border border-crm-border rounded-lg text-crm-text text-sm pl-10 pr-4 py-3 font-body focus:border-crm-accent/50 focus:outline-none placeholder:text-crm-muted/50"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="px-3 py-2 rounded-lg bg-crm-negative/10 border border-crm-negative/20">
                <span className="text-xs text-crm-negative">{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-crm-accent hover:bg-crm-accent-glow text-white font-display font-semibold py-3 rounded-lg transition-colors disabled:opacity-50"
            >
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
