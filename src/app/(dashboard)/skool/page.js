'use client';

import { useState, useEffect } from 'react';
import { GraduationCap, Plus, X, Trash2, Users, DollarSign, TrendingUp, ArrowUpRight, Search } from 'lucide-react';
import { useWorkspace, withWorkspace, apiFetch, ALL_WORKSPACES } from '@/lib/workspace-client';
import { getUser } from '@/lib/auth';
import { formatCurrency } from '@/lib/utils';
import { SKOOL_STAGES, SKOOL_COMMUNITIES, DEFAULT_STAGE, stageLabel } from '@/lib/skool';
import ConfirmDialog from '@/components/ConfirmDialog';

var EMPTY_LEAD = {
  name: '', handle: '', email: '', phone: '',
  community: 'free', stage: DEFAULT_STAGE,
  setter: '', closer: '', bookedFor: '',
  communityCash: '', highTicketCash: '',
  offer: '', notes: '',
};

// Won stages read green, the lost one reads muted — but every column and every card
// carries its stage in words, so the colour is never the thing telling them apart.
function stageAccent(stage) {
  if (stage === 'closed' || stage === 'paid-community') return '#22c55e';
  if (stage === 'no-close') return '#ef4444';
  return 'var(--crm-accent)';
}

export default function SkoolPage() {
  var workspaceId = useWorkspace();
  var [leads, setLeads] = useState([]);
  var [stats, setStats] = useState(null);
  var [loading, setLoading] = useState(true);
  var [editing, setEditing] = useState(null);
  var [form, setForm] = useState(EMPTY_LEAD);
  var [saving, setSaving] = useState(false);
  var [error, setError] = useState('');
  var [filterSetter, setFilterSetter] = useState('');
  var [search, setSearch] = useState('');
  var [confirmDelete, setConfirmDelete] = useState(null);

  var user = getUser();
  var isAdmin = user && user.email === 'shorty21taylor@gmail.com';

  useEffect(function() { if (workspaceId !== null) load(); }, [workspaceId]);

  function load() {
    setLoading(true);
    apiFetch(withWorkspace('/api/skool', workspaceId))
      .then(function(r) { return r.json(); })
      .then(function(d) {
        setLeads((d.data || []).filter(Boolean));
        setStats(d.stats || null);
        setLoading(false);
      })
      .catch(function() { setLoading(false); });
  }

  function openNew(community, stage) {
    setError('');
    setForm(Object.assign({}, EMPTY_LEAD, {
      community: community || 'free',
      stage: stage || DEFAULT_STAGE,
      setter: user ? user.name : '',
    }));
    setEditing('new');
  }

  function openEdit(lead) {
    setError('');
    setForm({
      name: lead.name || '', handle: lead.handle || '', email: lead.email || '', phone: lead.phone || '',
      community: lead.community || 'free', stage: lead.stage || DEFAULT_STAGE,
      setter: lead.setter || '', closer: lead.closer || '', bookedFor: lead.bookedFor || '',
      communityCash: lead.communityCash || '', highTicketCash: lead.highTicketCash || '',
      offer: lead.offer || '', notes: lead.notes || '',
    });
    setEditing(lead.id);
  }

  function save() {
    if (!form.name.trim()) { setError('A name is required'); return; }
    setSaving(true);
    setError('');
    var isNew = editing === 'new';
    var body = Object.assign({}, form);
    if (!isNew || !workspaceId || workspaceId === ALL_WORKSPACES) delete body.workspaceId;

    apiFetch(isNew ? '/api/skool' : '/api/skool/' + editing, {
      method: isNew ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, d: d }; }); })
      .then(function(res) {
        setSaving(false);
        if (!res.ok || res.d.error) { setError(res.d.error || 'Could not save'); return; }
        setEditing(null);
        load();
      })
      .catch(function(e) { setSaving(false); setError(e.message); });
  }

  // Moving someone along the pipeline is the thing this page exists for, so it is a
  // single control on the card rather than a trip through the editor.
  function moveStage(lead, stage) {
    apiFetch('/api/skool/' + lead.id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: stage }),
    })
      .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, d: d }; }); })
      .then(function(res) {
        if (!res.ok || res.d.error) { setError(res.d.error || 'Could not move that lead'); return; }
        load();
      })
      .catch(function(e) { setError(e.message); });
  }

  function remove(id) {
    apiFetch('/api/skool/' + id, { method: 'DELETE' })
      .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, d: d }; }); })
      .then(function(res) {
        setConfirmDelete(null);
        if (!res.ok || res.d.error) { setError(res.d.error || 'Could not remove that lead'); return; }
        load();
      })
      .catch(function(e) { setConfirmDelete(null); setError(e.message); });
  }

  var term = search.toLowerCase().trim();
  var visible = leads.filter(function(l) {
    if (filterSetter && (l.setter || 'Unassigned') !== filterSetter) return false;
    if (term) {
      var hay = ((l.name || '') + ' ' + (l.handle || '') + ' ' + (l.email || '') + ' ' + (l.notes || '')).toLowerCase();
      if (hay.indexOf(term) === -1) return false;
    }
    return true;
  });

  var overall = (stats && stats.overall) || { leads: 0, cash: 0, communityCash: 0, highTicketCash: 0, upgrades: 0, booked: 0, closed: 0 };
  var setters = (stats && stats.setters) || [];
  var setterPeak = setters.reduce(function(m, s) { return Math.max(m, s.cash); }, 0);

  function sectionLeads(communityId) {
    return visible.filter(function(l) { return l.community === communityId; });
  }

  function renderCard(lead) {
    var total = (Number(lead.communityCash) || 0) + (Number(lead.highTicketCash) || 0);
    return (
      <div key={lead.id} className="glass-surface rounded-xl p-3 space-y-2">
        <button onClick={function() { openEdit(lead); }} className="w-full text-left">
          <p className="text-sm font-display font-semibold truncate" style={{ color: 'var(--crm-text-bright)' }}>
            {lead.name || 'Unnamed'}
          </p>
          {lead.handle && (
            <p className="text-[11px] font-mono truncate" style={{ color: 'var(--crm-text-muted)' }}>{lead.handle}</p>
          )}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {lead.setter && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                style={{ background: 'rgba(var(--accent-rgb),0.10)', color: 'var(--crm-text-muted)' }}>
                {lead.setter}
              </span>
            )}
            {total > 0 && (
              <span className="text-[11px] font-mono font-bold" style={{ color: '#22c55e' }}>{formatCurrency(total)}</span>
            )}
          </div>
          {lead.bookedFor && lead.stage === 'booked-call' && (
            <p className="text-[10px] font-mono mt-1" style={{ color: 'var(--crm-text-muted)' }}>📅 {lead.bookedFor}</p>
          )}
        </button>

        <select
          value={lead.stage}
          onChange={function(e) { moveStage(lead, e.target.value); }}
          className="input-field w-full"
          style={{ fontSize: '11px', padding: '4px 8px' }}
        >
          {SKOOL_STAGES.map(function(s) {
            return <option key={s.id} value={s.id}>{s.label}</option>;
          })}
        </select>
      </div>
    );
  }

  function renderSection(community) {
    var rows = sectionLeads(community.id);
    var bucket = (stats && stats.byCommunity && stats.byCommunity[community.id]) || { leads: 0, cash: 0, communityCash: 0, highTicketCash: 0, upgrades: 0 };

    return (
      <div key={community.id} className="glass-card overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 p-4 md:p-5"
          style={{ borderBottom: '0.5px solid var(--crm-divider)' }}>
          <div>
            <h2 className="text-base font-display font-bold" style={{ color: 'var(--crm-text-bright)' }}>{community.label}</h2>
            <p className="text-xs font-mono" style={{ color: 'var(--crm-text-muted)' }}>{community.blurb}</p>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="text-right">
              <p className="text-[10px] font-mono uppercase" style={{ color: 'var(--crm-text-muted)' }}>People</p>
              <p className="text-sm font-display font-bold" style={{ color: 'var(--crm-text-bright)' }}>{bucket.leads}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-mono uppercase" style={{ color: 'var(--crm-text-muted)' }}>Cash</p>
              <p className="text-sm font-display font-bold" style={{ color: '#22c55e' }}>{formatCurrency(bucket.cash)}</p>
            </div>
            <button onClick={function() { openNew(community.id, DEFAULT_STAGE); }} className="btn-ghost flex items-center gap-1.5 text-xs">
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          </div>
        </div>

        <div className="table-scroll p-4 md:p-5">
          <div className="flex gap-3" style={{ minWidth: (SKOOL_STAGES.length * 210) + 'px' }}>
            {SKOOL_STAGES.map(function(stage) {
              var inStage = rows.filter(function(l) { return l.stage === stage.id; });
              var stageCash = inStage.reduce(function(sum, l) {
                return sum + (Number(l.communityCash) || 0) + (Number(l.highTicketCash) || 0);
              }, 0);
              return (
                <div key={stage.id} className="flex-1" style={{ minWidth: '198px' }}>
                  <div className="flex items-center justify-between mb-2 pb-2" style={{ borderBottom: '2px solid ' + stageAccent(stage.id) }}>
                    <span className="text-[11px] font-mono uppercase tracking-wide truncate" style={{ color: 'var(--crm-text-bright)' }}>
                      {stage.short}
                    </span>
                    <span className="text-[11px] font-mono" style={{ color: 'var(--crm-text-muted)' }}>{inStage.length}</span>
                  </div>
                  {stageCash > 0 && (
                    <p className="text-[10px] font-mono mb-2" style={{ color: '#22c55e' }}>{formatCurrency(stageCash)}</p>
                  )}
                  <div className="space-y-2">
                    {inStage.map(renderCard)}
                    {inStage.length === 0 && (
                      <button
                        onClick={function() { openNew(community.id, stage.id); }}
                        className="w-full rounded-xl py-3 text-[11px] font-mono transition-colors hover:bg-white/[0.02]"
                        style={{ border: '1px dashed var(--crm-divider)', color: 'var(--crm-text-muted)' }}
                      >
                        + add here
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  function field(label, key, opts) {
    var o = opts || {};
    return (
      <div>
        <label className="text-[10px] font-mono uppercase block mb-1" style={{ color: 'var(--crm-text-muted)' }}>{label}</label>
        {o.textarea ? (
          <textarea
            className="input-field w-full text-sm"
            rows={2}
            value={form[key]}
            onChange={function(e) { var n = Object.assign({}, form); n[key] = e.target.value; setForm(n); }}
          />
        ) : (
          <input
            className="input-field w-full text-sm"
            type={o.type || 'text'}
            placeholder={o.placeholder || ''}
            value={form[key]}
            onChange={function(e) { var n = Object.assign({}, form); n[key] = e.target.value; setForm(n); }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="page-header py-4 md:py-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-display font-bold flex items-center gap-2" style={{ color: 'var(--crm-text-bright)' }}>
              <GraduationCap className="w-5 h-5" /> Skool Community
            </h1>
            <p className="text-xs font-mono" style={{ color: 'var(--crm-text-muted)' }}>
              {overall.leads} in the pipeline · {formatCurrency(overall.cash)} collected
            </p>
          </div>
          <button onClick={function() { openNew('free', DEFAULT_STAGE); }} className="btn-primary flex items-center gap-2 text-sm self-start">
            <Plus className="w-4 h-4" /> Add lead
          </button>
        </div>
      </header>

      <div className="px-4 md:px-8 pb-8 space-y-5">

        {error && (
          <div className="glass-card p-3" style={{ borderColor: 'rgba(239,68,68,0.3)' }}>
            <p className="text-xs font-mono" style={{ color: '#ef4444' }}>{error}</p>
          </div>
        )}

        {/* ===== HEADLINE ===== */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <div className="glass-card p-5">
            <p className="text-[10px] font-mono uppercase tracking-[0.15em] mb-1" style={{ color: 'var(--crm-text-muted)' }}>Total collected</p>
            <p className="text-3xl font-display font-bold leading-none" style={{ color: '#22c55e' }}>{formatCurrency(overall.cash)}</p>
            <p className="text-[11px] font-mono mt-1.5" style={{ color: 'var(--crm-text-muted)' }}>both communities</p>
          </div>
          <div className="glass-card p-5">
            <p className="text-[10px] font-mono uppercase tracking-[0.15em] mb-1" style={{ color: 'var(--crm-text-muted)' }}>Community cash</p>
            <p className="text-3xl font-display font-bold leading-none" style={{ color: 'var(--crm-text-bright)' }}>{formatCurrency(overall.communityCash)}</p>
            <p className="text-[11px] font-mono mt-1.5" style={{ color: 'var(--crm-text-muted)' }}>from paid-group upgrades</p>
          </div>
          <div className="glass-card p-5">
            <p className="text-[10px] font-mono uppercase tracking-[0.15em] mb-1" style={{ color: 'var(--crm-text-muted)' }}>High ticket</p>
            <p className="text-3xl font-display font-bold leading-none" style={{ color: 'var(--crm-text-bright)' }}>{formatCurrency(overall.highTicketCash)}</p>
            <p className="text-[11px] font-mono mt-1.5" style={{ color: 'var(--crm-text-muted)' }}>from closing calls</p>
          </div>
          <div className="glass-card p-5">
            <p className="text-[10px] font-mono uppercase tracking-[0.15em] mb-1" style={{ color: 'var(--crm-text-muted)' }}>Moved up</p>
            <div className="flex items-end gap-1.5">
              <p className="text-3xl font-display font-bold leading-none" style={{ color: 'var(--crm-text-bright)' }}>{overall.upgrades}</p>
              {overall.upgrades > 0 && <ArrowUpRight className="w-4 h-4 mb-0.5" style={{ color: '#22c55e' }} />}
            </div>
            <p className="text-[11px] font-mono mt-1.5" style={{ color: 'var(--crm-text-muted)' }}>
              free → paid · {overall.booked} booked · {overall.closed} closed
            </p>
          </div>
        </div>

        {/* ===== SETTER SCOREBOARD ===== */}
        {setters.length > 0 && (
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-display font-bold flex items-center gap-2" style={{ color: 'var(--crm-text-bright)' }}>
                <Users className="w-4 h-4" style={{ color: 'var(--crm-accent)' }} /> Setters
              </h3>
              {filterSetter && (
                <button onClick={function() { setFilterSetter(''); }} className="text-[11px] font-mono" style={{ color: 'var(--crm-accent)' }}>
                  Show everyone
                </button>
              )}
            </div>
            <div className="space-y-2.5">
              {setters.map(function(s, i) {
                var pct = setterPeak > 0 ? Math.round((s.cash / setterPeak) * 100) : 0;
                var active = filterSetter === s.name;
                return (
                  <button key={s.name} onClick={function() { setFilterSetter(active ? '' : s.name); }} className="w-full text-left">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-display font-medium" style={{ color: active ? 'var(--crm-accent)' : 'var(--crm-text-bright)' }}>
                        {s.name}
                      </span>
                      {i === 0 && s.cash > 0 && (
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e' }}>top</span>
                      )}
                      <span className="text-[10px] font-mono" style={{ color: 'var(--crm-text-muted)' }}>
                        {s.leads} leads · {s.upgrades} moved up · {s.booked} booked · {s.closed} closed
                      </span>
                      <span className="ml-auto text-xs font-mono font-bold" style={{ color: '#22c55e' }}>{formatCurrency(s.cash)}</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(var(--accent-rgb),0.08)' }}>
                      <div className="h-full transition-all duration-700"
                        style={{ width: pct + '%', borderRadius: '4px', background: active ? 'var(--crm-accent-glow)' : 'var(--crm-accent)', opacity: active ? 1 : 0.7 }} />
                    </div>
                    <p className="text-[10px] font-mono mt-1" style={{ color: 'var(--crm-text-muted)' }}>
                      community {formatCurrency(s.communityCash)} · high ticket {formatCurrency(s.highTicketCash)}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ===== SEARCH ===== */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--crm-text-muted)' }} />
            <input
              value={search}
              onChange={function(e) { setSearch(e.target.value); }}
              placeholder="Search name, handle, notes"
              className="input-field text-sm"
              style={{ paddingLeft: '36px' }}
            />
          </div>
          {(filterSetter || search) && (
            <span className="text-[11px] font-mono" style={{ color: 'var(--crm-text-muted)' }}>
              showing {visible.length} of {leads.length}
            </span>
          )}
        </div>

        {/* ===== THE TWO COMMUNITIES ===== */}
        {loading ? (
          <p className="text-sm font-mono py-8 text-center" style={{ color: 'var(--crm-text-muted)' }}>Loading…</p>
        ) : (
          <div className="space-y-5">
            {SKOOL_COMMUNITIES.map(renderSection)}
          </div>
        )}
      </div>

      {/* ===== EDITOR ===== */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-start md:items-center justify-center p-4 overflow-y-auto"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={function() { if (!saving) setEditing(null); }}>
          <div className="glass-card w-full max-w-2xl my-8" onClick={function(e) { e.stopPropagation(); }}>
            <div className="flex items-center justify-between p-4 md:p-5" style={{ borderBottom: '0.5px solid var(--crm-divider)' }}>
              <h3 className="text-base font-display font-bold" style={{ color: 'var(--crm-text-bright)' }}>
                {editing === 'new' ? 'Add a lead' : 'Edit lead'}
              </h3>
              <button onClick={function() { setEditing(null); }} className="p-2 rounded-lg hover:bg-white/5">
                <X className="w-4 h-4" style={{ color: 'var(--crm-text-muted)' }} />
              </button>
            </div>

            <div className="p-4 md:p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {field('Name', 'name', { placeholder: 'Who are you working?' })}
                {field('Skool handle', 'handle', { placeholder: '@username' })}
                {field('Email', 'email', { type: 'email' })}
                {field('Phone', 'phone')}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-mono uppercase block mb-1" style={{ color: 'var(--crm-text-muted)' }}>Community</label>
                  <select className="input-field w-full text-sm" value={form.community}
                    onChange={function(e) { setForm(Object.assign({}, form, { community: e.target.value })); }}>
                    {SKOOL_COMMUNITIES.map(function(c) { return <option key={c.id} value={c.id}>{c.label}</option>; })}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-mono uppercase block mb-1" style={{ color: 'var(--crm-text-muted)' }}>Stage</label>
                  <select className="input-field w-full text-sm" value={form.stage}
                    onChange={function(e) { setForm(Object.assign({}, form, { stage: e.target.value })); }}>
                    {SKOOL_STAGES.map(function(s) { return <option key={s.id} value={s.id}>{s.label}</option>; })}
                  </select>
                </div>
              </div>

              {form.stage === 'paid-community' && (
                <p className="text-[11px] font-mono" style={{ color: '#22c55e' }}>
                  Marking someone a paid member moves them into the Paid Community section and counts as a move-up.
                </p>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {field('Setter', 'setter')}
                {field('Closer', 'closer', { placeholder: 'Who takes the call' })}
                {field('Booked for', 'bookedFor', { placeholder: 'Tue 2:30pm' })}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {field('Community cash ($)', 'communityCash', { placeholder: 'Paid-group subscription' })}
                {field('High-ticket cash ($)', 'highTicketCash', { placeholder: 'Closed on a call' })}
              </div>

              {field('Offer', 'offer', { placeholder: 'What they bought / are being offered' })}
              {field('Notes', 'notes', { textarea: true })}

              {error && <p className="text-xs font-mono" style={{ color: '#ef4444' }}>{error}</p>}
            </div>

            <div className="flex items-center justify-between gap-3 p-4 md:p-5" style={{ borderTop: '0.5px solid var(--crm-divider)' }}>
              {editing !== 'new' && isAdmin ? (
                <button
                  onClick={function() { setConfirmDelete({ id: editing, label: form.name || 'this lead' }); }}
                  className="flex items-center gap-1.5 text-xs font-mono px-2 py-1 rounded-lg hover:bg-white/5"
                  style={{ color: 'var(--crm-text-muted)' }}
                >
                  <Trash2 className="w-3 h-3" /> Remove
                </button>
              ) : <span />}
              <div className="flex items-center gap-2">
                <button onClick={function() { setEditing(null); }} className="btn-ghost text-sm">Cancel</button>
                <button onClick={save} disabled={saving} className="btn-primary text-sm">
                  {saving ? 'Saving…' : (editing === 'new' ? 'Add lead' : 'Save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Remove this lead?"
        message={confirmDelete ? 'Removes ' + confirmDelete.label + ' from the Skool pipeline. The record is kept in the database and can be restored.' : ''}
        confirmLabel="Remove"
        onConfirm={function() { remove(confirmDelete.id); setEditing(null); }}
        onCancel={function() { setConfirmDelete(null); }}
      />
    </div>
  );
}
