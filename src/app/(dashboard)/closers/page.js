'use client';

import { useState, useEffect } from 'react';
import { Users, Search, Phone, DollarSign, Target, BarChart3, Clock, Mail, Trash2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { getUser } from '@/lib/auth';
import EmptyState from '@/components/EmptyState';
import ConfirmDialog from '@/components/ConfirmDialog';

export default function ClosersPage() {
  var s1 = useState([]), closers = s1[0], setClosers = s1[1];
  var s2 = useState(true), loading = s2[0], setLoading = s2[1];
  var s3 = useState(''), search = s3[0], setSearch = s3[1];
  var s4 = useState(null), selected = s4[0], setSelected = s4[1];
  var s5 = useState(null), confirmDelete = s5[0], setConfirmDelete = s5[1];

  var user = getUser();
  var isAdmin = user && user.email === 'shorty21taylor@gmail.com';

  useEffect(function() {
    fetchClosers();
    var interval = setInterval(fetchClosers, 30000);
    return function() { clearInterval(interval); };
  }, []);

  function fetchClosers() {
    fetch('/api/closers')
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

  async function handleDelete(email) {
    await fetch('/api/closers/' + encodeURIComponent(email), { method: 'DELETE' });
    setConfirmDelete(null);
    if (selected && selected.email === email) setSelected(null);
    fetchClosers();
  }

  var filtered = closers.filter(function(c) {
    if (!search) return true;
    var q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q);
  });

  return (
    <div className="min-h-screen">
      <header className="page-header">
        <div className="flex items-center justify-between px-4 md:px-8 h-16">
          <div>
            <h1 className="font-display font-bold text-crm-text-bright text-lg tracking-tight">Closers</h1>
            <p className="text-xs text-crm-muted font-mono">{closers.length} team member{closers.length !== 1 ? 's' : ''} registered</p>
          </div>
        </div>
      </header>

      <div className="flex flex-col md:flex-row px-4 md:px-8 py-4 md:py-6 gap-4 md:gap-6">

        {/* Left panel — closer list */}
        <div className="w-full md:w-80 flex-shrink-0">
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
              <div className="max-h-[300px] md:max-h-[calc(100vh-200px)] overflow-y-auto">
                {filtered.map(function(closer) {
                  var isSelected = selected && selected.email === closer.email;
                  return (
                    <div
                      key={closer.email}
                      onClick={function() { setSelected(closer); }}
                      className={'group flex items-center gap-3 px-4 py-3 cursor-pointer transition-all duration-200 ' + (isSelected ? 'bg-crm-accent/10 border-l-2 border-crm-accent' : 'hover:bg-white/[0.02] border-l-2 border-transparent')}
                    >
                      <div className="avatar avatar-md text-crm-accent font-display">
                        {closer.name ? closer.name[0].toUpperCase() : '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-display font-semibold text-crm-text-bright truncate">{closer.name}</p>
                        <p className="text-xs font-mono text-crm-muted truncate">{closer.email}</p>
                      </div>
                      {isAdmin && (
                        <button
                          onClick={function(e) {
                            e.stopPropagation();
                            setConfirmDelete({ email: closer.email, label: closer.name });
                          }}
                          className="opacity-0 group-hover:opacity-100 text-crm-muted hover:text-crm-negative p-1 transition-opacity"
                          title="Delete closer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                      {!isAdmin && closer.stats.closedDeals > 0 && (
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
                  </div>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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
        open={!!confirmDelete}
        title="Delete Closer Profile?"
        message={confirmDelete ? 'This will remove ' + confirmDelete.label + ' from the team. Their existing booked calls, deals, and EODs will remain in the system.' : ''}
        confirmLabel="Delete Closer"
        onConfirm={function() { handleDelete(confirmDelete.email); }}
        onCancel={function() { setConfirmDelete(null); }}
      />
    </div>
  );
}
