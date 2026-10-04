'use client';
import { useRouter } from 'next/navigation';

import { useState, useEffect, useCallback } from 'react';
import {
  Users, Search, Clock, Mail, UserMinus, RotateCcw, Archive, PhoneCall,
  PenLine, UserPlus, Target, Check,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import EmptyState from '@/components/EmptyState';
import ConfirmDialog from '@/components/ConfirmDialog';
import { apiFetch, withWorkspace, useWorkspace, useAccess } from '@/lib/workspace-client';
import useRoster from '@/lib/use-roster';

// The roster, and the one place a manager runs it: who is on the floor, what
// each of them has done, and what they have been asked to do this month.
//
// Setting somebody's targets used to be possible only by opening their personal
// dashboard and editing it as them, which is a strange way to do a manager's job
// and is why no rep on the install had a target set.

var ADDABLE_ROLES = [
  { id: 'closer', label: 'Closer' },
  { id: 'setter', label: 'Setter' },
  { id: 'dm-setter', label: 'DM Setter' },
  { id: 'manager', label: 'Manager' },
];

function num(v) { return (v === null || v === undefined) ? '—' : Number(v).toLocaleString('en-US'); }
function money(v) { return (v === null || v === undefined) ? '—' : formatCurrency(v); }
function pct(v) { return (v === null || v === undefined) ? '—' : v + '%'; }

function Tile({ label, value, sub, tone }) {
  return (
    <div className="td-tile">
      <p className={'td-tile-v' + (tone ? ' ' + tone : '')}>{value}</p>
      <p className="td-tile-l">{label}</p>
      {sub ? <p className="td-tile-s">{sub}</p> : null}
    </div>
  );
}

function Section({ title, note, children }) {
  return (
    <div className="td-section">
      <div className="td-section-h">
        <h3 className="td-section-t">{title}</h3>
        <span className="td-section-rule" />
        {note ? <span className="section-tag">{note}</span> : null}
      </div>
      {children}
    </div>
  );
}

// What a manager asked this rep for, and where they are against it. The figures
// come off computeKpiProgress through /api/me — the same ones the rep sees on
// their own page, so a manager and a rep can never read different numbers.
function TargetEditor({ rep, kpis, saving, savedAt, onSave }) {
  var s = useState({}), draft = s[0], setDraft = s[1];
  var rows = (kpis && kpis.kpis) || [];

  useEffect(function() {
    var next = {};
    rows.forEach(function(r) { next[r.key] = r.target === null ? '' : String(r.target); });
    setDraft(next);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rep, kpis]);

  if (!kpis) {
    return <p className="cl-hint">Loading their targets…</p>;
  }

  function set(key, raw) {
    var v = raw.replace(/[^0-9.]/g, '');
    setDraft(function(prev) {
      var next = Object.assign({}, prev);
      next[key] = v;
      return next;
    });
  }

  function save() {
    var targets = {};
    var goal = 0;
    rows.forEach(function(r) {
      var v = parseFloat(draft[r.key]);
      if (!isFinite(v) || v <= 0) return;
      // Cash is the monthly goal the rest of the product already paces against,
      // not a second number that could disagree with it.
      if (r.key === 'cash') { goal = v; return; }
      targets[r.key] = v;
    });
    onSave({ rep: rep, monthlyGoal: goal, kpiTargets: targets });
  }

  return (
    <div className="cl-targets">
      <div className="cl-target-grid">
        {rows.map(function(r) {
          var unit = r.kind === 'money' ? '$' : (r.kind === 'rate' ? '%' : '');
          return (
            <label className="cl-target" key={r.key}>
              <span className="cl-target-l">
                {r.label}{unit ? ' (' + unit + ')' : ''}
              </span>
              <input
                className="input-field"
                value={draft[r.key] === undefined ? '' : draft[r.key]}
                inputMode="decimal"
                placeholder={r.kind === 'rate' ? '30' : (r.kind === 'money' ? '50000' : '20')}
                onChange={function(e) { set(r.key, e.target.value); }}
              />
              <span className="cl-target-now">
                {r.actual === null || r.actual === undefined
                  ? 'nothing filed yet'
                  : 'at ' + (r.kind === 'money' ? money(r.actual) : (r.kind === 'rate' ? pct(r.actual) : num(r.actual)))
                    + (r.target === null ? ' · no target' : (r.onTrack === false ? ' · behind' : ' · on pace'))}
              </span>
            </label>
          );
        })}
      </div>
      <div className="cl-target-foot">
        <button className="an-btn" disabled={saving} onClick={save}>
          {saving ? 'Saving…' : (savedAt ? <><Check size={14} /> Saved</> : 'Save targets')}
        </button>
        <span className="cl-hint">
          {kpis.weekdaysLeft} working {kpis.weekdaysLeft === 1 ? 'day' : 'days'} left this month.
          Leave a box empty to set no target for it — the rep sees &ldquo;no target set&rdquo; rather than nought percent.
        </span>
      </div>
    </div>
  );
}

export default function ClosersPage() {
  var roster = useRoster();
  var workspaceId = useWorkspace();
  var access = useAccess();
  var s1 = useState([]), closers = s1[0], setClosers = s1[1];
  var s2 = useState(true), loading = s2[0], setLoading = s2[1];
  var s3 = useState(''), search = s3[0], setSearch = s3[1];
  var s4 = useState(null), selected = s4[0], setSelected = s4[1];
  var s5 = useState(false), showArchived = s5[0], setShowArchived = s5[1];
  var s6 = useState(null), confirmRemove = s6[0], setConfirmRemove = s6[1];
  var s7 = useState(''), actionError = s7[0], setActionError = s7[1];
  var s8 = useState(false), busy = s8[0], setBusy = s8[1];
  var s9 = useState(''), renaming = s9[0], setRenaming = s9[1];
  var s10 = useState(''), renameTo = s10[0], setRenameTo = s10[1];
  var s11 = useState(false), adding = s11[0], setAdding = s11[1];
  var s12 = useState({ email: '', name: '', role: 'closer' }), newRep = s12[0], setNewRep = s12[1];
  var s13 = useState(null), repKpis = s13[0], setRepKpis = s13[1];
  var s14 = useState(false), savingTargets = s14[0], setSavingTargets = s14[1];
  var s15 = useState(false), savedTargets = s15[0], setSavedTargets = s15[1];

  var router = useRouter();
  // A manager runs their own floor. This was pinned to one hardcoded address, so
  // on any workspace but the first nobody could edit the roster at all.
  var canManage = !!(access && access.canSeeTeam);

  var fetchClosers = useCallback(function() {
    apiFetch(withWorkspace('/api/closers' + (showArchived ? '?includeArchived=1' : ''), workspaceId))
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.success) {
          setClosers(data.closers);
          setSelected(function(prev) {
            if (prev) {
              var fresh = data.closers.filter(function(c) { return c.email === prev.email; })[0];
              return fresh || prev;
            }
            return data.closers[0] || null;
          });
        }
        setLoading(false);
      })
      .catch(function() { setLoading(false); });
  }, [showArchived, workspaceId]);

  useEffect(function() {
    fetchClosers();
    var interval = setInterval(fetchClosers, 30000);
    return function() { clearInterval(interval); };
  }, [fetchClosers]);

  // Their targets and their progress, read as the manager rather than as them.
  useEffect(function() {
    if (!selected || !canManage) { setRepKpis(null); return; }
    setRepKpis(null);
    setSavedTargets(false);
    var cancelled = false;
    apiFetch(withWorkspace('/api/me?rep=' + encodeURIComponent(selected.email), workspaceId))
      .then(function(r) { return r.json(); })
      .then(function(d) { if (!cancelled && d && d.success) setRepKpis(d.kpis || null); })
      .catch(function() {});
    return function() { cancelled = true; };
  }, [selected && selected.email, canManage, workspaceId]);

  function rosterAction(email, action, name) {
    setBusy(true);
    setActionError('');
    apiFetch('/api/closers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, action: action, name: name }),
    })
      .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, d: d }; }); })
      .then(function(res) {
        setBusy(false);
        setConfirmRemove(null);
        if (!res.ok || res.d.error) { setActionError(res.d.error || 'Could not update the roster'); return; }
        if (action === 'rename') {
          setRenaming('');
          if (res.d.closer) setSelected(Object.assign({}, selected, { name: res.d.closer.name }));
        } else if (action === 'setter-exclude' || action === 'setter-include') {
          if (res.d.closer) setSelected(Object.assign({}, selected, { excludedFromSetterBoard: !!res.d.closer.excludedFromSetterBoard }));
        } else if (action === 'archive' && !showArchived) {
          setSelected(null);
        } else if (res.d.closer) {
          setSelected(null);
        }
        fetchClosers();
      })
      .catch(function(e) { setBusy(false); setConfirmRemove(null); setActionError(e.message); });
  }

  function addRep() {
    if (!newRep.email.trim()) return;
    setBusy(true); setActionError('');
    apiFetch(withWorkspace('/api/admin/workspace', workspaceId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'add-member',
        email: newRep.email.trim(),
        name: newRep.name.trim(),
        role: newRep.role,
      }),
    })
      .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, d: d }; }); })
      .then(function(res) {
        setBusy(false);
        if (!res.ok || res.d.error) { setActionError(res.d.error || 'Could not add them'); return; }
        setNewRep({ email: '', name: '', role: 'closer' });
        setAdding(false);
        fetchClosers();
      })
      .catch(function(e) { setBusy(false); setActionError(e.message); });
  }

  function saveTargets(payload) {
    setSavingTargets(true); setActionError(''); setSavedTargets(false);
    apiFetch(withWorkspace('/api/me', workspaceId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, d: d }; }); })
      .then(function(res) {
        setSavingTargets(false);
        if (!res.ok || res.d.error) { setActionError(res.d.error || 'Could not save their targets'); return; }
        setSavedTargets(true);
        // Re-read so the "at X · behind" line reflects what was just set.
        return apiFetch(withWorkspace('/api/me?rep=' + encodeURIComponent(payload.rep), workspaceId))
          .then(function(r) { return r.json(); })
          .then(function(d) { if (d && d.success) setRepKpis(d.kpis || null); });
      })
      .catch(function(e) { setSavingTargets(false); setActionError(e.message); });
  }

  var activeCount = closers.filter(function(c) { return !c.archived; }).length;
  var archivedCount = closers.filter(function(c) { return c.archived; }).length;

  var filtered = closers.filter(function(c) {
    if (!search) return true;
    var q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q);
  });

  return (
    <div className="min-h-screen">
      <header className="page-header">
        <div className="flex items-center justify-between px-4 md:px-8 h-16 gap-3">
          <div className="min-w-0">
            <h1 className="font-display font-bold text-crm-text-bright text-lg tracking-tight">Team</h1>
            <p className="text-[13px] text-crm-text-muted truncate">
              {activeCount} on the roster{archivedCount > 0 ? ' · ' + archivedCount + ' removed' : ''}
            </p>
          </div>
          {canManage ? (
            <div className="flex items-center gap-2 flex-shrink-0">
              <button className="an-chip" onClick={function() { setShowArchived(!showArchived); setSelected(null); }}>
                <Archive className="w-3.5 h-3.5" />
                {showArchived ? 'Hide removed' : 'Show removed'}
              </button>
              <button className="btn-primary cl-add-btn" onClick={function() { setAdding(!adding); }}>
                <UserPlus className="w-3.5 h-3.5" /> Add a rep
              </button>
            </div>
          ) : null}
        </div>
      </header>

      {actionError ? (
        <div className="mx-4 md:mx-8 mt-4 glass-card no-lift p-3">
          <p className="text-[13px]" style={{ color: 'var(--crm-negative)' }}>{actionError}</p>
        </div>
      ) : null}

      {canManage && adding ? (
        <div className="mx-4 md:mx-8 mt-4 glass-card no-lift cl-addrow">
          <label className="an-field">
            <span>Email</span>
            <input value={newRep.email} placeholder="rep@company.com"
              onChange={function(e) { setNewRep(Object.assign({}, newRep, { email: e.target.value })); }} />
          </label>
          <label className="an-field">
            <span>Name</span>
            <input value={newRep.name} placeholder="How they appear on the boards"
              onChange={function(e) { setNewRep(Object.assign({}, newRep, { name: e.target.value })); }} />
          </label>
          <label className="an-field">
            <span>Role</span>
            <select value={newRep.role}
              onChange={function(e) { setNewRep(Object.assign({}, newRep, { role: e.target.value })); }}>
              {ADDABLE_ROLES.map(function(r) { return <option key={r.id} value={r.id}>{r.label}</option>; })}
            </select>
          </label>
          <div className="cl-addrow-go">
            <button className="an-btn" disabled={busy} onClick={addRep}>
              {busy ? 'Adding…' : 'Add to roster'}
            </button>
            <button className="an-btn-ghost" onClick={function() { setAdding(false); }}>Cancel</button>
          </div>
          <p className="cl-hint cl-addrow-note">
            There is no password to invent: their email plus the workspace team password is the whole of it.
            The role decides which KPI set they are measured on.
          </p>
        </div>
      ) : null}

      <div className="cl-body">

        {/* ---- the roster ---- */}
        <div className="cl-list-col">
          <div className="glass-card no-lift overflow-hidden">
            <div className="cl-search">
              <Search className="w-4 h-4 text-crm-text-muted flex-shrink-0" />
              <input value={search} onChange={function(e) { setSearch(e.target.value); }}
                placeholder="Search the roster" aria-label="Search the roster" />
            </div>

            {loading ? (
              <p className="cl-hint p-6 text-center">Loading the roster…</p>
            ) : filtered.length === 0 ? (
              <EmptyState icon={Users} title="Nobody on the roster yet"
                subtitle={canManage ? 'Add a rep and they can file on their next shift.' : 'Reps appear here once a manager adds them.'} />
            ) : (
              <div className="cl-list">
                {filtered.map(function(closer) {
                  var isSelected = selected && selected.email === closer.email;
                  return (
                    <button
                      key={closer.email}
                      type="button"
                      onClick={function() { setSelected(closer); }}
                      className={'cl-row' + (isSelected ? ' on' : '')}
                      style={closer.archived ? { opacity: 0.55 } : {}}
                    >
                      <span className="cl-row-av">{closer.name ? closer.name[0].toUpperCase() : '?'}</span>
                      <span className="cl-row-id">
                        <span className="cl-row-name">
                          {closer.name}
                          {closer.archived ? <em className="cl-row-tag">removed</em> : null}
                        </span>
                        <span className="cl-row-mail">{closer.email}</span>
                      </span>
                      {closer.stats.closedDeals > 0 ? (
                        <span className="cl-row-cash">{money(closer.stats.totalRevenue)}</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ---- the person ---- */}
        <div className="cl-detail-col">
          {!selected ? (
            <div className="glass-card no-lift p-8">
              <p className="text-sm text-crm-text-muted text-center">
                {closers.length === 0
                  ? 'Nobody on the roster yet.'
                  : 'Pick somebody from the roster.'}
              </p>
            </div>
          ) : (
            <div className="space-y-5">

              {/* identity */}
              <div className="glass-card no-lift cl-id">
                <span className="cl-id-av">{selected.name ? selected.name[0].toUpperCase() : '?'}</span>
                <div className="min-w-0 flex-1">
                  <h2 className="cl-id-name">{selected.name}</h2>
                  <p className="cl-id-meta">
                    <Mail className="w-3 h-3" /> {selected.email}
                    <span className="cl-id-dot">·</span>
                    <Clock className="w-3 h-3" /> joined {selected.registeredAt
                      ? new Date(selected.registeredAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : 'unknown'}
                  </p>

                  {(function() {
                    var entry = roster.findByEmail(selected.email);
                    var names = (entry && entry.names) || [];
                    if (names.length) return null;
                    // Nothing on the boards matches this login, which is exactly
                    // why their photo never shows — say so rather than let them guess.
                    return (
                      <p className="cl-warn">No photo will show for this login — nothing on the boards matches it</p>
                    );
                  })()}

                  {selected.archived ? (
                    <p className="cl-hint" style={{ marginTop: '6px' }}>
                      Off the roster{selected.archivedAt ? ' since ' + new Date(selected.archivedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''} — their records still count in every total.
                    </p>
                  ) : null}

                  <div className="cl-id-acts">
                    <button className="an-chip" onClick={function() { router.push('/me?rep=' + encodeURIComponent(selected.email)); }}>
                      Open their dashboard
                    </button>
                    {canManage ? (
                      <button className="an-chip" onClick={function() {
                        setRenaming(renaming === selected.email ? '' : selected.email);
                        setRenameTo(selected.name || '');
                      }}>
                        <PenLine className="w-3 h-3" /> Wrong name?
                      </button>
                    ) : null}
                    {canManage ? (
                      <button className="an-chip" disabled={busy}
                        onClick={function() { rosterAction(selected.email, selected.excludedFromSetterBoard ? 'setter-include' : 'setter-exclude'); }}
                        title="Whether this person is ranked on the setter leaderboard">
                        <PhoneCall className="w-3 h-3" />
                        {selected.excludedFromSetterBoard ? 'Not a setter' : 'Counts as a setter'}
                      </button>
                    ) : null}
                    {canManage ? (
                      selected.archived ? (
                        <button className="an-chip" disabled={busy}
                          onClick={function() { rosterAction(selected.email, 'restore'); }}>
                          <RotateCcw className="w-3 h-3" /> Put back on roster
                        </button>
                      ) : (
                        <button className="an-chip cl-danger" disabled={busy}
                          onClick={function() { setConfirmRemove(selected); }}>
                          <UserMinus className="w-3 h-3" /> Remove from roster
                        </button>
                      )
                    ) : null}
                  </div>

                  {canManage && renaming === selected.email ? (
                    <div className="cl-rename">
                      <span className="cl-target-l">Name on {selected.email}</span>
                      <div className="flex items-center gap-2 flex-wrap mt-2">
                        <input className="input-field" value={renameTo} style={{ maxWidth: '260px' }}
                          onChange={function(e) { setRenameTo(e.target.value); }} />
                        <button className="an-btn" disabled={busy || !renameTo.trim()}
                          onClick={function() { rosterAction(selected.email, 'rename', renameTo.trim()); }}>Save</button>
                        <button className="an-btn-ghost" onClick={function() { setRenaming(''); }}>Cancel</button>
                      </div>
                      <p className="cl-hint" style={{ marginTop: '8px' }}>
                        Their records stay where they are — this only changes the name on the login.
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* what they have done */}
              <div className="dh-band">
                <div className="dh-main">
                  <p className="dh-l">Revenue</p>
                  <p className="dh-fig mt-2">{money(selected.stats.totalRevenue)}</p>
                  <p className="dh-sub">
                    {num(selected.stats.closedDeals)} deal{selected.stats.closedDeals === 1 ? '' : 's'} closed
                    {' · '}{pct(selected.stats.closeRate)} close rate
                  </p>
                </div>
                <div className="dh-side">
                  <div>
                    <p className="dh-l">Dials</p>
                    <p className="dh-sec-fig">{num(selected.stats.totalDials)}</p>
                    <p className="dh-sub" style={{ marginTop: '4px' }}>{num(selected.stats.bookedCalls)} calls booked</p>
                  </div>
                  <div>
                    <p className="dh-l">EODs filed</p>
                    <p className="dh-sec-fig">{num(selected.stats.eodReports)}</p>
                    <p className="dh-sub" style={{ marginTop: '4px' }}>
                      last {selected.lastActivity
                        ? new Date(selected.lastActivity).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                        : 'never'}
                    </p>
                  </div>
                </div>
              </div>

              {/* what they were asked for */}
              {canManage ? (
                <Section title="Their targets this month" note={repKpis ? repKpis.month : ''}>
                  <div className="glass-card no-lift p-5">
                    <TargetEditor
                      rep={selected.email}
                      kpis={repKpis}
                      saving={savingTargets}
                      savedAt={savedTargets}
                      onSave={saveTargets}
                    />
                  </div>
                </Section>
              ) : null}

              {/* today */}
              <Section title="Today" note="live">
                <div className="td-grid">
                  <Tile label="Dials" value={num(selected.today.dials)} />
                  <Tile label="Closes" value={num(selected.today.closes)} />
                  <Tile label="Cash collected" value={money(selected.today.cash)} tone="good" />
                </div>
              </Section>

            </div>
          )}
        </div>

      </div>

      <ConfirmDialog
        open={!!confirmRemove}
        title="Remove from roster?"
        message={confirmRemove
          ? confirmRemove.name + ' comes off the roster and stops counting as a missed EOD every day. '
            + 'Their ' + confirmRemove.stats.closedDeals + ' closed deal' + (confirmRemove.stats.closedDeals === 1 ? '' : 's')
            + ', ' + confirmRemove.stats.eodReports + ' EOD report' + (confirmRemove.stats.eodReports === 1 ? '' : 's')
            + ' and all their cash stay in the CRM and keep counting in every total. You can put them back at any time.'
          : ''}
        confirmLabel="Remove from roster"
        onConfirm={function() { rosterAction(confirmRemove.email, 'archive'); }}
        onCancel={function() { setConfirmRemove(null); }}
      />
    </div>
  );
}
