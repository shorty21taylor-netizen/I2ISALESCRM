'use client';
import { useState, useEffect } from 'react';
import { Building2, Plus, Trash2, Save, X, AlertCircle, CheckCircle } from 'lucide-react';
import { setActiveWorkspace } from '@/lib/workspace-client';
import { ALL_WORKSPACES } from '@/lib/workspaces';

export default function WorkspaceManager() {
  var s1 = useState([]), workspaces = s1[0], setWorkspaces = s1[1];
  var s2 = useState(false), adding = s2[0], setAdding = s2[1];
  var s3 = useState(''), newName = s3[0], setNewName = s3[1];
  var s4 = useState(''), newShort = s4[0], setNewShort = s4[1];
  var s5 = useState('10'), newRate = s5[0], setNewRate = s5[1];
  var s6 = useState(''), newOffers = s6[0], setNewOffers = s6[1];
  var s7 = useState(null), result = s7[0], setResult = s7[1];
  var s8 = useState(null), editing = s8[0], setEditing = s8[1];
  var s9 = useState(null), confirmDelete = s9[0], setConfirmDelete = s9[1];

  useEffect(function() { load(); }, []);

  function flash(ok, message) {
    setResult({ success: ok, message: message });
    setTimeout(function() { setResult(null); }, 4000);
  }

  function load() {
    fetch('/api/workspaces')
      .then(function(r) { return r.json(); })
      .then(function(d) { if (d.success) setWorkspaces(d.workspaces || []); })
      .catch(function() {});
  }

  function parseOffers(text) {
    return (text || '').split('\n')
      .map(function(l) { return l.trim(); })
      .filter(function(l) { return l.length > 0; });
  }

  function handleCreate() {
    if (!newName.trim()) { flash(false, 'Give the workspace a name'); return; }
    fetch('/api/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newName.trim(),
        shortName: newShort.trim(),
        commissionRate: (parseFloat(newRate) || 0) / 100,
        offers: parseOffers(newOffers),
      }),
    })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (!d.success) { flash(false, d.error || 'Could not create workspace'); return; }
        flash(true, 'Created "' + d.workspace.name + '"');
        setAdding(false);
        setNewName(''); setNewShort(''); setNewRate('10'); setNewOffers('');
        load();
      })
      .catch(function(e) { flash(false, e.message); });
  }

  function handleSaveEdit() {
    if (!editing) return;
    fetch('/api/workspaces', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editing.id,
        name: editing.name,
        shortName: editing.shortName,
        commissionRate: (parseFloat(editing.ratePct) || 0) / 100,
        offers: parseOffers(editing.offersText),
      }),
    })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (!d.success) { flash(false, d.error || 'Could not save workspace'); return; }
        flash(true, 'Saved "' + d.workspace.name + '"');
        setEditing(null);
        load();
      })
      .catch(function(e) { flash(false, e.message); });
  }

  function handleDelete(id) {
    fetch('/api/workspaces?id=' + encodeURIComponent(id), { method: 'DELETE' })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (!d.success) { flash(false, d.error || 'Could not delete workspace'); return; }
        flash(true, d.movedRecords > 0
          ? ('Deleted. ' + d.movedRecords + ' record(s) moved to another workspace.')
          : 'Workspace deleted.');
        setConfirmDelete(null);
        setActiveWorkspace(ALL_WORKSPACES);
        load();
      })
      .catch(function(e) { flash(false, e.message); });
  }

  function startEdit(ws) {
    setEditing({
      id: ws.id,
      name: ws.name,
      shortName: ws.shortName || '',
      ratePct: String(Math.round((ws.commissionRate || 0) * 1000) / 10),
      offersText: (ws.offers || []).join('\n'),
    });
  }

  return (
    <div className="glass-card overflow-hidden stagger-1">
      <div className="section-header">
        <h3><Building2 className="w-4 h-4 text-crm-accent" /> Workspaces</h3>
        <span className="section-tag">{workspaces.length} {workspaces.length === 1 ? 'company' : 'companies'}</span>
      </div>

      <div className="p-5 space-y-4">
        <p className="text-xs text-crm-muted">
          Each workspace is a separate company. Booked calls, deals, EOD reports and commissions are
          scoped to the workspace selected in the sidebar. Offers listed here route incoming records
          to the right company automatically.
        </p>

        {result && (
          <div className={'flex items-center gap-2 p-3 rounded-lg ' + (result.success ? 'bg-crm-positive/5 border border-crm-positive/20' : 'bg-crm-negative/5 border border-crm-negative/20')}>
            {result.success ? <CheckCircle className="w-4 h-4 text-crm-positive" /> : <AlertCircle className="w-4 h-4 text-crm-negative" />}
            <span className={'text-xs font-mono ' + (result.success ? 'text-crm-positive' : 'text-crm-negative')}>{result.message}</span>
          </div>
        )}

        <div className="space-y-3">
          {workspaces.map(function(ws) {
            var isEditing = editing && editing.id === ws.id;
            return (
              <div key={ws.id} className="glass-surface p-4">
                {!isEditing ? (
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-display font-semibold text-crm-text-bright">{ws.name}</span>
                        <span className="section-tag">{ws.shortName || ws.id}</span>
                        {ws.builtIn && <span className="badge-neutral">built-in</span>}
                      </div>
                      <div className="text-xs text-crm-muted mt-1 font-mono">
                        {Math.round((ws.commissionRate || 0) * 1000) / 10}% commission &middot; {(ws.offers || []).length} offers
                      </div>
                      {(ws.offers || []).length > 0 && (
                        <div className="text-[11px] text-crm-muted/70 mt-1 truncate">{(ws.offers || []).join(' · ')}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={function() { startEdit(ws); }} className="btn-ghost text-xs">Edit</button>
                      {!ws.builtIn && (
                        <button
                          onClick={function() { setConfirmDelete(ws); }}
                          className="btn-ghost p-2 text-crm-negative"
                          aria-label={'Delete ' + ws.name}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
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
                        <label className="block text-xs font-mono text-crm-muted uppercase tracking-wider mb-2">Short name</label>
                        <input className="input-field text-sm" value={editing.shortName}
                          onChange={function(e) { setEditing(Object.assign({}, editing, { shortName: e.target.value })); }} />
                      </div>
                      <div>
                        <label className="block text-xs font-mono text-crm-muted uppercase tracking-wider mb-2">Commission %</label>
                        <input className="input-field text-sm" type="number" step="0.1" value={editing.ratePct}
                          onChange={function(e) { setEditing(Object.assign({}, editing, { ratePct: e.target.value })); }} />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-mono text-crm-muted uppercase tracking-wider mb-2">Offers (one per line)</label>
                      <textarea className="input-field text-sm" rows={4} value={editing.offersText}
                        onChange={function(e) { setEditing(Object.assign({}, editing, { offersText: e.target.value })); }} />
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={handleSaveEdit} className="btn-primary text-sm flex items-center gap-2">
                        <Save className="w-3.5 h-3.5" /> Save
                      </button>
                      <button onClick={function() { setEditing(null); }} className="btn-ghost text-sm">Cancel</button>
                    </div>
                  </div>
                )}

                {confirmDelete && confirmDelete.id === ws.id && (
                  <div className="mt-3 p-3 rounded-lg" style={{ background: 'var(--glass-surface-hover)', border: '0.5px solid var(--glass-surface-border)' }}>
                    <p className="text-xs text-crm-text">
                      Delete <strong>{ws.name}</strong>? Its records are moved to another workspace, not deleted.
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <button onClick={function() { handleDelete(ws.id); }} className="btn-ghost text-xs text-crm-negative">Yes, delete</button>
                      <button onClick={function() { setConfirmDelete(null); }} className="btn-ghost text-xs">Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {!adding ? (
          <button onClick={function() { setAdding(true); }} className="btn-ghost text-sm flex items-center gap-2">
            <Plus className="w-3.5 h-3.5" /> Add workspace
          </button>
        ) : (
          <div className="glass-surface p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-display font-semibold text-crm-text-bright">New workspace</span>
              <button onClick={function() { setAdding(false); }} className="btn-ghost p-1.5" aria-label="Cancel">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-mono text-crm-muted uppercase tracking-wider mb-2">Name</label>
                <input className="input-field text-sm" value={newName} placeholder="Acme Holdings"
                  onChange={function(e) { setNewName(e.target.value); }} />
              </div>
              <div>
                <label className="block text-xs font-mono text-crm-muted uppercase tracking-wider mb-2">Short name</label>
                <input className="input-field text-sm" value={newShort} placeholder="ACME"
                  onChange={function(e) { setNewShort(e.target.value); }} />
              </div>
              <div>
                <label className="block text-xs font-mono text-crm-muted uppercase tracking-wider mb-2">Commission %</label>
                <input className="input-field text-sm" type="number" step="0.1" value={newRate}
                  onChange={function(e) { setNewRate(e.target.value); }} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-mono text-crm-muted uppercase tracking-wider mb-2">Offers (one per line)</label>
              <textarea className="input-field text-sm" rows={3} value={newOffers} placeholder={'High Ticket Coaching\nDone-For-You Setup'}
                onChange={function(e) { setNewOffers(e.target.value); }} />
            </div>
            <button onClick={handleCreate} className="btn-primary text-sm flex items-center gap-2">
              <Plus className="w-3.5 h-3.5" /> Create workspace
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
