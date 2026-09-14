'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Trash2, Send, AlertTriangle, GripVertical, Copy, Save,
  Phone, DollarSign, ClipboardCheck, FileText, CalendarDays, Link2,
} from 'lucide-react';
import { apiFetch, withWorkspace, useWorkspace } from '@/lib/workspace-client';

// Setting up a workspace's Submit page. Three things, in the order they matter:
// which forms exist, what the workspace integrates with, and — the one that
// decides whether a submission is accepted at all — where each form goes.

var ICON_FOR = {
  'phone': Phone,
  'dollar': DollarSign,
  'clipboard-check': ClipboardCheck,
  'document': FileText,
  'calendar': CalendarDays,
};

var BLANK = {
  formKey: '', label: '', description: '', audience: 'all',
  formUrl: '', icon: 'clipboard-check', accent: 'neutral',
  destinationLabel: '', sortOrder: 0, isActive: true,
};

export default function WorkspaceFormsPage() {
  var workspaceId = useWorkspace();
  var s1 = useState(null), data = s1[0], setData = s1[1];
  var s2 = useState(''), error = s2[0], setError = s2[1];
  var s3 = useState(''), notice = s3[0], setNotice = s3[1];
  var s4 = useState(false), busy = s4[0], setBusy = s4[1];
  var s5 = useState(null), editing = s5[0], setEditing = s5[1];
  var s6 = useState(''), dragKey = s6[0], setDragKey = s6[1];
  var s7 = useState({ provider: 'gohighlevel', configKey: 'round_robin_booking_url', configValue: '' });
  var newIntegration = s7[0], setNewIntegration = s7[1];

  var load = useCallback(function() {
    if (!workspaceId) return;
    apiFetch(withWorkspace('/api/admin/workspace/forms', workspaceId))
      .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, d: d }; }); })
      .then(function(res) {
        if (!res.ok || !res.d.success) { setError(res.d.error || 'Could not load this workspace.'); return; }
        setData(res.d); setError('');
      })
      .catch(function() { setError('Could not reach the server.'); });
  }, [workspaceId]);

  useEffect(function() { load(); }, [load]);

  function act(payload, done) {
    setBusy(true); setError(''); setNotice('');
    apiFetch(withWorkspace('/api/admin/workspace/forms', workspaceId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, d: d }; }); })
      .then(function(res) {
        setBusy(false);
        if (!res.ok || !res.d.success) { setError(res.d.error || 'That did not work.'); return; }
        setData(function(prev) { return Object.assign({}, prev, res.d); });
        if (done) done(res.d);
      })
      .catch(function() { setBusy(false); setError('Could not reach the server.'); });
  }

  function routeFor(formKey) {
    var routes = (data && data.routes) || [];
    for (var i = 0; i < routes.length; i++) if (routes[i].formKey === formKey) return routes[i];
    return null;
  }

  function onDrop(targetKey) {
    if (!dragKey || dragKey === targetKey) return;
    var keys = data.forms.map(function(f) { return f.formKey; });
    var from = keys.indexOf(dragKey);
    var to = keys.indexOf(targetKey);
    if (from === -1 || to === -1) return;
    keys.splice(to, 0, keys.splice(from, 1)[0]);
    setDragKey('');
    act({ action: 'reorder', order: keys });
  }

  if (error && !data) return <div className="p-6 max-w-[980px] mx-auto"><p className="wsa-err">{error}</p></div>;
  if (!data) return <div className="p-6 max-w-[980px] mx-auto"><p className="text-sm text-crm-muted">Loading…</p></div>;

  var missing = data.missingRoutes || [];

  return (
    <div className="p-6 space-y-6 max-w-[980px] mx-auto">
      <div>
        <h1 className="font-display text-2xl font-bold text-crm-text-bright">Submit forms — {data.workspace.name}</h1>
        <p className="text-sm text-crm-muted mt-1">
          Forms, links and destinations belong to this workspace alone. Nothing here is shared with another.
        </p>
      </div>

      {missing.length > 0 ? (
        <div className="wsa-banner">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>
            {missing.length} {missing.length === 1 ? 'form is' : 'forms are'} live with no destination.
            Submissions to {missing.length === 1 ? 'it' : 'them'} will be rejected.
          </span>
        </div>
      ) : null}

      {notice ? <p className="wsa-note">{notice}</p> : null}
      {error ? <p className="wsa-err">{error}</p> : null}

      {/* ===== FORMS ===== */}
      <section className="glass-card wsa-card">
        <div className="wsa-head">
          <h2 className="wsa-title">Forms</h2>
          <span className="section-tag">{data.forms.length}</span>
          <button type="button" className="wf-add" onClick={function() { setEditing(Object.assign({}, BLANK)); }}>
            <Plus className="w-3.5 h-3.5" /> Add a form
          </button>
        </div>
        <p className="wsa-sub">Drag to reorder. The order here is the order reps see.</p>

        {data.forms.length === 0 ? (
          <div>
            <p className="wsa-empty">No forms yet. Everything a rep can submit starts here.</p>
            {data.canRestoreOriginals ? (
              <div className="wsa-banner" style={{ marginTop: '10px' }}>
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>
                  This workspace has {data.recordCount} filed records but no forms — its Submit
                  page was lost when forms became per-workspace. Put the original
                  {' ' + data.originalFormCount} back, with their booking link and WhatsApp
                  destinations.
                </span>
                <button type="button" className="btn-primary wsa-btn" disabled={busy}
                  onClick={function() {
                    act({ action: 'restore-originals' }, function(d) {
                      setNotice('Restored ' + d.forms + ' forms to ' + (d.workspace || 'this workspace') + '.');
                    });
                  }}>
                  Restore them
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="wf-list">
            {data.forms.map(function(f) {
              var Icon = ICON_FOR[f.icon] || ClipboardCheck;
              var route = routeFor(f.formKey);
              var unrouted = f.isActive && !route;
              return (
                <div key={f.formKey}
                  className={'wf-row' + (f.isActive ? '' : ' off')}
                  draggable
                  onDragStart={function() { setDragKey(f.formKey); }}
                  onDragOver={function(e) { e.preventDefault(); }}
                  onDrop={function() { onDrop(f.formKey); }}
                >
                  <GripVertical className="w-3.5 h-3.5 wf-grip" />
                  <Icon className="w-4 h-4 wf-icon" />
                  <span className="wf-label">{f.label}</span>
                  <span className="wf-key">{f.formKey}</span>
                  <span className="wf-aud">{f.audience}</span>
                  {unrouted ? <span className="wf-chip-bad">Not set</span>
                    : route ? <span className="wf-chip-ok">{route.channel === 'none' ? 'no alerts' : route.target}</span>
                    : <span className="wf-chip-off">inactive</span>}
                  <button type="button" className="wf-act" title="Edit"
                    onClick={function() { setEditing(Object.assign({}, f)); }}>
                    <Save className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" className="wf-act" title={f.isActive ? 'Switch off' : 'Switch on'}
                    disabled={busy}
                    onClick={function() { act({ action: 'save-form', form: Object.assign({}, f, { isActive: !f.isActive }) }); }}>
                    <span className={'wf-dot' + (f.isActive ? ' on' : '')} />
                  </button>
                  <button type="button" className="wf-act" title="Remove" disabled={busy}
                    onClick={function() { act({ action: 'delete-form', formKey: f.formKey }); }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {editing ? (
          <form className="wf-edit" onSubmit={function(e) {
            e.preventDefault();
            act({ action: 'save-form', form: editing }, function() { setEditing(null); });
          }}>
            <div className="wf-edit-grid">
              <label className="wf-f"><span>Key</span>
                <input className="input-field" value={editing.formKey} required
                  placeholder="close-deal"
                  onChange={function(e) { setEditing(Object.assign({}, editing, { formKey: e.target.value })); }} />
              </label>
              <label className="wf-f"><span>Label</span>
                <input className="input-field" value={editing.label} required
                  onChange={function(e) { setEditing(Object.assign({}, editing, { label: e.target.value })); }} />
              </label>
              <label className="wf-f wf-wide"><span>Description</span>
                <input className="input-field" value={editing.description}
                  placeholder="Closers — ring the bell on a won deal"
                  onChange={function(e) { setEditing(Object.assign({}, editing, { description: e.target.value })); }} />
              </label>
              <label className="wf-f wf-wide"><span>Form URL</span>
                <input className="input-field" value={editing.formUrl} placeholder="https://…"
                  onChange={function(e) { setEditing(Object.assign({}, editing, { formUrl: e.target.value })); }} />
              </label>
              <label className="wf-f"><span>Audience</span>
                <select className="input-field" value={editing.audience}
                  onChange={function(e) { setEditing(Object.assign({}, editing, { audience: e.target.value })); }}>
                  {data.audiences.map(function(a) { return <option key={a} value={a}>{a}</option>; })}
                </select>
              </label>
              <label className="wf-f"><span>Icon</span>
                <select className="input-field" value={editing.icon}
                  onChange={function(e) { setEditing(Object.assign({}, editing, { icon: e.target.value })); }}>
                  {data.icons.map(function(i) { return <option key={i} value={i}>{i}</option>; })}
                </select>
              </label>
            </div>
            <div className="wf-edit-foot">
              <button type="submit" className="btn-primary wsa-btn" disabled={busy}>Save form</button>
              <button type="button" className="wf-cancel" onClick={function() { setEditing(null); }}>Cancel</button>
            </div>
          </form>
        ) : null}
      </section>

      {/* ===== ROUTING ===== */}
      <section className="glass-card wsa-card">
        <div className="wsa-head">
          <h2 className="wsa-title">Where submissions go</h2>
        </div>
        <p className="wsa-sub">
          A form with no destination refuses submissions rather than sending them somewhere
          else. Pick <code className="aik-code">no alerts</code> when a form should record
          without notifying anyone. Send a test before a rep files a real deal.
        </p>

        {data.forms.length === 0 ? (
          <p className="wsa-empty">Add a form first.</p>
        ) : data.forms.map(function(f) {
          var route = routeFor(f.formKey) || { formKey: f.formKey, channel: 'whatsapp', target: '' };
          return (
            <RouteRow key={f.formKey} form={f} route={route} channels={data.channels}
              busy={busy} canTestSend={data.canTestSend}
              suggestions={(data.suggestions || {})[f.formKey] || []}
              externallyPosted={(data.externallyPosted || []).indexOf(f.formKey) !== -1}
              onSave={function(next) { act({ action: 'save-route', formKey: f.formKey, channel: next.channel, target: next.target, isActive: true }); }}
              onTest={function() { act({ action: 'test-send', formKey: f.formKey }, function(d) { setNotice(d.note || 'Test sent.'); }); }}
            />
          );
        })}
      </section>

      {/* ===== INTEGRATIONS ===== */}
      <section className="glass-card wsa-card">
        <div className="wsa-head">
          <Link2 className="w-4 h-4 text-crm-accent" />
          <h2 className="wsa-title">Integrations</h2>
        </div>
        <p className="wsa-sub">
          The round-robin booking link lives here as
          <code className="aik-code">gohighlevel / round_robin_booking_url</code>. Any other
          provider is a label and a value — no new field needs building.
        </p>

        <div className="wsa-list">
          {(data.integrations || []).map(function(it) {
            return (
              <div key={it.provider + it.configKey} className="wf-int">
                <span className="wf-int-p">{it.provider}</span>
                <span className="wf-int-k">{it.configKey}</span>
                <span className="wf-int-v">{it.configValue}</span>
                <button type="button" className="wf-act" disabled={busy} title="Remove"
                  onClick={function() { act({ action: 'delete-integration', provider: it.provider, configKey: it.configKey }); }}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
          {(data.integrations || []).length === 0 ? <p className="wsa-empty">Nothing connected yet.</p> : null}
        </div>

        <form className="wsa-row" style={{ marginTop: '12px' }} onSubmit={function(e) {
          e.preventDefault();
          act(Object.assign({ action: 'save-integration' }, newIntegration), function() {
            setNewIntegration({ provider: 'gohighlevel', configKey: 'round_robin_booking_url', configValue: '' });
          });
        }}>
          <input className="input-field" value={newIntegration.provider} placeholder="provider" required
            onChange={function(e) { setNewIntegration(Object.assign({}, newIntegration, { provider: e.target.value })); }} />
          <input className="input-field" value={newIntegration.configKey} placeholder="key" required
            onChange={function(e) { setNewIntegration(Object.assign({}, newIntegration, { configKey: e.target.value })); }} />
          <input className="input-field" value={newIntegration.configValue} placeholder="value" required
            onChange={function(e) { setNewIntegration(Object.assign({}, newIntegration, { configValue: e.target.value })); }} />
          <button type="submit" className="btn-primary wsa-btn" disabled={busy}>Add</button>
        </form>
      </section>

      {/* ===== COPY SETUP ===== */}
      {(data.copyableFrom || []).length > 0 ? (
        <section className="glass-card wsa-card">
          <div className="wsa-head">
            <Copy className="w-4 h-4 text-crm-accent" />
            <h2 className="wsa-title">Copy setup from another workspace</h2>
          </div>
          <p className="wsa-sub">
            Copies that workspace&rsquo;s forms and integrations into this one. Destinations are
            never copied — those get typed in by somebody looking at the right group.
          </p>
          <div className="wsa-row">
            {data.copyableFrom.map(function(w) {
              return (
                <button key={w.id} type="button" className="wf-copy" disabled={busy}
                  onClick={function() {
                    act({ action: 'copy-setup', sourceWorkspaceId: w.id }, function(d) {
                      setNotice('Copied ' + d.forms + ' forms and ' + d.integrations
                        + ' integrations from ' + d.copiedFrom + '. ' + d.note);
                    });
                  }}>
                  {w.name}
                </button>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function RouteRow({ form, route, channels, busy, canTestSend, suggestions, externallyPosted, onSave, onTest }) {
  var s1 = useState(route.channel), channel = s1[0], setChannel = s1[1];
  var s2 = useState(route.target === 'none' ? '' : route.target), target = s2[0], setTarget = s2[1];
  var configured = !!routeTargetOf(route);
  var hints = suggestions || [];

  return (
    <>
    <form className="wf-route" onSubmit={function(e) { e.preventDefault(); onSave({ channel: channel, target: target }); }}>
      <span className="wf-route-name">{form.label}</span>
      <select className="input-field" value={channel} onChange={function(e) { setChannel(e.target.value); }}>
        {channels.map(function(c) { return <option key={c} value={c}>{c === 'none' ? 'no alerts' : c}</option>; })}
      </select>
      <input className="input-field" value={target} disabled={channel === 'none'}
        placeholder={channel === 'none' ? 'nothing is sent' : 'group id / address'}
        onChange={function(e) { setTarget(e.target.value); }} />
      <button type="submit" className="btn-primary wsa-btn" disabled={busy}>Save</button>
      <button type="button" className="wf-act" title={canTestSend ? 'Send a test message' : 'No sender configured'}
        disabled={busy || !configured || !canTestSend} onClick={onTest}>
        <Send className="w-3.5 h-3.5" />
      </button>
      {!configured ? <span className="wf-chip-bad">Not set</span> : null}
    </form>
    {/* A WhatsApp group never shows its own address, so nobody can copy it off
        their screen. These are the groups this CRM has actually posted this form
        to before, read back out of the message log. */}
    {!configured && externallyPosted ? (
      <div className="wf-hints">
        <span className="wf-hints-label">
          An n8n workflow already posts this one to WhatsApp. Giving it a destination here
          would put a second copy of every message in the same group — pick
        </span>
        <button type="button" className="wf-hint" disabled={busy}
          onClick={function() { setChannel('none'); onSave({ channel: 'none', target: '' }); }}>
          no alerts
        </button>
        <span className="wf-hints-label">instead, and the CRM will keep recording them.</span>
      </div>
    ) : null}
    {!configured && !externallyPosted && hints.length ? (
      <div className="wf-hints">
        <span className="wf-hints-label">Previously sent to:</span>
        {hints.map(function(h) {
          return (
            <button key={h.target} type="button" className="wf-hint" disabled={busy}
              title={h.count + ' message(s), last ' + new Date(h.lastSeen).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              onClick={function() { setTarget(h.target); onSave({ channel: 'whatsapp', target: h.target }); }}>
              {h.target}
            </button>
          );
        })}
      </div>
    ) : null}
    </>
  );
}

function routeTargetOf(route) {
  if (!route) return '';
  if (route.channel === 'none') return 'none';
  return route.target || '';
}
