'use client';

import { useState, useEffect, useRef } from 'react';
import {
  GitBranch, Plus, X, GripVertical, Search, AlertCircle, Clock,
  ArrowRight, ArrowLeft, ChevronDown, ChevronRight, UserX, Trash2,
} from 'lucide-react';
import { useWorkspace, withWorkspace, apiFetch, ALL_WORKSPACES } from '@/lib/workspace-client';
import { getUser } from '@/lib/auth';
import { formatCurrency } from '@/lib/utils';
import {
  PIPELINE_STAGES, DEFAULT_STAGE, boardFor, dropStage, stageLabel,
  canMoveFrom, canMove, staleReason, appointmentLabel, computePipelineStats,
} from '@/lib/pipeline';
import ConfirmDialog from '@/components/ConfirmDialog';

var EMPTY = {
  prospectName: '', prospectEmail: '', prospectPhone: '', leadSource: '',
  stage: DEFAULT_STAGE, appointmentAt: '', offer: '', cashCollected: '',
  dealTerms: '', notes: '', setter: '', closer: '',
};

// Which columns a phone opens on. A board with every column expanded is a wall of
// names; a setter opens on the calls they have on the books, a closer on the two
// columns their day is actually spent in.
var MOBILE_OPEN = {
  setter: { booked: true },
  closer: { booked: true, showed: true },
};

export default function PipelinePage() {
  var workspaceId = useWorkspace();
  var [records, setRecords] = useState([]);
  var [stats, setStats] = useState(null);
  var [viewer, setViewer] = useState(null);
  var [unattributed, setUnattributed] = useState([]);
  var [view, setView] = useState('');
  var [loading, setLoading] = useState(true);
  var [error, setError] = useState('');
  var [search, setSearch] = useState('');
  var [repFilter, setRepFilter] = useState('');
  var [staleOnly, setStaleOnly] = useState(false);
  var [openLanes, setOpenLanes] = useState({});
  var [openGroups, setOpenGroups] = useState(null);

  var [detail, setDetail] = useState(null);       // { record, events }
  var [noteDraft, setNoteDraft] = useState('');
  var [sheet, setSheet] = useState(null);         // record awaiting a stage pick
  var [editing, setEditing] = useState(null);     // 'new' | null
  var [form, setForm] = useState(EMPTY);
  var [saving, setSaving] = useState(false);
  var [confirmDelete, setConfirmDelete] = useState(null);

  var [dragging, setDragging] = useState(null);
  var [dropTarget, setDropTarget] = useState('');
  // The drag payload lives outside React state, for the same reason it does on the
  // Skool board: setting state in dragstart re-renders the card mid-drag and the
  // drop handler then closes over a stale null.
  var draggingRef = useRef(null);

  var user = getUser();
  var isOperator = user && user.email === 'shorty21taylor@gmail.com';

  useEffect(function() { if (workspaceId !== null) load(); }, [workspaceId, view]);

  function load() {
    setLoading(true);
    var base = withWorkspace('/api/pipeline', workspaceId);
    if (view) base += (base.indexOf('?') === -1 ? '?' : '&') + 'view=' + view;
    apiFetch(base)
      .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, d: d }; }); })
      .then(function(res) {
        setLoading(false);
        if (!res.ok || res.d.error) { setError(res.d.error || 'Could not load the pipeline'); return; }
        setError('');
        setRecords((res.d.data || []).filter(Boolean));
        setStats(res.d.stats || null);
        setViewer(res.d.viewer || null);
        setUnattributed(res.d.unattributed || []);
        if (!view && res.d.view) setView(res.d.view);
        if (openGroups === null) setOpenGroups(Object.assign({}, MOBILE_OPEN[res.d.view] || MOBILE_OPEN.closer));
      })
      .catch(function(e) { setLoading(false); setError(e.message); });
  }

  var activeView = view || 'closer';
  var board = boardFor(activeView);

  // ---- moving a card ----
  //
  // Optimistic: the card jumps immediately and is put back if the server refuses.
  // The server is the authority on whether a move is allowed — the greyed-out cards
  // below are a courtesy, and the refusal message here is the real answer.
  function move(record, stage, note) {
    if (!record || stage === record.stage) return;

    var relation = record.relation || '';
    var verdict = canMove(relation, record.stage, stage);
    if (!verdict.ok) { setError(verdict.reason); return; }

    var before = records;
    setRecords(records.map(function(r) {
      return r.id === record.id ? Object.assign({}, r, { stage: stage }) : r;
    }));
    setError('');

    var body = { stage: stage };
    if (note) body.moveNote = note;

    apiFetch('/api/pipeline/' + record.id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, d: d }; }); })
      .then(function(res) {
        if (!res.ok || res.d.error) {
          setRecords(before);
          setError(res.d.error || 'Could not move that card');
          return;
        }
        if (detail && detail.record && detail.record.id === record.id) {
          setDetail({ record: res.d.record, events: res.d.events || [] });
        }
        load();
      })
      .catch(function(e) { setRecords(before); setError(e.message); });
  }

  function onDragStart(record) {
    return function(e) {
      if (!canMoveFrom(record.relation, record.stage)) { e.preventDefault(); return; }
      draggingRef.current = record;
      try {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', record.id);
      } catch (err) { /* the ref still carries the payload */ }
      setTimeout(function() { setDragging(record); }, 0);
    };
  }

  function endDrag() {
    draggingRef.current = null;
    setDragging(null);
    setDropTarget('');
  }

  function onDropInto(stage) {
    return function(e) {
      e.preventDefault();
      var id = '';
      try { id = e.dataTransfer.getData('text/plain'); } catch (err) { id = ''; }
      var record = id ? (records.filter(function(r) { return r.id === id; })[0] || null) : null;
      if (!record) record = draggingRef.current;
      endDrag();
      if (!record) return;
      move(record, stage);
    };
  }

  // ---- the detail drawer ----

  function openDetail(record) {
    setNoteDraft('');
    setDetail({ record: record, events: [] });
    apiFetch('/api/pipeline/' + record.id)
      .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, d: d }; }); })
      .then(function(res) {
        if (!res.ok || res.d.error) return;
        setDetail({ record: res.d.record, events: res.d.events || [] });
      })
      .catch(function() { /* the card we already have is enough to show */ });
  }

  function appendNote() {
    if (!detail || !noteDraft.trim()) return;
    var record = detail.record;
    var stamp = new Date().toLocaleString();
    var who = (viewer && viewer.name) || 'Someone';
    var appended = (record.notes ? record.notes + '\n\n' : '') + '[' + stamp + ' · ' + who + '] ' + noteDraft.trim();
    setSaving(true);
    apiFetch('/api/pipeline/' + record.id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: appended }),
    })
      .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, d: d }; }); })
      .then(function(res) {
        setSaving(false);
        if (!res.ok || res.d.error) { setError(res.d.error || 'Could not save that note'); return; }
        setNoteDraft('');
        setDetail({ record: res.d.record, events: res.d.events || [] });
        load();
      })
      .catch(function(e) { setSaving(false); setError(e.message); });
  }

  function saveNew() {
    if (!form.prospectName.trim()) { setError('A prospect name is required'); return; }
    setSaving(true);
    var body = Object.assign({}, form);
    if (!workspaceId || workspaceId === ALL_WORKSPACES) delete body.workspaceId;
    apiFetch('/api/pipeline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, d: d }; }); })
      .then(function(res) {
        setSaving(false);
        if (!res.ok || res.d.error) { setError(res.d.error || 'Could not save'); return; }
        setEditing(null);
        setForm(EMPTY);
        load();
      })
      .catch(function(e) { setSaving(false); setError(e.message); });
  }

  function remove(id) {
    apiFetch('/api/pipeline/' + id, { method: 'DELETE' })
      .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, d: d }; }); })
      .then(function(res) {
        setConfirmDelete(null);
        setDetail(null);
        if (!res.ok || res.d.error) { setError(res.d.error || 'Could not remove that record'); return; }
        load();
      })
      .catch(function(e) { setConfirmDelete(null); setError(e.message); });
  }

  // ---- what the board shows ----

  var term = search.toLowerCase().trim();
  var visible = records.filter(function(r) {
    if (staleOnly && !staleReason(r)) return false;
    if (repFilter) {
      var reps = ((r.setter || '') + ' ' + (r.closer || '')).toLowerCase();
      if (reps.indexOf(repFilter.toLowerCase()) === -1) return false;
    }
    if (term) {
      var hay = ((r.prospectName || '') + ' ' + (r.prospectEmail || '') + ' ' + (r.prospectPhone || '')
        + ' ' + (r.leadSource || '') + ' ' + (r.notes || '')).toLowerCase();
      if (hay.indexOf(term) === -1) return false;
    }
    return true;
  });

  function inColumn(column) {
    return visible.filter(function(r) { return column.stages.indexOf(r.stage) !== -1; });
  }

  var shown = stats || computePipelineStats(visible, activeView);
  var staleCount = visible.filter(function(r) { return !!staleReason(r); }).length;

  // Every rep on the board, for the manager's filter.
  var repNames = {};
  records.forEach(function(r) {
    if (r.setter) repNames[r.setter] = true;
    if (r.closer) repNames[r.closer] = true;
  });
  var reps = Object.keys(repNames).sort();

  // ---- the card ----

  function renderCard(record) {
    var stale = staleReason(record);
    var movable = canMoveFrom(record.relation, record.stage);
    var isDragging = dragging && dragging.id === record.id;
    var won = record.stage === 'won';
    var other = activeView === 'setter' ? record.closer : record.setter;
    var cash = Number(record.cashCollected) || 0;

    return (
      <div
        key={record.id}
        draggable={movable}
        onDragStart={onDragStart(record)}
        onDragEnd={endDrag}
        className={'glass-surface rounded-xl p-3 space-y-2 skool-card'
          + (won ? ' skool-card-won' : '')
          + (isDragging ? ' skool-card-dragging' : '')
          + (movable ? '' : ' pipe-card-locked')}
        title={movable ? '' : 'This card is not yours to move'}
      >
        <button onClick={function() { openDetail(record); }} className="w-full text-left">
          <div className="flex items-start gap-1.5">
            {movable
              ? <GripVertical className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: 'var(--crm-text-muted)', opacity: 0.5 }} />
              : <span className="w-3.5 flex-shrink-0" />}
            <p className="text-sm font-display font-semibold truncate flex-1" style={{ color: 'var(--crm-text-bright)' }}>
              {record.prospectName || 'Unnamed'}
            </p>
            {stale && (
              <span className="pipe-dot" title={stale} aria-label={stale} />
            )}
          </div>

          {record.appointmentAt && (
            <p className="text-[11px] font-mono pl-5 flex items-center gap-1" style={{ color: 'var(--crm-text-muted)' }}>
              <Clock className="w-3 h-3" /> {appointmentLabel(record.appointmentAt)}
            </p>
          )}

          <div className="flex items-center gap-2 mt-1.5 flex-wrap pl-5">
            {other && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded flex items-center gap-1"
                style={{ background: 'rgba(var(--accent-rgb),0.10)', color: 'var(--crm-text-muted)' }}>
                {activeView === 'setter'
                  ? <ArrowRight className="w-2.5 h-2.5" />
                  : <ArrowLeft className="w-2.5 h-2.5" />}
                {other}
              </span>
            )}
            {record.leadSource && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                style={{ border: '1px solid var(--crm-divider)', color: 'var(--crm-text-muted)' }}>
                {record.leadSource}
              </span>
            )}
          </div>

          {won && (cash > 0 || record.offer) && (
            <p className="text-[11px] font-mono font-bold mt-1 pl-5" style={{ color: '#22c55e' }}>
              {cash > 0 ? formatCurrency(cash) : ''}{cash > 0 && record.offer ? ' · ' : ''}
              <span style={{ color: 'var(--crm-text-muted)', fontWeight: 400 }}>{record.offer || ''}</span>
            </p>
          )}

          {stale && (
            <p className="text-[10px] font-mono mt-1 pl-5" style={{ color: '#f59e0b' }}>{stale}</p>
          )}
        </button>

        {/* A select as well as the drag, so the board works on a touch screen. */}
        {movable && (
          <select
            value={record.stage}
            onChange={function(e) { move(record, e.target.value); }}
            className="input-field w-full"
            style={{ fontSize: '11px', padding: '4px 8px' }}
          >
            {PIPELINE_STAGES.map(function(s) {
              var allowed = canMove(record.relation, record.stage, s.id).ok || s.id === record.stage;
              return <option key={s.id} value={s.id} disabled={!allowed}>{s.label}</option>;
            })}
          </select>
        )}
      </div>
    );
  }

  // ---- the desktop board ----

  function renderColumn(column) {
    var rows = inColumn(column);
    var isTarget = dropTarget === column.id;
    var railClass = column.won ? 'stage-rail-green' : (column.lost ? 'stage-rail-red' : 'stage-rail-accent');
    var dropClass = column.won ? ' skool-col-drop-green' : (column.lost ? ' skool-col-drop-red' : ' skool-col-drop');
    var cash = rows.reduce(function(sum, r) { return sum + (Number(r.cashCollected) || 0); }, 0);

    return (
      <div
        key={column.id}
        className={'flex-1 p-2 skool-col' + (isTarget ? dropClass : '')}
        style={{ minWidth: '206px' }}
        onDragOver={function(e) { e.preventDefault(); if (dropTarget !== column.id) setDropTarget(column.id); }}
        onDragLeave={function() { if (dropTarget === column.id) setDropTarget(''); }}
        onDrop={onDropInto(dropStage(column))}
      >
        <div className="flex items-center justify-between mb-1.5 px-1">
          <span className="text-[11px] font-mono uppercase tracking-wide truncate" style={{ color: 'var(--crm-text-bright)' }}>
            {column.label}
          </span>
          <span className="text-[11px] font-mono px-1.5 rounded"
            style={{ background: 'rgba(var(--accent-rgb),0.10)', color: 'var(--crm-text-muted)' }}>
            {rows.length}
          </span>
        </div>
        <div className={'stage-rail ' + railClass} />
        <p className="text-[10px] font-mono mt-1.5 mb-1 px-1 h-3" style={{ color: '#22c55e' }}>
          {cash > 0 ? formatCurrency(cash) : ''}
        </p>
        <div className="space-y-2 skool-stack pr-1" style={{ maxHeight: '520px' }}>
          {rows.map(renderCard)}
          {!rows.length && (
            <p className="text-[11px] font-mono text-center py-4" style={{ color: 'var(--crm-text-muted)', opacity: 0.6 }}>
              {isTarget ? 'drop here' : 'nothing here'}
            </p>
          )}
        </div>
      </div>
    );
  }

  // ---- the mobile list ----
  //
  // A kanban board on a phone is a 6-column horizontal scroll nobody can use, so
  // below lg the same records are a list grouped by column with a sticky header.

  function renderMobileGroup(column) {
    var rows = inColumn(column);
    var open = openGroups ? !!openGroups[column.id] : false;
    return (
      <div key={column.id} className="pipe-group">
        <button
          className="pipe-group-head"
          onClick={function() {
            var next = Object.assign({}, openGroups);
            next[column.id] = !open;
            setOpenGroups(next);
          }}
        >
          {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          <span className="flex-1 text-left">{column.label}</span>
          <span className="text-[11px] font-mono px-1.5 rounded"
            style={{ background: 'rgba(var(--accent-rgb),0.10)', color: 'var(--crm-text-muted)' }}>
            {rows.length}
          </span>
        </button>
        {open && (
          <div className="space-y-2 p-2">
            {rows.map(function(r) { return renderMobileRow(r); })}
            {!rows.length && (
              <p className="text-[11px] font-mono py-2 px-1" style={{ color: 'var(--crm-text-muted)', opacity: 0.6 }}>
                nothing here
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  function renderMobileRow(record) {
    var stale = staleReason(record);
    var movable = canMoveFrom(record.relation, record.stage);
    var other = activeView === 'setter' ? record.closer : record.setter;
    return (
      <div key={record.id} className="glass-surface rounded-xl p-3 flex items-start gap-2">
        <button className="flex-1 text-left min-w-0" onClick={function() { openDetail(record); }}>
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-display font-semibold truncate" style={{ color: 'var(--crm-text-bright)' }}>
              {record.prospectName || 'Unnamed'}
            </p>
            {stale && <span className="pipe-dot" aria-label={stale} />}
          </div>
          {record.appointmentAt && (
            <p className="text-[11px] font-mono mt-0.5" style={{ color: 'var(--crm-text-muted)' }}>
              {appointmentLabel(record.appointmentAt)}
            </p>
          )}
          <p className="text-[10px] font-mono mt-0.5" style={{ color: 'var(--crm-text-muted)' }}>
            {stageLabel(record.stage)}{other ? ' · ' + (activeView === 'setter' ? '→ ' : '← ') + other : ''}
          </p>
        </button>
        {movable && (
          <button className="btn-ghost text-[11px] flex-shrink-0" onClick={function() { setSheet(record); }}>
            Move
          </button>
        )}
      </div>
    );
  }

  var laneList = board.lanes;

  return (
    <div className="min-h-screen">
      <header className="page-header py-4 md:py-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-display font-bold flex items-center gap-2.5" style={{ color: 'var(--crm-text-bright)' }}>
              <span className="icon-box-accent" style={{ width: '34px', height: '34px' }}>
                <GitBranch className="w-4 h-4 text-crm-accent" />
              </span>
              {activeView === 'setter' ? 'Setter pipeline' : 'Closer pipeline'}
            </h1>
            <p className="text-xs font-mono" style={{ color: 'var(--crm-text-muted)' }}>
              {activeView === 'setter'
                ? 'Every lead you are working, through to whether it closed'
                : 'Every appointment on your calendar, booked through won'}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {viewer && viewer.senior && (
              <div className="pipe-toggle">
                <button
                  className={activeView === 'setter' ? 'active' : ''}
                  onClick={function() { setOpenGroups(Object.assign({}, MOBILE_OPEN.setter)); setView('setter'); }}
                >Setter</button>
                <button
                  className={activeView === 'closer' ? 'active' : ''}
                  onClick={function() { setOpenGroups(Object.assign({}, MOBILE_OPEN.closer)); setView('closer'); }}
                >Closer</button>
              </div>
            )}
            <button onClick={function() { setError(''); setForm(EMPTY); setEditing('new'); }} className="btn-primary flex items-center gap-2 text-sm">
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>
        </div>
      </header>

      <div className="px-4 md:px-8 pb-8 space-y-4">
        {error && (
          <div className="glass-card p-3" style={{ borderColor: 'rgba(239,68,68,0.3)' }}>
            <p className="text-xs font-mono" style={{ color: '#ef4444' }}>{error}</p>
          </div>
        )}

        {/* ===== BOARD HEADER ===== */}
        <div className="glass-card p-4 md:p-5 space-y-3">
          <div className="flex items-center gap-4 flex-wrap">
            {(shown.headline || []).map(function(h) {
              return (
                <div key={h.label}>
                  <p className="text-[10px] font-mono uppercase tracking-[0.15em]" style={{ color: 'var(--crm-text-muted)' }}>{h.label}</p>
                  <p className="text-2xl font-display font-bold leading-none" style={{ color: 'var(--crm-text-bright)' }}>{h.value}</p>
                </div>
              );
            })}
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.15em]" style={{ color: 'var(--crm-text-muted)' }}>Won cash</p>
              <p className="text-2xl font-display font-bold leading-none" style={{ color: '#22c55e' }}>{formatCurrency(shown.wonCash || 0)}</p>
            </div>

            <div className="flex-1" />

            {staleCount > 0 && (
              <button
                onClick={function() { setStaleOnly(!staleOnly); }}
                className={'pipe-attention' + (staleOnly ? ' active' : '')}
              >
                <AlertCircle className="w-3.5 h-3.5" />
                {staleCount} need attention
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1" style={{ minWidth: '160px' }}>
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--crm-text-muted)' }} />
              <input
                className="input-field w-full text-sm"
                style={{ paddingLeft: '30px' }}
                placeholder="Search prospects…"
                value={search}
                onChange={function(e) { setSearch(e.target.value); }}
              />
            </div>
            {viewer && viewer.senior && reps.length > 0 && (
              <select className="input-field text-sm" value={repFilter} onChange={function(e) { setRepFilter(e.target.value); }}>
                <option value="">Every rep</option>
                {reps.map(function(n) { return <option key={n} value={n}>{n}</option>; })}
              </select>
            )}
          </div>

          {/* Per-column counts, so the shape of the pipeline reads at a glance. */}
          <div className="flex items-center gap-3 flex-wrap">
            {board.columns.map(function(c) {
              return (
                <span key={c.id} className="text-[11px] font-mono" style={{ color: 'var(--crm-text-muted)' }}>
                  {c.label} <strong style={{ color: 'var(--crm-text-bright)' }}>{inColumn(c).length}</strong>
                </span>
              );
            })}
          </div>
        </div>

        {/* ===== UNATTRIBUTED TRAY (managers) ===== */}
        {viewer && viewer.senior && unattributed.length > 0 && (
          <div className="glass-card p-4" style={{ borderColor: 'rgba(245,158,11,0.3)' }}>
            <p className="text-xs font-display font-bold flex items-center gap-2 mb-2" style={{ color: '#f59e0b' }}>
              <UserX className="w-3.5 h-3.5" /> Unattributed · {unattributed.length}
            </p>
            <p className="text-[11px] font-mono mb-3" style={{ color: 'var(--crm-text-muted)' }}>
              Bookings that arrived without a setter we could resolve. They are on the board, not lost —
              open one and set the setter.
            </p>
            <div className="flex gap-2 flex-wrap">
              {unattributed.slice(0, 12).map(function(r) {
                return (
                  <button key={r.id} onClick={function() { openDetail(r); }}
                    className="text-[11px] font-mono px-2 py-1 rounded"
                    style={{ border: '1px solid var(--crm-divider)', color: 'var(--crm-text-bright)' }}>
                    {r.prospectName || 'Unnamed'}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {loading && (
          <div className="glass-card p-8 text-center">
            <p className="text-xs font-mono" style={{ color: 'var(--crm-text-muted)' }}>Loading the pipeline…</p>
          </div>
        )}

        {!loading && !records.length && (
          <div className="glass-card p-8 text-center space-y-2">
            <p className="text-sm font-display font-bold" style={{ color: 'var(--crm-text-bright)' }}>Nothing here yet</p>
            <p className="text-xs font-mono" style={{ color: 'var(--crm-text-muted)' }}>
              Cards appear as calls are booked — from the Book a Call form, from the hosted forms, or from GoHighLevel.
            </p>
          </div>
        )}

        {!loading && records.length > 0 && (
          <>
            {/* ===== DESKTOP BOARD ===== */}
            <div className="glass-card overflow-hidden hidden lg:block">
              <div className="table-scroll p-4 md:p-5">
                <div className="flex gap-3" style={{ minWidth: (board.columns.length * 218) + 'px' }}>
                  {board.columns.map(renderColumn)}
                </div>
              </div>
            </div>

            {/* ===== MOBILE LIST ===== */}
            <div className="lg:hidden space-y-2">
              {board.columns.map(renderMobileGroup)}
            </div>

            {/* ===== SIDE LANES ===== */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {laneList.map(function(lane) {
                var rows = inColumn(lane);
                var open = !!openLanes[lane.id];
                return (
                  <div key={lane.id} className="glass-card overflow-hidden">
                    <button
                      className="pipe-group-head w-full"
                      onClick={function() {
                        var next = Object.assign({}, openLanes);
                        next[lane.id] = !open;
                        setOpenLanes(next);
                      }}
                    >
                      {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      <span className="flex-1 text-left">{lane.label}</span>
                      <span className="text-[11px] font-mono px-1.5 rounded"
                        style={{ background: 'rgba(239,68,68,0.10)', color: 'var(--crm-text-muted)' }}>
                        {rows.length}
                      </span>
                    </button>
                    {open && (
                      <div className="space-y-2 p-3">
                        {rows.map(function(r) { return renderMobileRow(r); })}
                        {!rows.length && (
                          <p className="text-[11px] font-mono" style={{ color: 'var(--crm-text-muted)', opacity: 0.6 }}>nothing here</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ===== DETAIL DRAWER ===== */}
      {detail && (
        <div className="pipe-drawer-scrim" onClick={function() { setDetail(null); }}>
          <div className="pipe-drawer" onClick={function(e) { e.stopPropagation(); }}>
            <div className="flex items-start justify-between gap-3 p-4" style={{ borderBottom: '0.5px solid var(--crm-divider)' }}>
              <div className="min-w-0">
                <h2 className="text-base font-display font-bold truncate" style={{ color: 'var(--crm-text-bright)' }}>
                  {detail.record.prospectName || 'Unnamed'}
                </h2>
                <p className="text-[11px] font-mono" style={{ color: 'var(--crm-text-muted)' }}>
                  {stageLabel(detail.record.stage)}
                  {detail.record.appointmentAt ? ' · ' + appointmentLabel(detail.record.appointmentAt) : ''}
                </p>
              </div>
              <button onClick={function() { setDetail(null); }} className="btn-ghost p-1.5"><X className="w-4 h-4" /></button>
            </div>

            <div className="p-4 space-y-4 pipe-drawer-body">
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['Email', detail.record.prospectEmail],
                  ['Phone', detail.record.prospectPhone],
                  ['Lead source', detail.record.leadSource],
                  ['Setter', detail.record.setter],
                  ['Closer', detail.record.closer],
                  ['Offer', detail.record.offer],
                  ['Cash', Number(detail.record.cashCollected) ? formatCurrency(detail.record.cashCollected) : ''],
                  ['Terms', detail.record.dealTerms],
                ].filter(function(pair) { return !!pair[1]; }).map(function(pair) {
                  return (
                    <div key={pair[0]}>
                      <p className="text-[10px] font-mono uppercase" style={{ color: 'var(--crm-text-muted)' }}>{pair[0]}</p>
                      <p className="text-xs font-display break-words" style={{ color: 'var(--crm-text-bright)' }}>{pair[1]}</p>
                    </div>
                  );
                })}
              </div>

              {canMoveFrom(detail.record.relation, detail.record.stage) ? (
                <div>
                  <p className="text-[10px] font-mono uppercase mb-1" style={{ color: 'var(--crm-text-muted)' }}>Move to</p>
                  <select
                    className="input-field w-full text-sm"
                    value={detail.record.stage}
                    onChange={function(e) { move(detail.record, e.target.value); }}
                  >
                    {PIPELINE_STAGES.map(function(s) {
                      var allowed = canMove(detail.record.relation, detail.record.stage, s.id).ok || s.id === detail.record.stage;
                      return <option key={s.id} value={s.id} disabled={!allowed}>{s.label}</option>;
                    })}
                  </select>
                </div>
              ) : (
                <p className="text-[11px] font-mono" style={{ color: 'var(--crm-text-muted)' }}>
                  {detail.record.relation === 'setter'
                    ? 'This call is with the closer now — you can see the outcome, but it is theirs to move.'
                    : 'This record is read-only for you.'}
                </p>
              )}

              {detail.record.notes && (
                <div>
                  <p className="text-[10px] font-mono uppercase mb-1" style={{ color: 'var(--crm-text-muted)' }}>Notes</p>
                  <pre className="text-xs font-mono whitespace-pre-wrap" style={{ color: 'var(--crm-text-bright)' }}>{detail.record.notes}</pre>
                </div>
              )}

              <div>
                <p className="text-[10px] font-mono uppercase mb-1" style={{ color: 'var(--crm-text-muted)' }}>Add a note</p>
                <textarea
                  className="input-field w-full text-sm" rows={2}
                  value={noteDraft}
                  onChange={function(e) { setNoteDraft(e.target.value); }}
                  placeholder="Appended with your name and the time — nothing is overwritten"
                />
                <button onClick={appendNote} disabled={saving || !noteDraft.trim()} className="btn-ghost text-xs mt-1.5">
                  {saving ? 'Saving…' : 'Append note'}
                </button>
              </div>

              <div>
                <p className="text-[10px] font-mono uppercase mb-2" style={{ color: 'var(--crm-text-muted)' }}>History</p>
                <div className="space-y-2">
                  {(detail.events || []).slice().reverse().map(function(ev) {
                    return (
                      <div key={ev.id} className="pipe-event">
                        <span className="pipe-event-dot" />
                        <div className="min-w-0">
                          <p className="text-[11px] font-mono" style={{ color: 'var(--crm-text-bright)' }}>
                            {ev.fromStage ? stageLabel(ev.fromStage) + ' → ' : ''}{stageLabel(ev.toStage)}
                          </p>
                          <p className="text-[10px] font-mono" style={{ color: 'var(--crm-text-muted)' }}>
                            {(ev.actorName || ev.actorEmail || ev.actorType)} · {new Date(ev.createdAt).toLocaleString()}
                            {ev.note ? ' · ' + ev.note : ''}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  {!(detail.events || []).length && (
                    <p className="text-[11px] font-mono" style={{ color: 'var(--crm-text-muted)', opacity: 0.6 }}>No history yet.</p>
                  )}
                </div>
              </div>

              {isOperator && (
                <button
                  onClick={function() { setConfirmDelete({ id: detail.record.id, label: detail.record.prospectName || 'this record' }); }}
                  className="flex items-center gap-1.5 text-xs font-mono px-2 py-1 rounded-lg hover:bg-white/5"
                  style={{ color: 'var(--crm-text-muted)' }}
                >
                  <Trash2 className="w-3 h-3" /> Remove
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== MOBILE STAGE SHEET ===== */}
      {sheet && (
        <div className="pipe-sheet-scrim" onClick={function() { setSheet(null); }}>
          <div className="pipe-sheet" onClick={function(e) { e.stopPropagation(); }}>
            <p className="text-xs font-display font-bold px-4 pt-4 pb-2" style={{ color: 'var(--crm-text-bright)' }}>
              Move {sheet.prospectName || 'this card'}
            </p>
            <div className="pb-2">
              {PIPELINE_STAGES.filter(function(s) {
                return canMove(sheet.relation, sheet.stage, s.id).ok;
              }).map(function(s) {
                return (
                  <button
                    key={s.id}
                    className={'pipe-sheet-row' + (s.id === sheet.stage ? ' current' : '')}
                    onClick={function() { move(sheet, s.id); setSheet(null); }}
                  >
                    {s.label}{s.id === sheet.stage ? ' · now' : ''}
                  </button>
                );
              })}
            </div>
            <button className="pipe-sheet-row cancel" onClick={function() { setSheet(null); }}>Cancel</button>
          </div>
        </div>
      )}

      {/* ===== NEW CARD ===== */}
      {editing && (
        <div className="pipe-drawer-scrim" onClick={function() { setEditing(null); }}>
          <div className="pipe-drawer" onClick={function(e) { e.stopPropagation(); }}>
            <div className="flex items-center justify-between p-4" style={{ borderBottom: '0.5px solid var(--crm-divider)' }}>
              <h2 className="text-base font-display font-bold" style={{ color: 'var(--crm-text-bright)' }}>Add to the pipeline</h2>
              <button onClick={function() { setEditing(null); }} className="btn-ghost p-1.5"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-4 space-y-3 pipe-drawer-body">
              {[
                ['Prospect name', 'prospectName', 'Who are you working?'],
                ['Email', 'prospectEmail', ''],
                ['Phone', 'prospectPhone', ''],
                ['Lead source', 'leadSource', 'inbound / outbound / referral'],
              ].map(function(f) {
                return (
                  <div key={f[1]}>
                    <label className="text-[10px] font-mono uppercase block mb-1" style={{ color: 'var(--crm-text-muted)' }}>{f[0]}</label>
                    <input
                      className="input-field w-full text-sm"
                      placeholder={f[2]}
                      value={form[f[1]]}
                      onChange={function(e) { var n = Object.assign({}, form); n[f[1]] = e.target.value; setForm(n); }}
                    />
                  </div>
                );
              })}
              <div>
                <label className="text-[10px] font-mono uppercase block mb-1" style={{ color: 'var(--crm-text-muted)' }}>Stage</label>
                <select className="input-field w-full text-sm" value={form.stage}
                  onChange={function(e) { setForm(Object.assign({}, form, { stage: e.target.value })); }}>
                  {PIPELINE_STAGES.filter(function(s) {
                    return (viewer && viewer.senior) || canMove('setter', form.stage, s.id).ok || s.id === form.stage;
                  }).map(function(s) { return <option key={s.id} value={s.id}>{s.label}</option>; })}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase block mb-1" style={{ color: 'var(--crm-text-muted)' }}>Notes</label>
                <textarea className="input-field w-full text-sm" rows={2} value={form.notes}
                  onChange={function(e) { setForm(Object.assign({}, form, { notes: e.target.value })); }} />
              </div>
              {error && <p className="text-xs font-mono" style={{ color: '#ef4444' }}>{error}</p>}
            </div>
            <div className="flex items-center justify-end gap-2 p-4" style={{ borderTop: '0.5px solid var(--crm-divider)' }}>
              <button onClick={function() { setEditing(null); }} className="btn-ghost text-sm">Cancel</button>
              <button onClick={saveNew} disabled={saving} className="btn-primary text-sm">{saving ? 'Saving…' : 'Add'}</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Remove this record?"
        message={confirmDelete ? 'Removes ' + confirmDelete.label + ' from the pipeline. The row is kept in the database and can be restored.' : ''}
        confirmLabel="Remove"
        onConfirm={function() { remove(confirmDelete.id); }}
        onCancel={function() { setConfirmDelete(null); }}
      />
    </div>
  );
}
