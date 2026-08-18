'use client';
import { useState, useEffect, useCallback } from 'react';
import { UserPlus, Users, Trash2, Save, Key, Check, AlertCircle, X, Building2 } from 'lucide-react';
import { apiFetch } from '@/lib/workspace-client';

function emptyForm() {
  return { name: '', email: '', password: '', role: 'closer', workspaceIds: [] };
}

export default function TeamPage() {
  var s1 = useState([]), users = s1[0], setUsers = s1[1];
  var s2 = useState([]), workspaces = s2[0], setWorkspaces = s2[1];
  var s3 = useState(emptyForm()), form = s3[0], setForm = s3[1];
  var s4 = useState(null), msg = s4[0], setMsg = s4[1];
  var s5 = useState(true), loading = s5[0], setLoading = s5[1];
  var s6 = useState(null), editing = s6[0], setEditing = s6[1];
  var s7 = useState(null), confirmDelete = s7[0], setConfirmDelete = s7[1];
  var s8 = useState(false), denied = s8[0], setDenied = s8[1];

  var load = useCallback(function() {
    apiFetch('/api/users')
      .then(function(r) {
        if (r.status === 403) { setDenied(true); return null; }
        return r.json();
      })
      .then(function(d) {
        if (!d) return;
        if (d.success) { setUsers(d.users || []); setWorkspaces(d.workspaces || []); }
      })
      .catch(function() {})
      .then(function() { setLoading(false); });
  }, []);

  useEffect(function() { load(); }, [load]);

  function flash(ok, text) {
    setMsg({ ok: ok, text: text });
    setTimeout(function() { setMsg(null); }, 5000);
  }

  function toggleWorkspace(list, id) {
    return list.indexOf(id) === -1
      ? list.concat([id])
      : list.filter(function(w) { return w !== id; });
  }

  function handleCreate(e) {
    e.preventDefault();
    if (!form.email.trim()) { flash(false, 'Email is required'); return; }
    if (form.password.length < 6) { flash(false, 'Password must be at least 6 characters'); return; }
    if (form.workspaceIds.length === 0) { flash(false, 'Assign at least one workspace'); return; }

    apiFetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (!d.success) { flash(false, d.error || 'Could not create user'); return; }
        flash(true, d.user.name + ' can now sign in with that email and password');
        setForm(emptyForm());
        load();
      })
      .catch(function(err) { flash(false, err.message); });
  }

  function saveEdit() {
    if (!editing) return;
    var payload = { email: editing.email, name: editing.name, workspaceIds: editing.workspaceIds, role: editing.role };
    if (editing.password) payload.password = editing.password;

    apiFetch('/api/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (!d.success) { flash(false, d.error || 'Could not save'); return; }
        flash(true, 'Saved ' + d.user.name + (editing.password ? ' — password updated' : ''));
        setEditing(null);
        load();
      })
      .catch(function(err) { flash(false, err.message); });
  }

  function removeUser(email) {
    apiFetch('/api/users?email=' + encodeURIComponent(email), { method: 'DELETE' })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (!d.success) { flash(false, d.error || 'Could not remove'); return; }
        flash(true, email + ' removed');
        setConfirmDelete(null);
        load();
      })
      .catch(function(err) { flash(false, err.message); });
  }

  function workspaceNames(ids) {
    return (ids || []).map(function(id) {
      var w = workspaces.filter(function(x) { return x.id === id; })[0];
      return w ? w.name : id;
    });
  }

  if (denied) {
    return (
      <div className="p-6 max-w-[900px] mx-auto">
        <div className="glass-card p-6 text-sm text-crm-muted">
          Only the operator account can manage team members.
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-[1000px] mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <UserPlus className="w-6 h-6 text-crm-accent" />
        <div>
          <h1 className="font-display text-2xl font-bold text-crm-text-bright">Team Members</h1>
          <p className="text-xs text-crm-muted mt-0.5">
            Set someone&apos;s password and choose which workspaces they can reach
          </p>
        </div>
      </div>

      {msg && (
        <div className={'flex items-center gap-2 p-3 rounded-lg mb-4 ' + (msg.ok ? 'bg-crm-positive/5 border border-crm-positive/20' : 'bg-crm-negative/5 border border-crm-negative/20')}>
          {msg.ok ? <Check className="w-4 h-4 text-crm-positive" /> : <AlertCircle className="w-4 h-4 text-crm-negative" />}
          <span className={'text-xs font-mono ' + (msg.ok ? 'text-crm-positive' : 'text-crm-negative')}>{msg.text}</span>
        </div>
      )}

      {/* Create */}
      <div className="glass-card overflow-hidden mb-6">
        <div className="section-header">
          <h3><Key className="w-4 h-4 text-crm-accent" /> Add a person</h3>
        </div>
        <form onSubmit={handleCreate} className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono text-crm-muted uppercase tracking-wider mb-2">Name</label>
              <input className="input-field" value={form.name} placeholder="Adeel"
                onChange={function(e) { setForm(Object.assign({}, form, { name: e.target.value })); }} />
            </div>
            <div>
              <label className="block text-xs font-mono text-crm-muted uppercase tracking-wider mb-2">Email</label>
              <input className="input-field" type="email" value={form.email} placeholder="adeel@summitclosing.com"
                onChange={function(e) { setForm(Object.assign({}, form, { email: e.target.value })); }} />
            </div>
            <div>
              <label className="block text-xs font-mono text-crm-muted uppercase tracking-wider mb-2">Password</label>
              <input className="input-field" type="text" value={form.password} placeholder="At least 6 characters"
                onChange={function(e) { setForm(Object.assign({}, form, { password: e.target.value })); }} />
              <p className="text-[10px] text-crm-muted/60 mt-1">Shown in plain text so you can pass it on. Stored hashed.</p>
            </div>
            <div>
              <label className="block text-xs font-mono text-crm-muted uppercase tracking-wider mb-2">Role</label>
              <select className="input-field" value={form.role}
                onChange={function(e) { setForm(Object.assign({}, form, { role: e.target.value })); }}>
                <option value="closer">Closer</option>
                <option value="setter">Setter</option>
                <option value="manager">Manager</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono text-crm-muted uppercase tracking-wider mb-2">
              Workspaces &mdash; they will only see these
            </label>
            <div className="flex flex-wrap gap-2">
              {workspaces.map(function(w) {
                var on = form.workspaceIds.indexOf(w.id) !== -1;
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={function() { setForm(Object.assign({}, form, { workspaceIds: toggleWorkspace(form.workspaceIds, w.id) })); }}
                    className={'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono border transition-all ' +
                      (on ? 'text-crm-text-bright border-crm-accent/40' : 'text-crm-muted border-crm-border hover:text-crm-text')}
                    style={on ? { background: 'rgba(var(--accent-rgb),0.15)' } : {}}
                  >
                    {on ? <Check className="w-3 h-3" /> : <Building2 className="w-3 h-3" />} {w.name}
                  </button>
                );
              })}
              {workspaces.length === 0 && <span className="text-xs text-crm-muted">No workspaces yet</span>}
            </div>
          </div>

          <button type="submit" className="btn-primary text-sm flex items-center gap-2">
            <UserPlus className="w-3.5 h-3.5" /> Create account
          </button>
        </form>
      </div>

      {/* Existing */}
      <div className="glass-card overflow-hidden">
        <div className="section-header">
          <h3><Users className="w-4 h-4 text-crm-accent" /> Accounts</h3>
          <span className="section-tag">{users.length}</span>
        </div>
        <div className="p-5 space-y-3">
          {loading && <p className="text-xs text-crm-muted">Loading…</p>}
          {!loading && users.length === 0 && (
            <p className="text-xs text-crm-muted">No accounts yet. Anyone without one signs in with the shared team password.</p>
          )}

          {users.map(function(u) {
            var isEditing = editing && editing.email === u.email;
            return (
              <div key={u.email} className="glass-surface p-4">
                {!isEditing ? (
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-display font-semibold text-crm-text-bright">{u.name}</span>
                        <span className="section-tag">{u.role}</span>
                      </div>
                      <div className="text-xs font-mono text-crm-muted mt-0.5">{u.email}</div>
                      <div className="text-[11px] text-crm-muted/70 mt-1">
                        {workspaceNames(u.workspaceIds).join(' · ') || 'No workspace assigned'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={function() { setEditing(Object.assign({}, u, { password: '' })); }} className="btn-ghost text-xs">Edit</button>
                      <button onClick={function() { setConfirmDelete(u.email); }} className="btn-ghost p-2 text-crm-negative" aria-label={'Remove ' + u.email}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-mono text-crm-muted uppercase tracking-wider mb-2">Name</label>
                        <input className="input-field text-sm" value={editing.name}
                          onChange={function(e) { setEditing(Object.assign({}, editing, { name: e.target.value })); }} />
                      </div>
                      <div>
                        <label className="block text-xs font-mono text-crm-muted uppercase tracking-wider mb-2">New password</label>
                        <input className="input-field text-sm" type="text" value={editing.password} placeholder="Leave blank to keep"
                          onChange={function(e) { setEditing(Object.assign({}, editing, { password: e.target.value })); }} />
                      </div>
                      <div>
                        <label className="block text-xs font-mono text-crm-muted uppercase tracking-wider mb-2">Role</label>
                        <select className="input-field text-sm" value={editing.role}
                          onChange={function(e) { setEditing(Object.assign({}, editing, { role: e.target.value })); }}>
                          <option value="closer">Closer</option>
                          <option value="setter">Setter</option>
                          <option value="manager">Manager</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-mono text-crm-muted uppercase tracking-wider mb-2">Workspaces</label>
                      <div className="flex flex-wrap gap-2">
                        {workspaces.map(function(w) {
                          var on = (editing.workspaceIds || []).indexOf(w.id) !== -1;
                          return (
                            <button
                              key={w.id}
                              type="button"
                              onClick={function() { setEditing(Object.assign({}, editing, { workspaceIds: toggleWorkspace(editing.workspaceIds || [], w.id) })); }}
                              className={'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono border transition-all ' +
                                (on ? 'text-crm-text-bright border-crm-accent/40' : 'text-crm-muted border-crm-border hover:text-crm-text')}
                              style={on ? { background: 'rgba(var(--accent-rgb),0.15)' } : {}}
                            >
                              {on ? <Check className="w-3 h-3" /> : <Building2 className="w-3 h-3" />} {w.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={saveEdit} className="btn-primary text-sm flex items-center gap-2">
                        <Save className="w-3.5 h-3.5" /> Save
                      </button>
                      <button onClick={function() { setEditing(null); }} className="btn-ghost text-sm">Cancel</button>
                    </div>
                  </div>
                )}

                {confirmDelete === u.email && (
                  <div className="mt-3 p-3 rounded-lg" style={{ background: 'var(--glass-surface-hover)', border: '0.5px solid var(--glass-surface-border)' }}>
                    <p className="text-xs text-crm-text">Remove <strong>{u.email}</strong>? They will no longer be able to sign in.</p>
                    <div className="flex items-center gap-2 mt-2">
                      <button onClick={function() { removeUser(u.email); }} className="btn-ghost text-xs text-crm-negative">Yes, remove</button>
                      <button onClick={function() { setConfirmDelete(null); }} className="btn-ghost text-xs">Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
