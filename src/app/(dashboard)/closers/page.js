'use client';

import { useState, useEffect } from 'react';
import { Users, Search, Phone, DollarSign, Target, BarChart3, Clock, Mail, UserMinus, RotateCcw, Archive } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import EmptyState from '@/components/EmptyState';
import ConfirmDialog from '@/components/ConfirmDialog';
import { getUser } from '@/lib/auth';
import { apiFetch } from '@/lib/workspace-client';

export default function ClosersPage() {
  var s1 = useState([]), closers = s1[0], setClosers = s1[1];
  var s2 = useState(true), loading = s2[0], setLoading = s2[1];
  var s3 = useState(''), search = s3[0], setSearch = s3[1];
  var s4 = useState(null), selected = s4[0], setSelected = s4[1];
  var s5 = useState(false), showArchived = s5[0], setShowArchived = s5[1];
  var s6 = useState(null), confirmRemove = s6[0], setConfirmRemove = s6[1];
  var s7 = useState(''), actionError = s7[0], setActionError = s7[1];
  var s8 = useState(false), busy = s8[0], setBusy = s8[1];

  var user = getUser();
  var isAdmin = user && user.email === 'shorty21taylor@gmail.com';

  useEffect(function() {
    fetchClosers();
    var interval = setInterval(fetchClosers, 30000);
    return function() { clearInterval(interval); };
  }, [showArchived]);

  function fetchClosers() {
    // Removed reps are fetched too when the toggle is on, so they can be restored.
    apiFetch('/api/closers' + (showArchived ? '?includeArchived=1' : ''))
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.success) {
          setClosers(data.closers);
          if (!selected && data.closers.length > 0) {
            setSelected(data.closers[0]);
          }
        }
        setLoading(false);
      })
      .catch(function() { setLoading(false); });
  }

  function rosterAction(email, action) {
    setBusy(true);
    setActionError('');
    apiFetch('/api/closers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, action: action }),
    })
      .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, d: d }; }); })
      .then(function(res) {
        setBusy(false);
        setConfirmRemove(null);
        if (!res.ok || res.d.error) {
          setActionError(res.d.error || 'Could not update the roster');
          return;
        }
        // The selected rep may have just left the list being shown.
        if (action === 'archive' && !showArchived) setSelected(null);
        else if (res.d.closer) setSelected(null);
        fetchClosers();
      })
      .catch(function(e) {
        setBusy(false);
        setConfirmRemove(null);
        setActionError(e.message);
      });
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
        <div className="flex items-center justify-between px-8 h-16">
          <div>
            <h1 className="font-display font-bold text-crm-text-bright text-lg tracking-tight">Closers</h1>
            <p className="text-xs text-crm-muted font-mono">{activeCount} team member{activeCount !== 1 ? 's' : ''} on the roster{archivedCount > 0 ? ' · ' + archivedCount + ' removed' : ''}</p>
          </div>
          {isAdmin && (
            <button
              onClick={function() { setShowArchived(!showArchived); setSelected(null); }}
              className={'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ' + (showArchived ? 'text-crm-accent' : 'text-crm-muted hover:text-crm-text')}
              style={showArchived ? { background: 'rgba(var(--accent-rgb),0.1)' } : {}}
            >
              <Archive className="w-3.5 h-3.5" />
              {showArchived ? 'Hide removed' : 'Show removed'}
            </button>
          )}
        </div>
      </header>

      {actionError && (
        <div className="mx-8 mt-4 glass-card p-3" style={{ borderColor: 'rgba(239,68,68,0.3)' }}>
          <p className="text-xs font-mono" style={{ color: '#ef4444' }}>{actionError}</p>
        </div>
      )}

      <div className="flex px-8 py-6 gap-6">

        {/* Left panel — closer list */}
        <div className="w-80 flex-shrink-0">
          <div className="glass-card overflow-hidden">
            {/* Search */}
            <div className="p-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-crm-muted" />
                <input
                  value={search}
                  onChange={function(e) { setSearch(e.target.value); }}
                  placeholder="Search closers..."
                  className="input-field"
                  style={{ paddingLeft: '36px', fontSize: '13px', padding: '8px 12px 8px 36px' }}
                />
              </div>
            </div>

            {/* List */}
            {loading ? (
              <div className="p-8 text-center text-crm-muted text-sm font-mono">Loading...</div>
            ) : filtered.length === 0 ? (
              <EmptyState icon={Users} title="No closers yet" subtitle="Closers appear when team members sign up and submit data" />
            ) : (
              <div className="max-h-[calc(100vh-200px)] overflow-y-auto">
                {filtered.map(function(closer) {
                  var isSelected = selected && selected.email === closer.email;
                  return (
                    <div
                      key={closer.email}
                      onClick={function() { setSelected(closer); }}
                      className={'flex items-center gap-3 px-4 py-3 cursor-pointer transition-all duration-200 ' + (isSelected ? 'bg-crm-accent/10 border-l-2 border-crm-accent' : 'hover:bg-white/[0.02] border-l-2 border-transparent')}
                      style={closer.archived ? { opacity: 0.55 } : {}}
                    >
                      <div className="avatar avatar-md text-crm-accent font-display">
                        {closer.name ? closer.name[0].toUpperCase() : '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-display font-semibold text-crm-text-bright truncate">
                          {closer.name}
                          {closer.archived && (
                            <span className="ml-2 text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--crm-text-muted)' }}>
                              REMOVED
                            </span>
                          )}
                        </p>
                        <p className="text-xs font-mono text-crm-muted truncate">{closer.email}</p>
                      </div>
                      {closer.stats.closedDeals > 0 && (
                        <span className="text-xs font-mono text-crm-positive">{formatCurrency(closer.stats.totalRevenue)}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right panel — closer detail */}
        <div className="flex-1 min-w-0">
          {!selected ? (
            <div className="glass-card p-8">
              <p className="text-sm text-crm-muted text-center">
                {closers.length === 0 ? 'No closers in the system yet. Data will appear when team members join.' : 'Select a closer from the list to view their details.'}
              </p>
            </div>
          ) : (
            <div className="space-y-6">

              {/* Closer header */}
              <div className="glass-card p-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className="avatar avatar-lg text-crm-accent font-display text-xl">
                    {selected.name ? selected.name[0].toUpperCase() : '?'}
                  </div>
                  <div>
                    <h2 className="font-display font-bold text-crm-text-bright text-xl">{selected.name}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      <Mail className="w-3 h-3 text-crm-muted" />
                      <span className="text-xs font-mono text-crm-muted">{selected.email}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Clock className="w-3 h-3 text-crm-muted" />
                      <span className="text-xs font-mono text-crm-muted">
                        Joined {selected.registeredAt ? new Date(selected.registeredAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown'}
                      </span>
                    </div>
                    {selected.archived && (
                      <p className="text-xs font-mono mt-1" style={{ color: 'var(--crm-text-muted)' }}>
                        Removed from the roster{selected.archivedAt ? ' on ' + new Date(selected.archivedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''} — their records are still counted
                      </p>
                    )}
                  </div>

                  {isAdmin && (
                    <div className="ml-auto">
                      {selected.archived ? (
                        <button
                          onClick={function() { rosterAction(selected.email, 'restore'); }}
                          disabled={busy}
                          className="btn-ghost flex items-center gap-2 text-xs"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Put back on roster
                        </button>
                      ) : (
                        <button
                          onClick={function() { setConfirmRemove(selected); }}
                          disabled={busy}
                          className="flex items-center gap-1.5 text-xs font-mono px-2.5 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
                          style={{ color: 'var(--crm-text-muted)' }}
                        >
                          <UserMinus className="w-3.5 h-3.5" /> Remove from roster
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="glass-surface p-3 rounded-xl text-center">
                    <p className="text-lg font-display font-bold text-crm-text-bright">{selected.stats.closedDeals}</p>
                    <p className="text-xs font-mono text-crm-muted mt-0.5">Deals Closed</p>
                  </div>
                  <div className="glass-surface p-3 rounded-xl text-center">
                    <p className="text-lg font-display font-bold text-crm-positive">{formatCurrency(selected.stats.totalRevenue)}</p>
                    <p className="text-xs font-mono text-crm-muted mt-0.5">Total Revenue</p>
                  </div>
                  <div className="glass-surface p-3 rounded-xl text-center">
                    <p className="text-lg font-display font-bold text-crm-text-bright">{selected.stats.totalDials.toLocaleString()}</p>
                    <p className="text-xs font-mono text-crm-muted mt-0.5">Total Dials</p>
                  </div>
                  <div className="glass-surface p-3 rounded-xl text-center">
                    <p className="text-lg font-display font-bold text-crm-text-bright">{selected.stats.closeRate}%</p>
                    <p className="text-xs font-mono text-crm-muted mt-0.5">Close Rate</p>
                  </div>
                </div>
              </div>

              {/* Today's activity */}
              <div className="glass-card overflow-hidden">
                <div className="section-header">
                  <h3><BarChart3 className="w-4 h-4 text-crm-accent" /> Today</h3>
                  <span className="section-tag">Live</span>
                </div>
                <div className="grid grid-cols-3 gap-4 p-5">
                  <div className="glass-surface p-3 rounded-xl text-center">
                    <p className="text-lg font-display font-bold text-crm-text-bright">{selected.today.dials}</p>
                    <p className="text-xs font-mono text-crm-muted mt-0.5">Dials</p>
                  </div>
                  <div className="glass-surface p-3 rounded-xl text-center">
                    <p className="text-lg font-display font-bold text-crm-text-bright">{selected.today.closes}</p>
                    <p className="text-xs font-mono text-crm-muted mt-0.5">Closes</p>
                  </div>
                  <div className="glass-surface p-3 rounded-xl text-center">
                    <p className="text-lg font-display font-bold text-crm-positive">{formatCurrency(selected.today.cash)}</p>
                    <p className="text-xs font-mono text-crm-muted mt-0.5">Cash Collected</p>
                  </div>
                </div>
              </div>

              {/* Activity summary */}
              <div className="glass-card overflow-hidden">
                <div className="section-header">
                  <h3><Target className="w-4 h-4 text-crm-accent" /> Activity Summary</h3>
                </div>
                <div className="p-5 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-crm-muted font-mono">Booked Calls</span>
                    <span className="text-crm-text-bright font-display font-semibold">{selected.stats.bookedCalls}</span>
                  </div>
                  <div className="divider" />
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-crm-muted font-mono">Closed Deals</span>
                    <span className="text-crm-text-bright font-display font-semibold">{selected.stats.closedDeals}</span>
                  </div>
                  <div className="divider" />
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-crm-muted font-mono">EOD Reports</span>
                    <span className="text-crm-text-bright font-display font-semibold">{selected.stats.eodReports}</span>
                  </div>
                  <div className="divider" />
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-crm-muted font-mono">Last Activity</span>
                    <span className="text-crm-text-bright font-mono text-xs">
                      {selected.lastActivity ? new Date(selected.lastActivity).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }) : 'None yet'}
                    </span>
                  </div>
                </div>
              </div>

            </div>
          )}
        </div>

      </div>

      <ConfirmDialog
        open={!!confirmRemove}
        title="Remove from roster?"
        message={confirmRemove
          ? confirmRemove.name + ' comes off the Closers list and stops counting as a missed EOD every day. '
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
