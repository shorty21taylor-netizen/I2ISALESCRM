'use client';
import { useState, useEffect, useCallback } from 'react';
import { KeyRound, UserPlus, UserMinus, UserCheck, AlertTriangle, LogOut, Shield } from 'lucide-react';
import { apiFetch, withWorkspace, useWorkspace } from '@/lib/workspace-client';

// Everything a shared team password needs somebody to be able to do: change it,
// take a leaver off the roster, and see who has been signing in.

function timeAgo(iso) {
  if (!iso) return '—';
  var t = Date.parse(iso);
  if (isNaN(t)) return '—';
  var mins = Math.round((Date.now() - t) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + 'm ago';
  var hours = Math.round(mins / 60);
  if (hours < 24) return hours + 'h ago';
  return Math.round(hours / 24) + 'd ago';
}

function daysSince(iso) {
  var t = Date.parse(iso || '');
  if (isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86400000);
}

export default function WorkspaceAdminPage() {
  var workspaceId = useWorkspace();
  var s1 = useState(null), data = s1[0], setData = s1[1];
  var s2 = useState(''), error = s2[0], setError = s2[1];
  var s3 = useState(''), notice = s3[0], setNotice = s3[1];
  var s4 = useState(false), busy = s4[0], setBusy = s4[1];
  var s5 = useState(''), pw = s5[0], setPw = s5[1];
  var s6 = useState(''), pw2 = s6[0], setPw2 = s6[1];
  var s7 = useState(''), newEmail = s7[0], setNewEmail = s7[1];
  var s8 = useState(''), newName = s8[0], setNewName = s8[1];
  var s9 = useState('closer'), newRole = s9[0], setNewRole = s9[1];
  var s10 = useState(false), dismissed = s10[0], setDismissed = s10[1];

  var load = useCallback(function() {
    apiFetch(withWorkspace('/api/admin/workspace', workspaceId))
      .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, d: d }; }); })
      .then(function(res) {
        if (!res.ok || !res.d.success) { setError(res.d.error || 'Could not load this workspace.'); return; }
        setData(res.d);
        setError('');
      })
      .catch(function() { setError('Could not reach the server.'); });
  }, [workspaceId]);

  useEffect(function() { if (workspaceId) load(); }, [workspaceId, load]);

  function act(payload, onDone) {
    setBusy(true); setError(''); setNotice('');
    apiFetch(withWorkspace('/api/admin/workspace', workspaceId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, d: d }; }); })
      .then(function(res) {
        setBusy(false);
        if (!res.ok || !res.d.success) { setError(res.d.error || 'That did not work.'); return; }
        if (onDone) onDone(res.d);
        load();
      })
      .catch(function() { setBusy(false); setError('Could not reach the server.'); });
  }

  if (error && !data) {
    return <div className="p-6 max-w-[900px] mx-auto"><p className="wsa-err">{error}</p></div>;
  }
  if (!data) {
    return <div className="p-6 max-w-[900px] mx-auto"><p className="text-sm text-crm-muted">Loading…</p></div>;
  }

  var age = daysSince(data.passwordRotatedAt);

  return (
    <div className="p-6 space-y-6 max-w-[900px] mx-auto">
      <div>
        <h1 className="font-display text-2xl font-bold text-crm-text-bright">{data.workspace.name}</h1>
        <p className="text-sm text-crm-muted mt-1">
          Who can sign in here, with which password, and who has been.
        </p>
      </div>

      {data.rotationOverdue && !dismissed ? (
        <div className="wsa-banner">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>
            The team password hasn&rsquo;t changed in {age} days. A password everyone knows
            is worth replacing every quarter.
          </span>
          <button type="button" className="wsa-banner-x" onClick={function() { setDismissed(true); }}>
            Dismiss
          </button>
        </div>
      ) : null}

      {notice ? <p className="wsa-note">{notice}</p> : null}
      {error ? <p className="wsa-err">{error}</p> : null}

      {/* ===== ROTATE ===== */}
      <section className="glass-card wsa-card">
        <div className="wsa-head">
          <KeyRound className="w-4 h-4 text-crm-accent" />
          <h2 className="wsa-title">Team password</h2>
          <span className="section-tag">
            {data.passwordRotatedAt ? 'Changed ' + timeAgo(data.passwordRotatedAt) : 'Never changed'}
          </span>
        </div>
        <p className="wsa-warn">
          Rotating signs out everyone in this workspace. They&rsquo;ll need the new password to get back in.
        </p>
        <form
          className="wsa-row"
          onSubmit={function(e) {
            e.preventDefault();
            act({ action: 'rotate', password: pw, confirm: pw2 }, function(d) {
              setPw(''); setPw2(''); setNotice(d.note);
            });
          }}
        >
          <input type="password" className="input-field" value={pw} placeholder="New team password"
            autoComplete="new-password" minLength={8} required
            onChange={function(e) { setPw(e.target.value); }} />
          <input type="password" className="input-field" value={pw2} placeholder="Confirm"
            autoComplete="new-password" required
            onChange={function(e) { setPw2(e.target.value); }} />
          <button type="submit" className="btn-primary wsa-btn" disabled={busy || !pw}>Rotate</button>
        </form>
      </section>

      {/* ===== ROSTER ===== */}
      <section className="glass-card wsa-card">
        <div className="wsa-head">
          <Shield className="w-4 h-4 text-crm-accent" />
          <h2 className="wsa-title">Roster</h2>
          <span className="section-tag">{data.roster.length} on it</span>
        </div>
        <p className="wsa-sub">
          The roster is the access control. Deactivating somebody stops their email
          authenticating on their next request — nobody else&rsquo;s password changes.
        </p>

        <form
          className="wsa-row"
          onSubmit={function(e) {
            e.preventDefault();
            act({ action: 'add-member', email: newEmail, name: newName, role: newRole }, function() {
              setNewEmail(''); setNewName('');
            });
          }}
        >
          <input type="email" className="input-field" value={newEmail} placeholder="their@email.com" required
            onChange={function(e) { setNewEmail(e.target.value); }} />
          <input type="text" className="input-field" value={newName} placeholder="Name (optional)"
            onChange={function(e) { setNewName(e.target.value); }} />
          <select className="input-field" value={newRole} onChange={function(e) { setNewRole(e.target.value); }}>
            {data.roles.map(function(r) { return <option key={r.id} value={r.id}>{r.label}</option>; })}
          </select>
          <button type="submit" className="btn-primary wsa-btn" disabled={busy || !newEmail}>
            <UserPlus className="w-3.5 h-3.5" /> Add
          </button>
        </form>

        <div className="wsa-list">
          {data.roster.length === 0 ? (
            <p className="wsa-empty">Nobody on the roster yet.</p>
          ) : data.roster.map(function(m) {
            return (
              <div key={m.email} className={'wsa-member' + (m.active ? '' : ' off')}>
                <span className="wsa-m-name">{m.name}</span>
                <span className="wsa-m-mail">{m.email}</span>
                <span className="wsa-m-role">{m.role}</span>
                <span className="wsa-m-state">{m.active ? 'Active' : 'Deactivated'}</span>
                <button type="button" className="wsa-m-act" disabled={busy}
                  title="Sign this person out everywhere without changing their access"
                  onClick={function() {
                    act({ action: 'kill-sessions', email: m.email }, function() {
                      setNotice(m.name + ' has been signed out everywhere.');
                    });
                  }}>
                  <LogOut className="w-3.5 h-3.5" />
                </button>
                <button type="button" className="wsa-m-act" disabled={busy}
                  title={m.active ? 'Take off the roster' : 'Put back on the roster'}
                  onClick={function() {
                    act({ action: m.active ? 'deactivate' : 'reactivate', email: m.email });
                  }}>
                  {m.active ? <UserMinus className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* ===== SIGN-INS ===== */}
      <section className="glass-card wsa-card">
        <div className="wsa-head">
          <h2 className="wsa-title">Recent sign-ins</h2>
          <span className="section-tag">last {data.signIns.length}</span>
        </div>
        <p className="wsa-sub">
          A shared password means this is the only trail there is, so it lives here
          rather than in a log nobody opens. Two sign-ins for one person from
          different addresses inside ten minutes are flagged.
        </p>
        <div className="wsa-signins">
          {data.signIns.length === 0 ? (
            <p className="wsa-empty">Nothing yet.</p>
          ) : data.signIns.map(function(a) {
            return (
              <div key={a.id} className="wsa-signin">
                <span className={'wsa-dot ' + (a.success ? 'ok' : 'no')} />
                <span className="wsa-s-mail">{a.email || '—'}</span>
                <span className="wsa-s-ip">{a.ip}</span>
                <span className="wsa-s-at">{timeAgo(a.at)}</span>
                <span className="wsa-s-res">{a.success ? 'Signed in' : 'Refused'}</span>
                {a.shared ? <span className="wsa-flag">two IPs</span> : null}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
