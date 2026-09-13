'use client';

import { useState, useEffect, useCallback } from 'react';
import { KeyRound, PlayCircle, ShieldAlert, Trash2, Eye } from 'lucide-react';
import { apiFetch } from '@/lib/workspace-client';
import { PHASES } from '@/lib/onboarding-plan';

// What a workspace hangs on the onboarding checklist: a walkthrough per step, and
// the login details for each seat a new rep is handed.
//
// Secrets are write-only from here. An admin can set or clear one and can see
// that one exists, but the editor never renders it back — pulling a password out
// of this system is a separate, logged request, and that should be true of the
// person who typed it too.

function stepsWithSlots() {
  var out = [];
  PHASES.forEach(function(p) {
    p.steps.forEach(function(s) {
      if (s.kind !== 'owner') out.push({ id: s.id, title: s.title, phase: p.title, slot: s.slot });
    });
  });
  return out;
}

export default function OnboardingResourcesCard() {
  var [data, setData] = useState(null);
  var [msg, setMsg] = useState('');
  var [draft, setDraft] = useState({});
  var [tab, setTab] = useState('logins');

  var load = useCallback(function() {
    apiFetch('/api/onboarding/resources')
      .then(function(r) { return r.json(); })
      .then(function(d) { if (d.success) setData(d); })
      .catch(function() {});
  }, []);
  useEffect(function() { load(); }, [load]);

  function save(payload, done) {
    setMsg('Saving…');
    apiFetch('/api/onboarding/resources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, d: d }; }); })
      .then(function(res) {
        if (!res.ok || !res.d.success) { setMsg(res.d.error || 'Could not save'); return; }
        setMsg('Saved');
        setTimeout(function() { setMsg(''); }, 1500);
        if (done) done();
        load();
      })
      .catch(function() { setMsg('Could not reach the server'); });
  }

  if (!data) return null;

  var steps = stepsWithSlots();

  function edit(slot, field, value) {
    setDraft(function(prev) {
      var next = Object.assign({}, prev);
      next[slot] = Object.assign({}, data.logins[slot], next[slot], {});
      next[slot][field] = value;
      return next;
    });
  }
  function field(slot, name) {
    if (draft[slot] && draft[slot][name] !== undefined) return draft[slot][name];
    return (data.logins[slot] || {})[name] || '';
  }

  return (
    <div className="an-card mb-4">
      <div className="an-card-h">
        <h3 className="an-card-t">Onboarding resources</h3>
        <span className="section-tag">What new reps are handed</span>
        <div className="an-seg" style={{ marginLeft: 'auto' }}>
          <button className={'an-seg-i' + (tab === 'logins' ? ' on' : '')} onClick={function() { setTab('logins'); }}>Logins</button>
          <button className={'an-seg-i' + (tab === 'looms' ? ' on' : '')} onClick={function() { setTab('looms'); }}>Walkthroughs</button>
        </div>
      </div>

      <div className="p-4">
        {!data.canStoreSecrets ? (
          <div className="ob-warn">
            <ShieldAlert size={14} />
            <span>
              No <code>CREDENTIALS_KEY</code> is set on the server, so passwords cannot be stored —
              the field below will refuse them rather than save them in the clear. Set that variable
              to any long passphrase and restart. Links, usernames and &ldquo;who to ask&rdquo; work
              either way, and a link to your password manager is the better answer regardless.
            </span>
          </div>
        ) : null}

        {tab === 'logins' ? (
          <div className="ob-admin-grid">
            {data.slots.map(function(slot) {
              var stored = data.logins[slot.id] || {};
              return (
                <div key={slot.id} className="ob-admin-slot">
                  <div className="ob-admin-h">
                    <KeyRound size={13} />
                    <b>{slot.label}</b>
                    {stored.hasSecret ? <span className="ob-has">password stored</span> : null}
                  </div>
                  <input placeholder="Login URL (https://…)" value={field(slot.id, 'url')}
                    onChange={function(e) { edit(slot.id, 'url', e.target.value); }} />
                  <input placeholder="Username or email" value={field(slot.id, 'username')}
                    onChange={function(e) { edit(slot.id, 'username', e.target.value); }} />
                  <input type="password" autoComplete="new-password"
                    placeholder={stored.hasSecret ? 'Password stored — type to replace' : 'Password (optional)'}
                    value={field(slot.id, 'secret') === undefined ? '' : (draft[slot.id] && draft[slot.id].secret) || ''}
                    onChange={function(e) { edit(slot.id, 'secret', e.target.value); }} />
                  <input placeholder="Who to ask when it breaks" value={field(slot.id, 'owner')}
                    onChange={function(e) { edit(slot.id, 'owner', e.target.value); }} />
                  <textarea rows={2} placeholder="Anything they need to know — vault link, MFA, scope"
                    value={field(slot.id, 'note')}
                    onChange={function(e) { edit(slot.id, 'note', e.target.value); }} />
                  <div className="ob-admin-actions">
                    <button className="an-btn" onClick={function() {
                      save({
                        action: 'login', slot: slot.id, label: slot.label,
                        url: field(slot.id, 'url'), username: field(slot.id, 'username'),
                        owner: field(slot.id, 'owner'), note: field(slot.id, 'note'),
                        secret: (draft[slot.id] && draft[slot.id].secret) || '',
                      }, function() {
                        setDraft(function(prev) { var n = Object.assign({}, prev); delete n[slot.id]; return n; });
                      });
                    }}>Save</button>
                    {stored.hasSecret ? (
                      <button className="an-btn-ghost" onClick={function() {
                        save({ action: 'login', slot: slot.id, label: slot.label,
                          url: field(slot.id, 'url'), username: field(slot.id, 'username'),
                          owner: field(slot.id, 'owner'), note: field(slot.id, 'note'), clearSecret: true });
                      }}>Clear password</button>
                    ) : null}
                    <button className="an-btn-ghost" onClick={function() {
                      save({ action: 'login-delete', slot: slot.id });
                    }}><Trash2 size={12} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="ob-admin-looms">
            {steps.map(function(st) {
              return (
                <div key={st.id} className="ob-admin-loom">
                  <div className="min-w-0">
                    <p className="ob-admin-loom-t">{st.title}</p>
                    <p className="ob-admin-loom-p">{st.phase}</p>
                  </div>
                  <input placeholder="https://loom.com/share/…"
                    defaultValue={data.looms[st.id] || ''}
                    onBlur={function(e) {
                      if ((data.looms[st.id] || '') === e.target.value.trim()) return;
                      save({ action: 'loom', step: st.id, url: e.target.value.trim() });
                    }} />
                  {data.looms[st.id] ? <PlayCircle size={15} style={{ color: 'var(--crm-positive)', flex: 'none' }} /> : null}
                </div>
              );
            })}
          </div>
        )}

        {data.reveals && data.reveals.length ? (
          <div className="ob-reveals">
            <p className="ob-reveals-h"><Eye size={12} /> Recent password reveals</p>
            {data.reveals.slice().reverse().slice(0, 6).map(function(r, i) {
              return (
                <p key={i} className="ob-reveal-row">
                  <code>{r.email}</code> opened <b>{r.slot}</b>{' '}
                  <span>{new Date(r.at).toLocaleString('en-US')}</span>
                </p>
              );
            })}
          </div>
        ) : null}

        {msg ? <p className="ob-msg">{msg}</p> : null}
      </div>
    </div>
  );
}
