'use client';
import { useState, useEffect } from 'react';
import { DollarSign, Clock, CheckCircle, Percent, Users, CreditCard, Trash2 } from 'lucide-react';
import { getUser } from '@/lib/auth';
import { formatCurrency, getInitials } from '@/lib/utils';
import EmptyState from '@/components/EmptyState';
import ConfirmDialog from '@/components/ConfirmDialog';

var statusBadge = {
  pending: 'bg-crm-warning/10 text-crm-warning border border-crm-warning/20',
  approved: 'bg-crm-positive/10 text-crm-positive border border-crm-positive/20',
  paid: 'bg-crm-positive/10 text-crm-positive border border-crm-positive/20',
};

function formatMonth(key) {
  if (!key || key === 'unknown') return 'Unknown';
  var parts = key.split('-');
  var d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1);
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export default function CommissionsPage() {
  var s1 = useState(null), commData = s1[0], setCommData = s1[1];
  var s2 = useState(null), allData = s2[0], setAllData = s2[1];
  var s3 = useState(true), loading = s3[0], setLoading = s3[1];
  var s4 = useState('personal'), view = s4[0], setView = s4[1];
  var s5 = useState(null), user = s5[0], setUser = s5[1];
  var s6 = useState(null), confirmDelete = s6[0], setConfirmDelete = s6[1];

  var isAdmin = false;

  useEffect(function() {
    var u = getUser();
    setUser(u);
    if (!u) { setLoading(false); return; }

    fetchCommissions(u);
  }, []);

  function fetchCommissions(u) {
    var who = u || user;
    if (!who) return;
    fetch('/api/commissions?closer=' + encodeURIComponent(who.name))
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.success) setCommData(data);
        setLoading(false);
      })
      .catch(function() { setLoading(false); });

    fetch('/api/commissions?view=all')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.success) setAllData(data);
      })
      .catch(function() {});
  }

  async function handleDeleteDeal(id) {
    await fetch('/api/webhooks/close-deal/' + encodeURIComponent(id), { method: 'DELETE' });
    setConfirmDelete(null);
    fetchCommissions();
  }

  isAdmin = user && user.email === 'shorty21taylor@gmail.com';

  function handleStatusUpdate(dealId, newStatus) {
    fetch('/api/commissions/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dealId: dealId, status: newStatus }),
    })
      .then(function(r) { return r.json(); })
      .then(function() {
        // Refresh both views
        if (user) {
          fetch('/api/commissions?closer=' + encodeURIComponent(user.name))
            .then(function(r) { return r.json(); })
            .then(function(data) { if (data.success) setCommData(data); });
        }
        fetch('/api/commissions?view=all')
          .then(function(r) { return r.json(); })
          .then(function(data) { if (data.success) setAllData(data); });
      });
  }

  function handleBulkStatusUpdate(fromStatus, toStatus) {
    if (!allData || !allData.closers) return;
    var promises = [];
    allData.closers.forEach(function(c) {
      c.data.deals.forEach(function(deal) {
        if (deal.status === fromStatus) {
          promises.push(
            fetch('/api/commissions/status', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ dealId: deal.id, status: toStatus }),
            })
          );
        }
      });
    });
    Promise.all(promises).then(function() {
      // Refresh
      if (user) {
        fetch('/api/commissions?closer=' + encodeURIComponent(user.name))
          .then(function(r) { return r.json(); })
          .then(function(data) { if (data.success) setCommData(data); });
      }
      fetch('/api/commissions?view=all')
        .then(function(r) { return r.json(); })
        .then(function(data) { if (data.success) setAllData(data); });
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-crm-muted text-sm font-mono">Loading commissions...</div>
      </div>
    );
  }

  var summary = commData ? commData.summary : null;
  var deals = commData ? commData.deals || [] : [];
  var monthlyBreakdown = commData ? commData.monthlyBreakdown || [] : [];

  return (
    <div>
      <header className="page-header">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 px-4 md:px-8 h-auto py-3 md:h-16 md:py-0">
          <div>
            <h1 className="font-display font-bold text-crm-text-bright text-lg tracking-tight">Commissions</h1>
            <p className="text-xs text-crm-muted font-mono">{user ? user.name + ' \u2014 earnings from closed deals' : 'Your earnings from closed deals'}</p>
          </div>
          <div className="glass-surface inline-flex rounded-xl p-1">
            <button onClick={function() { setView('personal'); }} className={view === 'personal' ? 'px-4 py-1.5 rounded-lg text-sm font-display font-semibold bg-crm-accent/15 text-crm-accent transition-all duration-300' : 'px-4 py-1.5 rounded-lg text-sm font-display font-medium text-crm-muted hover:text-crm-text transition-all duration-300'}>
              My commissions
            </button>
            <button onClick={function() { setView('team'); }} className={view === 'team' ? 'px-4 py-1.5 rounded-lg text-sm font-display font-semibold bg-crm-accent/15 text-crm-accent transition-all duration-300' : 'px-4 py-1.5 rounded-lg text-sm font-display font-medium text-crm-muted hover:text-crm-text transition-all duration-300'}>
              Team overview
            </button>
          </div>
        </div>
      </header>

      <div className="px-4 md:px-8 py-4 md:py-6 space-y-4 md:space-y-6">
        {view === 'personal' ? renderPersonalView(summary, deals, monthlyBreakdown, handleStatusUpdate, isAdmin, setConfirmDelete) : renderTeamView(allData, handleBulkStatusUpdate, isAdmin, setConfirmDelete)}
      </div>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete Closed Deal?"
        message={confirmDelete ? 'This will permanently delete the deal for ' + confirmDelete.label + '. Commission data will be recalculated. This cannot be undone.' : ''}
        confirmLabel="Delete Deal"
        onConfirm={function() { handleDeleteDeal(confirmDelete.id); }}
        onCancel={function() { setConfirmDelete(null); }}
      />
    </div>
  );
}

function renderPersonalView(summary, deals, monthlyBreakdown, handleStatusUpdate, isAdmin, setConfirmDelete) {
  if (!summary || summary.totalDeals === 0) {
    return (
      <div className="glass-card overflow-hidden">
        <EmptyState icon={CreditCard} title="No commissions yet" subtitle="Close your first deal to start earning commissions" />
      </div>
    );
  }

  return (
    <>
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <div className="glass-card p-3 md:p-5 stagger-1">
          <div className="flex items-start justify-between mb-2 md:mb-3">
            <div className="icon-box-green"><DollarSign className="w-5 h-5" /></div>
          </div>
          <div className="metric-value-green text-lg md:text-2xl mb-1">{formatCurrency(summary.totalCommission)}</div>
          <div className="text-xs font-mono text-crm-muted uppercase tracking-wider">Total Earned</div>
        </div>
        <div className="glass-card p-5 stagger-2">
          <div className="flex items-start justify-between mb-3">
            <div className="icon-box-default"><Clock className="w-5 h-5" /></div>
          </div>
          <div className="text-2xl font-display font-bold text-crm-warning mb-1">{formatCurrency(summary.pendingCommission)}</div>
          <div className="text-xs font-mono text-crm-muted uppercase tracking-wider">Pending Payout</div>
        </div>
        <div className="glass-card p-5 stagger-3">
          <div className="flex items-start justify-between mb-3">
            <div className="icon-box-green"><DollarSign className="w-5 h-5" /></div>
          </div>
          <div className="text-2xl font-display font-bold text-crm-positive mb-1">{formatCurrency(summary.i2i ? summary.i2i.commission : 0)}</div>
          <div className="text-xs font-mono text-crm-muted uppercase tracking-wider">I2I (10%)</div>
          <div className="text-xs font-mono text-crm-muted mt-1">{summary.i2i ? summary.i2i.deals : 0} deals</div>
        </div>
        <div className="glass-card p-5 stagger-4">
          <div className="flex items-start justify-between mb-3">
            <div className="icon-box-default"><DollarSign className="w-5 h-5" /></div>
          </div>
          <div className="text-2xl font-display font-bold" style={{ color: 'var(--crm-warning, #f59e0b)' }}>{formatCurrency(summary.myfm ? summary.myfm.commission : 0)}</div>
          <div className="text-xs font-mono text-crm-muted uppercase tracking-wider">MYFM (7.5%)</div>
          <div className="text-xs font-mono text-crm-muted mt-1">{summary.myfm ? summary.myfm.deals : 0} deals</div>
        </div>
      </div>

      {/* Deals Table */}
      <div className="glass-card overflow-hidden stagger-5">
        <div className="section-header">
          <h3>Your closed deals</h3>
          <span className="section-tag">{deals.length} deals</span>
        </div>
        <div className="table-scroll -mx-4 md:mx-0">
          <table className="data-table min-w-[600px]">
            <thead>
              <tr>
                <th>Date</th>
                <th>Lead</th>
                <th>Deal Value</th>
                <th>Rate</th>
                <th>Commission</th>
                <th>Status</th>
                {isAdmin && <th></th>}
              </tr>
            </thead>
            <tbody>
              {deals.map(function(deal) {
                return (
                  <tr key={deal.id}>
                    <td className="text-xs font-mono text-crm-muted whitespace-nowrap">
                      {new Date(deal.closedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </td>
                    <td className="text-sm text-crm-text-bright">{deal.leadName}</td>
                    <td className="text-sm font-mono text-crm-text-bright">{formatCurrency(deal.dealValue)}</td>
                    <td>
                      <span className={'inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium ' + (deal.brand === 'I2I' ? 'bg-crm-positive/10 text-crm-positive border border-crm-positive/20' : 'bg-crm-warning/10 text-crm-warning border border-crm-warning/20')}>
                        {deal.brand} ({(deal.commissionRate * 100)}%)
                      </span>
                    </td>
                    <td className="text-sm font-mono metric-positive font-bold">{formatCurrency(deal.commissionAmount)}</td>
                    <td>
                      <span className={'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-medium ' + (statusBadge[deal.status] || statusBadge.pending)}>
                        {deal.status === 'paid' && <CheckCircle className="w-3 h-3" />}
                        {deal.status}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="text-right">
                        <button
                          onClick={function() { setConfirmDelete({ id: deal.id, label: deal.leadName }); }}
                          className="text-crm-muted hover:text-crm-negative p-1 rounded-lg hover:bg-white/5 transition-colors"
                          title="Delete deal"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Monthly Breakdown */}
      {monthlyBreakdown.length > 0 && (
        <div className="glass-card overflow-hidden stagger-6">
          <div className="section-header">
            <h3>Monthly breakdown</h3>
          </div>
          <div className="p-5 space-y-2">
            {monthlyBreakdown.map(function(m) {
              return (
                <div key={m.month} className="flex items-center justify-between p-3 glass-surface">
                  <div className="text-sm font-medium text-crm-text-bright">{formatMonth(m.month)}</div>
                  <div className="flex items-center gap-6 text-xs font-mono">
                    <span className="text-crm-muted">{m.deals} deals</span>
                    <span className="text-crm-text-bright">{formatCurrency(m.revenue)} revenue</span>
                    <span className="metric-positive font-bold">{formatCurrency(m.commission)} earned</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

function renderTeamView(allData, handleBulkStatusUpdate, isAdmin, setConfirmDelete) {
  if (!allData || !allData.closers || allData.closers.length === 0) {
    return (
      <div className="glass-card overflow-hidden">
        <EmptyState icon={Users} title="No team commissions data yet" subtitle="Commission data appears when deals are closed via webhooks" />
      </div>
    );
  }

  var teamRevenue = allData.closers.reduce(function(s, c) { return s + c.data.summary.totalRevenue; }, 0);
  var teamCommission = allData.closers.reduce(function(s, c) { return s + c.data.summary.totalCommission; }, 0);
  var teamPending = allData.closers.reduce(function(s, c) { return s + c.data.summary.pendingCommission; }, 0);
  var teamPaid = allData.closers.reduce(function(s, c) { return s + c.data.summary.paidCommission; }, 0);

  return (
    <>
      {/* Team Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <div className="glass-card p-3 md:p-5 stagger-1">
          <div className="text-lg md:text-2xl font-display font-bold text-crm-text-bright mb-1">{formatCurrency(teamRevenue)}</div>
          <div className="text-xs font-mono text-crm-muted uppercase tracking-wider">Team Revenue</div>
        </div>
        <div className="glass-card p-3 md:p-5 stagger-2">
          <div className="text-lg md:text-2xl metric-value-green mb-1">{formatCurrency(teamCommission)}</div>
          <div className="text-xs font-mono text-crm-muted uppercase tracking-wider">Total Commissions</div>
        </div>
        <div className="glass-card p-3 md:p-5 stagger-3">
          <div className="text-lg md:text-2xl font-display font-bold text-crm-warning mb-1">{formatCurrency(teamPending)}</div>
          <div className="text-xs font-mono text-crm-muted uppercase tracking-wider">Pending Payout</div>
        </div>
        <div className="glass-card p-3 md:p-5 stagger-4">
          <div className="text-lg md:text-2xl font-display font-bold text-crm-positive mb-1">{formatCurrency(teamPaid)}</div>
          <div className="text-xs font-mono text-crm-muted uppercase tracking-wider">Total Paid</div>
        </div>
      </div>

      {/* Admin Actions */}
      <div className="flex flex-wrap items-center gap-3 stagger-5">
        <button
          onClick={function() { handleBulkStatusUpdate('pending', 'approved'); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-display font-semibold bg-crm-positive/10 text-crm-positive border border-crm-positive/20 hover:bg-crm-positive/20 transition-colors"
        >
          <CheckCircle className="w-4 h-4" />
          Approve all pending
        </button>
        <button
          onClick={function() { handleBulkStatusUpdate('approved', 'paid'); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-display font-semibold bg-crm-accent/10 text-crm-accent border border-crm-accent/20 hover:bg-crm-accent/20 transition-colors"
        >
          <DollarSign className="w-4 h-4" />
          Mark approved as paid
        </button>
      </div>

      {/* Commission Rates */}
      <div className="glass-card p-5 stagger-5">
        <div className="text-xs font-mono text-crm-muted uppercase tracking-wider mb-3">Commission Rates</div>
        <div className="flex flex-wrap items-center gap-4 md:gap-6">
          <div>
            <span className="text-sm font-display font-bold text-crm-positive">10%</span>
            <span className="text-xs font-mono text-crm-muted ml-2">I2I (Coaching, DFY Funding)</span>
          </div>
          <div>
            <span className="text-sm font-display font-bold text-crm-warning">7.5%</span>
            <span className="text-xs font-mono text-crm-muted ml-2">MYFM (SaaS / Fund2Grow)</span>
          </div>
        </div>
      </div>

      {/* Commission Leaderboard */}
      <div className="glass-card overflow-hidden stagger-6">
        <div className="section-header">
          <h3>Commission leaderboard</h3>
          <span className="section-tag">{allData.closers.length} closers</span>
        </div>
        <div className="px-4 py-3 space-y-1">
          {allData.closers.map(function(c, idx) {
            var rank = idx + 1;
            var isTop = rank === 1;
            var s = c.data.summary;
            return (
              <div key={c.closerName} className={'flex items-center gap-3 p-3 rounded-xl transition-all duration-300 hover:bg-white/[0.03] ' + (isTop ? 'leaderboard-row-1 rounded-xl' : '')}>
                <div className={'rank-circle ' + (isTop ? 'rank-1' : 'rank-default')}>
                  {rank}
                </div>
                <div className={'avatar avatar-md ' + (isTop ? 'border-crm-accent/30 bg-crm-accent/10 text-crm-accent' : 'text-crm-text')}>
                  {getInitials(c.closerName)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-crm-text-bright text-sm truncate">{c.closerName}</div>
                  <div className="flex items-center gap-3 text-xs text-crm-muted font-mono mt-0.5">
                    <span>{s.totalDeals} deals</span>
                    <span className="text-crm-positive">{s.i2i ? s.i2i.deals : 0} I2I</span>
                    <span className="text-crm-warning">{s.myfm ? s.myfm.deals : 0} MYFM</span>
                  </div>
                </div>
                <div className="hidden md:flex items-center gap-4 text-right">
                  <div>
                    <div className="text-xs text-crm-muted font-mono">Revenue</div>
                    <div className="text-sm font-mono text-crm-text-bright">{formatCurrency(s.totalRevenue)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-crm-muted font-mono">Earned</div>
                    <div className="text-sm font-mono metric-positive font-bold">{formatCurrency(s.totalCommission)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-crm-muted font-mono">Pending</div>
                    <div className="text-sm font-mono text-crm-warning">{formatCurrency(s.pendingCommission)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-crm-muted font-mono">Paid</div>
                    <div className="text-sm font-mono text-crm-positive">{formatCurrency(s.paidCommission)}</div>
                  </div>
                </div>
                <div className="md:hidden text-right">
                  <div className="text-sm font-mono metric-positive font-bold">{formatCurrency(s.totalCommission)}</div>
                  <div className="text-[10px] text-crm-muted font-mono">earned</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
