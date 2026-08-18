'use client';
import { useState, useEffect } from 'react';
import { KeyRound, Save, Check, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { apiFetch, useAccess } from '@/lib/workspace-client';

export default function TeamPasswordCard() {
  var access = useAccess();
  var s1 = useState(null), status = s1[0], setStatus = s1[1];
  var s2 = useState(''), pw = s2[0], setPw = s2[1];
  var s3 = useState(''), confirm = s3[0], setConfirm = s3[1];
  var s4 = useState(null), msg = s4[0], setMsg = s4[1];
  var s5 = useState(false), show = s5[0], setShow = s5[1];
  var s6 = useState(false), saving = s6[0], setSaving = s6[1];

  useEffect(function() {
    apiFetch('/api/team-password')
      .then(function(r) { return r.status === 403 ? null : r.json(); })
      .then(function(d) { if (d && d.success) setStatus(d); })
      .catch(function() {});
  }, []);

  // Only the operator can change the shared password.
  if (access && !access.canSeeAll) return null;

  function flash(ok, text) {
    setMsg({ ok: ok, text: text });
    setTimeout(function() { setMsg(null); }, 6000);
  }

  function save() {
    if (pw.length < 6) { flash(false, 'Password must be at least 6 characters'); return; }
    if (pw !== confirm) { flash(false, 'The two passwords do not match'); return; }
    setSaving(true);
    apiFetch('/api/team-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw }),
    })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (!d.success) { flash(false, d.error || 'Could not update'); return; }
        flash(true, 'Team password updated — share it with anyone who does not have their own account');
        setStatus({ isCustom: true, updatedAt: d.updatedAt, usingEnvFallback: false });
        setPw(''); setConfirm('');
      })
      .catch(function(e) { flash(false, e.message); })
      .then(function() { setSaving(false); });
  }

  return (
    <div className="glass-card overflow-hidden stagger-1">
      <div className="section-header">
        <h3><KeyRound className="w-4 h-4 text-crm-accent" /> Team Password</h3>
        <span className="section-tag">
          {status ? (status.isCustom ? 'Custom' : 'Default') : '…'}
        </span>
      </div>

      <div className="p-5 space-y-4">
        <p className="text-xs text-crm-muted">
          The shared password for people who don&apos;t have their own account yet. Anyone with an
          account signs in with their own password instead &mdash; changing this does not affect them.
        </p>

        {status && status.usingEnvFallback && (
          <p className="text-[11px] text-crm-muted/70">
            Still using the built-in default. Set your own below.
          </p>
        )}
        {status && status.isCustom && status.updatedAt && (
          <p className="text-[11px] text-crm-muted/70">
            Last changed {new Date(status.updatedAt).toLocaleString()}.
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-mono text-crm-muted uppercase tracking-wider mb-2">New team password</label>
            <div className="relative">
              <input
                className="input-field pr-10"
                type={show ? 'text' : 'password'}
                value={pw}
                placeholder="At least 6 characters"
                onChange={function(e) { setPw(e.target.value); }}
              />
              <button
                type="button"
                onClick={function() { setShow(!show); }}
                aria-label={show ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-crm-muted hover:text-crm-text"
              >
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-mono text-crm-muted uppercase tracking-wider mb-2">Confirm</label>
            <input
              className="input-field"
              type={show ? 'text' : 'password'}
              value={confirm}
              placeholder="Type it again"
              onChange={function(e) { setConfirm(e.target.value); }}
            />
          </div>
        </div>

        <p className="text-[10px] text-crm-muted/60">
          Stored hashed and never shown again, so note it down when you set it. If it&apos;s
          forgotten, just set a new one.
        </p>

        {msg && (
          <div className={'flex items-center gap-2 p-3 rounded-lg ' + (msg.ok ? 'bg-crm-positive/5 border border-crm-positive/20' : 'bg-crm-negative/5 border border-crm-negative/20')}>
            {msg.ok ? <Check className="w-4 h-4 text-crm-positive" /> : <AlertCircle className="w-4 h-4 text-crm-negative" />}
            <span className={'text-xs font-mono ' + (msg.ok ? 'text-crm-positive' : 'text-crm-negative')}>{msg.text}</span>
          </div>
        )}

        <button onClick={save} disabled={saving} className="btn-primary text-sm flex items-center gap-2">
          <Save className="w-3.5 h-3.5" /> {saving ? 'Saving…' : 'Update team password'}
        </button>
      </div>
    </div>
  );
}
