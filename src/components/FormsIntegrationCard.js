'use client';

// Settings card for the hosted (n8n) sales forms: where reps go to submit, and the
// key n8n uses to post those submissions back into the CRM.

import { useState, useEffect } from 'react';
import { ClipboardList, Copy, Check, Save, KeyRound, ExternalLink, AlertCircle } from 'lucide-react';
import { apiFetch } from '@/lib/workspace-client';
import { getUser } from '@/lib/auth';

var FORM_ROWS = [
  { key: 'book-call', name: 'Booked Appointment', ingest: '/api/forms/ingest?type=book-call' },
  { key: 'close-deal', name: 'Closed Deal (Gong)', ingest: '/api/forms/ingest?type=close-deal' },
  { key: 'eod-report', name: 'EOD Report', ingest: '/api/forms/ingest?type=eod-report' },
];

export default function FormsIntegrationCard() {
  var [cfg, setCfg] = useState(null);
  var [forms, setForms] = useState({});
  var [useExternal, setUseExternal] = useState(true);
  var [newKey, setNewKey] = useState('');
  var [copied, setCopied] = useState('');
  var [saved, setSaved] = useState(false);
  var [origin, setOrigin] = useState('');
  var [busy, setBusy] = useState(false);

  var user = typeof window !== 'undefined' ? getUser() : null;
  var isOwner = !!(user && user.email === 'shorty21taylor@gmail.com');

  useEffect(function() {
    setOrigin(window.location.origin);
    apiFetch('/api/forms/config')
      .then(function(r) { return r.json(); })
      .then(function(d) {
        setCfg(d);
        setForms(d.forms || {});
        setUseExternal(d.useExternalForms !== false);
      })
      .catch(function() { setCfg({ error: true }); });
  }, []);

  function copy(text) {
    navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(function() { setCopied(''); }, 1500);
  }

  function save(extra) {
    setBusy(true);
    return apiFetch('/api/forms/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ forms: forms, useExternalForms: useExternal }, extra || {})),
    })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        setBusy(false);
        if (d.error) return;
        if (d.ingestKey) setNewKey(d.ingestKey);
        setCfg(Object.assign({}, cfg, { ingestKeyConfigured: d.ingestKeyConfigured }));
        setSaved(true);
        setTimeout(function() { setSaved(false); }, 2500);
      })
      .catch(function() { setBusy(false); });
  }

  if (!cfg) return null;

  return (
    <div className="glass-card overflow-hidden stagger-4">
      <div className="section-header">
        <h3><ClipboardList className="w-4 h-4 text-crm-accent" /> Sales Forms (n8n)</h3>
        <span className="section-tag">{cfg.ingestKeyConfigured ? 'Connected' : 'Key required'}</span>
      </div>

      <div className="p-5 space-y-5">
        <p className="text-xs text-crm-muted">
          Reps fill these forms in n8n. n8n posts each submission to the CRM ingest URL below,
          which writes the record and fires the WhatsApp message — every send is recorded in the Message Log.
        </p>

        {!cfg.ingestKeyConfigured && (
          <div className="flex items-start gap-2 text-xs text-crm-warning glass-surface p-3">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>No ingest key set. Submissions from n8n will be rejected until you set <code className="font-mono">FORM_INGEST_KEY</code> or generate one here.</span>
          </div>
        )}

        {FORM_ROWS.map(function(row) {
          var link = forms[row.key] || {};
          var ingestUrl = origin + row.ingest;
          return (
            <div key={row.key} className="glass-surface p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-crm-text-bright">{row.name}</span>
                {link.url && (
                  <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-xs text-crm-accent flex items-center gap-1">
                    Open form <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
              <input
                className="input-field w-full text-xs font-mono"
                value={link.url || ''}
                placeholder="https://summitsales.app.n8n.cloud/form/..."
                onChange={function(e) {
                  var next = Object.assign({}, forms);
                  next[row.key] = { label: link.label || row.name, url: e.target.value };
                  setForms(next);
                }}
              />
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-crm-accent/10 text-crm-accent border border-crm-accent/20">POST</span>
                <span className="text-xs font-mono text-crm-muted truncate flex-1">{ingestUrl}</span>
                <button onClick={function() { copy(ingestUrl); }} className="btn-ghost p-2">
                  {copied === ingestUrl ? <Check className="w-4 h-4 text-crm-positive" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          );
        })}

        <label className="flex items-center gap-2 text-xs text-crm-muted">
          <input type="checkbox" checked={useExternal} onChange={function(e) { setUseExternal(e.target.checked); }} />
          Show these forms as the default on the Submit page
        </label>

        {isOwner && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <button onClick={function() { save({ generateKey: true }); }} disabled={busy} className="btn-ghost flex items-center gap-2 text-xs">
                <KeyRound className="w-4 h-4" /> Generate new ingest key
              </button>
              {cfg.ingestKeyMasked && <span className="text-xs font-mono text-crm-muted">Current: {cfg.ingestKeyMasked}</span>}
            </div>
            {newKey && (
              <div className="glass-surface p-3 space-y-1">
                <div className="text-xs text-crm-warning">Copy this now — it is shown once.</div>
                <div className="flex items-center gap-2">
                  <code className="text-xs font-mono break-all flex-1">{newKey}</code>
                  <button onClick={function() { copy(newKey); }} className="btn-ghost p-2">
                    {copied === newKey ? <Check className="w-4 h-4 text-crm-positive" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <div className="text-[11px] text-crm-muted">
                  In n8n, send it as header <code className="font-mono">x-api-key</code>.
                </div>
              </div>
            )}
            {cfg.ingestKeySource === 'env' && (
              <div className="text-[11px] text-crm-muted">
                <code className="font-mono">FORM_INGEST_KEY</code> is set in the environment and overrides any key generated here.
              </div>
            )}
          </div>
        )}

        <button onClick={function() { save(); }} disabled={busy || !isOwner} className="btn-primary flex items-center gap-2 text-sm">
          {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? 'Saved' : 'Save form settings'}
        </button>
      </div>
    </div>
  );
}
