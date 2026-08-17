'use client';
import { useState, useEffect } from 'react';
import { DollarSign, Clock, CheckCircle, Percent, Users, CreditCard } from 'lucide-react';
import { useWorkspace, withWorkspace, apiFetch } from '@/lib/workspace-client';
import { getUser } from '@/lib/auth';
import { formatCurrency, getInitials } from '@/lib/utils';
import EmptyState from '@/components/EmptyState';

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
  var workspaceId = useWorkspace();
  var s1 = useState(null), commData = s1[0], setCommData = s1[1];
  var s2 = useState(null), allData = s2[0], setAllData = s2[1];
  var s3 = useState(true), loading = s3[0], setLoading = s3[1];
  var s4 = useState('personal'), view = s4[0], setView = s4[1];
  var s5 = useState(null), user = s5[0], setUser = s5[1];

  useEffect(function() {
    var u = getUser();
    setUser(u);
    if (!u) { setLoading(false); return; }

    apiFetch(withWorkspace('/api/commissions?closer=' + encodeURIComponent(u.name), workspaceId))
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.success) setCommData(data);
        setLoading(false);
      })
      .catch(function() { setLoading(false); });

    apiFetch(withWorkspace('/api/commissions?view=all', workspaceId))
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.success) setAllData(data);
      })
      .catch(function() {});
  }, [workspaceId]);

  function handleStatusUpdate(dealId, newStatus) {
    apiFetch('/api/commissions/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dealId: dealId, status: newStatus }),
    })
      .then(function(r) { return r.json(); })
      .then(function() {
        // Refresh both views
        if (user) {
          apiFetch(withWorkspace('/api/commissions?closer=' + encodeURIComponent(user.name), workspaceId))
            .then(function(r) { return r.json(); })
            .then(function(data) { if (data.success) setCommData(data); });
        }
        apiFetch(withWorkspace('/api/commissions?view=all', workspaceId))
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
            apiFetch('/api/commissions/status', {
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
        apiFetch(withWorkspace('/api/commissions?closer=' + encodeURIComponent(user.name), workspaceId))
          .then(function(r) { return r.json(); })
          .then(function(data) { if (data.success) setCommData(data); });
      }
      apiFetch(withWorkspace('/api/commissions?view=all', workspaceId))
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
        <div className="flex items-center justify-between px-8 h-16">
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

      <div className="px-8 py-6 space-y-6">
        {view === 'personal' ? renderPersonalView(summary, deals, monthlyBreakdown, handleStatusUpdate) : renderTeamView(allData, handleBulkStatusUpdate)}
      </div>
    </div>
  );
}

function renderPersonalView(summary, deals, monthlyBreakdown, handleStatusUpdate) {
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
      <div className="grid grid-cols-4 gap-4">
        <div className="glass-card p-5 stagger-1">
          <div className="flex items-start justify-between mb-3">
            <div className="icon-box-green"><DollarSign className="w-5 h-5" /></div>
          </div>
          <div className="metric-value-green text-2xl mb-1">{formatCurrency(summary.totalCommission)}</div>
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
            <div className="icon-box-default"><CheckCircle className="w-5 h-5" /></div>
          </div>
          <div className="text-2xl font-display font-bold text-crm-text-bright mb-1">{summary.totalDeals}</div>
          <div className="text-xs font-mono text-crm-muted uppercase tracking-wider">Total Deals</div>
        </div>
        <div className="glass-card p-5 stagger-4">
          <div className="flex items-start justify-between mb-3">
            <div className="icon-box-accent"><Percent className="w-5 h-5" /></div>
          </div>
          <div className="metric-value-accent text-2xl mb-1">{(summary.commissionRate * 100).toFixed(0) + '%'}</div>
          <div className="text-xs font-mono text-crm-muted uppercase tracking-wider">Commission Rate</div>
        </div>
      </div>

      {/* Deals Table */}
      <div className="glass-card overflow-hidden stagger-5">
        <div className="section-header">
          <h3>Your closed deals</h3>
          <span className="section-tag">{deals.length} deals</span>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Lead</th>
                <th>Deal Value</th>
                <th>Source</th>
                <th>Payment</th>
                <th>Commission</th>
                <th>Status</th>
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
                      <span className={'inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium ' + (deal.leadSource === 'inbound' ? 'bg-crm-positive/10 text-crm-positive border border-crm-positive/20' : 'bg-white/5 text-crm-muted border border-crm-border')}>
                        {deal.leadSource}
                      </span>
                    </td>
                    <td className="text-xs font-mono text-crm-muted capitalize">{deal.paymentMethod}</td>
                    <td className="text-sm font-mono metric-positive font-bold">{formatCurrency(deal.commissionAmount)}</td>
                    <td>
                      <span className={'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-medium ' + (statusBadge[deal.status] || statusBadge.pending)}>
                        {deal.status === 'paid' && <CheckCircle className="w-3 h-3" />}
                        {deal.status}
                      </span>
                    </td>
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

function renderTeamView(allData, handleBulkStatusUpdate) {
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
      <div className="grid grid-cols-4 gap-4">
        <div className="glass-card p-5 stagger-1">
          <div className="text-2xl font-display font-bold text-crm-text-bright mb-1">{formatCurrency(teamRevenue)}</div>
          <div className="text-xs font-mono text-crm-muted uppercase tracking-wider">Team Revenue</div>
        </div>
        <div className="glass-card p-5 stagger-2">
          <div className="metric-value-green text-2xl mb-1">{formatCurrency(teamCommission)}</div>
          <div className="text-xs font-mono text-crm-muted uppercase tracking-wider">Total Commissions</div>
        </div>
        <div className="glass-card p-5 stagger-3">
          <div className="text-2xl font-display font-bold text-crm-warning mb-1">{formatCurrency(teamPending)}</div>
          <div className="text-xs font-mono text-crm-muted uppercase tracking-wider">Pending Payout</div>
        </div>
        <div className="glass-card p-5 stagger-4">
          <div className="text-2xl font-display font-bold text-crm-positive mb-1">{formatCurrency(teamPaid)}</div>
          <div className="text-xs font-mono text-crm-muted uppercase tracking-wider">Total Paid</div>
        </div>
      </div>

      {/* Admin Actions */}
      <div className="flex items-center gap-3 stagger-5">
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
                    <span>{(s.commissionRate * 100).toFixed(0)}% rate</span>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-right">
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
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
