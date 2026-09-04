'use client';

import { useState, useEffect, useRef } from 'react';
import { GraduationCap, Plus, X, Trash2, Users, ArrowUpRight, Search, GripVertical, Crown, Flame } from 'lucide-react';
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
  var [dragging, setDragging] = useState(null);
  var [dropTarget, setDropTarget] = useState('');
  // The drag payload lives outside React state. Setting state in dragstart
  // re-renders the card mid-drag, and the drop handler then closes over a stale
  // null — which silently swallowed the very first drag after every page load.
  var draggingRef = useRef(null);

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

  // Moving someone along the pipeline is the thing this page exists for, so it works
  // two ways: drag the card, or use the select on it — drag-and-drop does not exist on
  // a touch screen, and a setter on their phone still has to be able to move people.
  //
  // The card jumps to its new column immediately and is put back if the save fails,
  // so a drop feels instant without ever showing a move the server did not accept.
  function moveLead(lead, stage, community) {
    var patch = {};
    if (stage && stage !== lead.stage) patch.stage = stage;
    if (community && community !== lead.community) patch.community = community;
    if (!Object.keys(patch).length) return;

    var before = leads;
    setLeads(leads.map(function(l) {
      return l.id === lead.id ? Object.assign({}, l, patch) : l;
    }));
    setError('');

    apiFetch('/api/skool/' + lead.id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
      .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, d: d }; }); })
      .then(function(res) {
        if (!res.ok || res.d.error) {
          setLeads(before);
          setError(res.d.error || 'Could not move that lead');
          return;
        }
        load();
      })
      .catch(function(e) { setLeads(before); setError(e.message); });
  }

  function onDragStart(lead) {
    return function(e) {
      draggingRef.current = lead;
      try {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', lead.id);
      } catch (err) { /* the ref still carries the payload */ }
      // Deferred so the browser has the drag underway before React repaints the card.
      setTimeout(function() { setDragging(lead); }, 0);
    };
  }

  function endDrag() {
    draggingRef.current = null;
    setDragging(null);
    setDropTarget('');
  }

  function onDropInto(communityId, stageId) {
    return function(e) {
      e.preventDefault();
      // The event's own payload first, the ref as the fallback — never render state.
      var id = '';
      try { id = e.dataTransfer.getData('text/plain'); } catch (err) { id = ''; }
      var lead = null;
      if (id) {
        lead = leads.filter(function(l) { return l.id === id; })[0] || null;
      }
      if (!lead) lead = draggingRef.current;
      endDrag();
      if (!lead) return;
      moveLead(lead, stageId, communityId);
    };
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
    var won = lead.stage === 'closed' || lead.stage === 'paid-community';
    var isDragging = dragging && dragging.id === lead.id;
    return (
      <div
        key={lead.id}
        draggable
        onDragStart={onDragStart(lead)}
        onDragEnd={endDrag}
        className={'glass-surface rounded-xl p-3 space-y-2 skool-card'
          + (won ? ' skool-card-won' : '')
          + (isDragging ? ' skool-card-dragging' : '')}
      >
        <button onClick={function() { openEdit(lead); }} className="w-full text-left">
          <div className="flex items-start gap-1.5">
            <GripVertical className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: 'var(--crm-text-muted)', opacity: 0.5 }} />
            <p className="text-sm font-display font-semibold truncate flex-1" style={{ color: 'var(--crm-text-bright)' }}>
              {lead.name || 'Unnamed'}
            </p>
          </div>
          {lead.handle && (
            <p className="text-[11px] font-mono truncate pl-5" style={{ color: 'var(--crm-text-muted)' }}>{lead.handle}</p>
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
          onChange={function(e) { moveLead(lead, e.target.value, lead.community); }}
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

    var isPaid = community.id === 'paid';
    return (
      <div key={community.id} className={'glass-card overflow-hidden ' + (isPaid ? 'glow-green' : 'glow-accent')}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 p-4 md:p-5"
          style={{ borderBottom: '0.5px solid var(--crm-divider)' }}>
          <div>
            <h2 className="text-base font-display font-bold" style={{ color: 'var(--crm-text-bright)' }}>{community.label}</h2>
            <p className="text-xs font-mono" style={{ color: 'var(--crm-text-muted)' }}>{community.blurb}</p>
            <p className="text-[10px] font-mono mt-0.5" style={{ color: 'var(--crm-text-muted)', opacity: 0.75 }}>
              Drag a card between stages — or across to the other community
            </p>
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
          <div className="flex gap-3" style={{ minWidth: (SKOOL_STAGES.length * 218) + 'px' }}>
            {SKOOL_STAGES.map(function(stage) {
              var inStage = rows.filter(function(l) { return l.stage === stage.id; });
              var stageCash = inStage.reduce(function(sum, l) {
                return sum + (Number(l.communityCash) || 0) + (Number(l.highTicketCash) || 0);
              }, 0);
              var key = community.id + ':' + stage.id;
              var isTarget = dropTarget === key;
              var railClass = stage.won ? 'stage-rail-green' : (stage.lost ? 'stage-rail-red' : 'stage-rail-accent');
              var dropClass = stage.won ? ' skool-col-drop-green' : (stage.lost ? ' skool-col-drop-red' : ' skool-col-drop');

              return (
                <div
                  key={stage.id}
                  className={'flex-1 p-2 skool-col' + (isTarget ? dropClass : '')}
                  style={{ minWidth: '206px' }}
                  onDragOver={function(e) { e.preventDefault(); if (dropTarget !== key) setDropTarget(key); }}
                  onDragLeave={function() { if (dropTarget === key) setDropTarget(''); }}
                  onDrop={onDropInto(community.id, stage.id)}
                >
                  <div className="flex items-center justify-between mb-1.5 px-1">
                    <span className="text-[11px] font-mono uppercase tracking-wide truncate" style={{ color: 'var(--crm-text-bright)' }}>
                      {stage.short}
                    </span>
                    <span className="text-[11px] font-mono px-1.5 rounded"
                      style={{ background: 'rgba(var(--accent-rgb),0.10)', color: 'var(--crm-text-muted)' }}>
                      {inStage.length}
                    </span>
                  </div>
                  <div className={'stage-rail ' + railClass} />
                  <p className="text-[10px] font-mono mt-1.5 mb-1 px-1 h-3" style={{ color: '#22c55e' }}>
                    {stageCash > 0 ? formatCurrency(stageCash) : ''}
                  </p>

                  {/* Its own scroll: a busy stage cannot stretch the board or shove the
                      next pipeline down the page. */}
                  <div className="space-y-2 skool-stack pr-1" style={{ maxHeight: '420px' }}>
                    {inStage.map(renderCard)}
                    <button
                      onClick={function() { openNew(community.id, stage.id); }}
                      className="w-full rounded-xl py-2.5 text-[11px] font-mono transition-colors hover:bg-white/[0.03]"
                      style={{ border: '1px dashed var(--crm-divider)', color: 'var(--crm-text-muted)' }}
                    >
                      {isTarget ? 'drop here' : '+ add here'}
                    </button>
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
            <h1 className="text-xl md:text-2xl font-display font-bold flex items-center gap-2.5" style={{ color: 'var(--crm-text-bright)' }}>
              <span className="icon-box-accent" style={{ width: '34px', height: '34px' }}>
                <GraduationCap className="w-4 h-4 text-crm-accent" />
              </span>
              Skool Community
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
          <div className="glass-card p-5 glow-green">
            <div className="flex items-center gap-2 mb-1">
              <div className="glow-dot-green" />
              <p className="text-[10px] font-mono uppercase tracking-[0.15em]" style={{ color: 'var(--crm-text-muted)' }}>Total collected</p>
            </div>
            <p className="text-3xl font-display font-bold leading-none" style={{ color: '#22c55e', textShadow: '0 0 24px rgba(34,197,94,0.45)' }}>
              {formatCurrency(overall.cash)}
            </p>
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
          <div className={'glass-card p-5' + (overall.upgrades > 0 ? ' glow-accent' : '')}>
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
                      <span className="text-[11px] font-mono w-5 text-center flex-shrink-0"
                        style={{ color: i === 0 ? '#f59e0b' : 'var(--crm-text-muted)' }}>
                        {i === 0 ? '' : '#' + (i + 1)}
                      </span>
                      {i === 0 && s.cash > 0 && <Crown className="w-3.5 h-3.5 -ml-4 flex-shrink-0" style={{ color: '#f59e0b' }} />}
                      <span className="text-xs font-display font-medium" style={{ color: active ? 'var(--crm-accent)' : 'var(--crm-text-bright)' }}>
                        {s.name}
                      </span>
                      {i === 0 && s.cash > 0 && <span className="badge-positive">top setter</span>}
                      {s.upgrades > 0 && (
                        <span className="flex items-center gap-0.5 text-[10px] font-mono" style={{ color: '#f59e0b' }}>
                          <Flame className="w-3 h-3" /> {s.upgrades}
                        </span>
                      )}
                      <span className="text-[10px] font-mono" style={{ color: 'var(--crm-text-muted)' }}>
                        {s.leads} leads · {s.upgrades} moved up · {s.booked} booked · {s.closed} closed
                      </span>
                      <span className="ml-auto text-xs font-mono font-bold" style={{ color: '#22c55e' }}>{formatCurrency(s.cash)}</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(var(--accent-rgb),0.08)' }}>
                      <div className="h-full transition-all duration-700"
                        style={{
                          width: pct + '%',
                          borderRadius: '4px',
                          background: i === 0 && s.cash > 0 ? '#22c55e' : (active ? 'var(--crm-accent-glow)' : 'var(--crm-accent)'),
                          opacity: active || i === 0 ? 1 : 0.7,
                          boxShadow: i === 0 && s.cash > 0
                            ? '0 0 14px rgba(34,197,94,0.5)'
                            : (active ? '0 0 12px rgba(var(--accent-rgb),0.4)' : 'none'),
                        }} />
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
