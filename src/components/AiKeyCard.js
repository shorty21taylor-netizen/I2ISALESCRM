'use client';

import { useState, useEffect } from 'react';
import { Sparkles, Save, Trash2, Check, AlertTriangle, ExternalLink } from 'lucide-react';
import { apiFetch } from '@/lib/workspace-client';

// The one setting that switches on both AI features: the Summit AIOS tab and the
// written summary on the exported sales report. It lives here rather than in the
// deployment's variables so turning it on is a decision, not a redeploy.

export default function AiKeyCard() {
  var s1 = useState(null), status = s1[0], setStatus = s1[1];
  var s2 = useState(''), key = s2[0], setKey = s2[1];
  var s3 = useState(''), error = s3[0], setError = s3[1];
  var s4 = useState(false), busy = s4[0], setBusy = s4[1];
  var s5 = useState(false), saved = s5[0], setSaved = s5[1];

  function load() {
    apiFetch('/api/ai-key')
      .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, d: d }; }); })
      .then(function(res) { if (res.ok && res.d.success) setStatus(res.d.status); })
      .catch(function() { /* the rest of Settings still works */ });
  }

  useEffect(load, []);

  function save(e) {
    e.preventDefault();
    if (!key.trim()) return;
    setBusy(true); setError(''); setSaved(false);
    apiFetch('/api/ai-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: key.trim() }),
    })
      .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, d: d }; }); })
      .then(function(res) {
        setBusy(false);
        if (!res.ok || !res.d.success) { setError(res.d.error || 'That did not save.'); return; }
        setStatus(res.d.status);
        setKey('');
        setSaved(true);
      })
      .catch(function() { setBusy(false); setError('Could not reach the server.'); });
  }

  function remove() {
    setBusy(true); setError(''); setSaved(false);
    apiFetch('/api/ai-key', { method: 'DELETE' })
      .then(function(r) { return r.json(); })
      .then(function(d) { setBusy(false); if (d.status) setStatus(d.status); })
      .catch(function() { setBusy(false); setError('Could not reach the server.'); });
  }

  if (!status) return null;

  var fromEnv = status.source === 'environment';

  return (
    <div className="glass-card overflow-hidden stagger-1">
      <div className="section-header">
        <h3><Sparkles className="w-4 h-4 text-crm-accent" /> Summit AIOS</h3>
        <span className="section-tag">{status.configured ? 'On' : 'Off'}</span>
      </div>

      <div className="p-5 space-y-3">
        <p className="aik-lede">
          One Anthropic key switches on the Summit AIOS tab and the written summary at the
          end of the exported sales report. Nothing else in the CRM uses it, and it is
          stored encrypted — there is no screen, export or endpoint that reads it back.
        </p>

        {status.configured ? (
          <div className="aik-state">
            <Check className="w-4 h-4" style={{ color: 'var(--crm-positive)' }} />
            <span>
              Key in use: <code className="aik-code">{status.hint}</code>
              {fromEnv
                ? ' — set as ANTHROPIC_API_KEY on the deployment, which takes precedence over this box.'
                : (status.savedAt ? ' — saved ' + new Date(status.savedAt).toLocaleDateString('en-US',
                    { month: 'short', day: 'numeric', year: 'numeric' }) : '')}
            </span>
          </div>
        ) : null}

        {status.unreadable ? (
          <div className="aik-warn">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>
              A key was saved here but can no longer be decrypted — that happens when the
              database URL changes and no CREDENTIALS_KEY was set. Paste the key again below.
            </span>
          </div>
        ) : null}

        {!status.canStore ? (
          <div className="aik-warn">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>
              This server has nowhere to keep a key safely, so it will not store one in the
              clear. Set CREDENTIALS_KEY (any passphrase) on the deployment and reload.
            </span>
          </div>
        ) : (
          <form onSubmit={save} className="aik-row">
            <input
              type="password"
              className="input-field"
              value={key}
              placeholder={status.configured ? 'Paste a new key to replace it' : 'sk-ant-…'}
              autoComplete="off"
              onChange={function(e) { setKey(e.target.value); setSaved(false); }}
            />
            <button type="submit" className="btn-primary aik-btn" disabled={busy || !key.trim()}>
              <Save className="w-3.5 h-3.5" /> {busy ? 'Checking…' : 'Save'}
            </button>
            {status.configured && !fromEnv ? (
              <button type="button" className="aik-clear" onClick={remove} disabled={busy} title="Remove the stored key">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            ) : null}
          </form>
        )}

        {error ? <p className="aik-err">{error}</p> : null}
        {saved ? <p className="aik-ok">Saved and checked against Anthropic. The AIOS tab is live.</p> : null}

        <p className="aik-foot">
          Keys come from <a href="https://console.anthropic.com/settings/keys" target="_blank"
            rel="noreferrer" className="aik-link">console.anthropic.com <ExternalLink className="w-3 h-3" /></a>.
          Usage is billed to that account; Summit AIOS caps it at 50 questions per rep per day
          and 500 across the company.
        </p>
      </div>
    </div>
  );
}
