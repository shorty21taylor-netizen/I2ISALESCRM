'use client';
import { useState, useEffect } from 'react';
import { DollarSign, Clock, CheckCircle, Percent, Users, CreditCard } from 'lucide-react';
import { useWorkspace, withWorkspace, apiFetch, useAccess } from '@/lib/workspace-client';
import { getUser } from '@/lib/auth';
import { formatCurrency, getInitials } from '@/lib/utils';
import { todayInReportTimezone } from '@/lib/report-date';
import EmptyState from '@/components/EmptyState';

var statusBadge = {
  pending: 'bg-crm-warning/10 text-crm-warning border border-crm-warning/20',
  approved: 'bg-crm-positive/10 text-crm-positive border border-crm-positive/20',
  paid: 'bg-crm-positive/10 text-crm-positive border border-crm-positive/20',
};

function formatMonthShort(key) {
  if (!key || key === 'unknown') return '—';
  var parts = key.split('-');
  var d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1);
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

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
  // The month the team is standing in, not the browser's — the same bucketing
  // every other figure in this product uses.
  var s6 = useState(todayInReportTimezone().slice(0, 7)), month = s6[0], setMonth = s6[1];
  var s7 = useState(''), statusBusy = s7[0], setStatusBusy = s7[1];
  var access = useAccess();
  var canSettle = !!(access && access.canSeeTeam);

  useEffect(function() {
    var u = getUser();
    setUser(u);
    if (!u) { setLoading(false); return; }

    apiFetch(withWorkspace('/api/commissions?month=' + encodeURIComponent(month), workspaceId))
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
  }, [workspaceId, month]);

  function refreshCommissions() {
    apiFetch(withWorkspace('/api/commissions?month=' + encodeURIComponent(month), workspaceId))
      .then(function(r) { return r.json(); })
      .then(function(data) { if (data.success) setCommData(data); })
      .catch(function() {});
    apiFetch(withWorkspace('/api/commissions?view=all', workspaceId))
      .then(function(r) { return r.json(); })
      .then(function(data) { if (data.success) setAllData(data); })
      .catch(function() {});
  }

  // Marking a commission paid is a money decision, so the server only accepts it
  // from somebody who runs the workspace — the control is hidden from a rep as
  // well, rather than offered and then refused.
  function handleStatusUpdate(dealId, newStatus) {
    setStatusBusy(dealId);
    apiFetch('/api/commissions/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dealId: dealId, status: newStatus }),
    })
      .then(function(r) { return r.json(); })
      .then(function() { setStatusBusy(''); refreshCommissions(); })
      .catch(function() { setStatusBusy(''); });
  }

  // Everything still owed on the month being looked at, settled in one go.
  function markMonthPaid(rows) {
    var owing = (rows || []).filter(function(d) { return d.status !== 'paid'; });
    if (!owing.length) return;
    setStatusBusy('all');
    Promise.all(owing.map(function(d) {
      return apiFetch('/api/commissions/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId: d.id, status: 'paid' }),
      });
    })).then(function() { setStatusBusy(''); refreshCommissions(); })
      .catch(function() { setStatusBusy(''); });
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
  var lifetime = commData ? commData.lifetime : null;
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
        {view === 'personal' ? renderPersonalView(summary, lifetime, deals, monthlyBreakdown, month, setMonth, handleStatusUpdate, markMonthPaid, canSettle, statusBusy) : renderTeamView(allData, handleBulkStatusUpdate)}
      </div>
    </div>
  );
}

function renderPersonalView(summary, lifetime, deals, monthlyBreakdown, month, setMonth, handleStatusUpdate, markMonthPaid, canSettle, statusBusy) {
  // Nothing loaded yet, or nothing ever earned. Without this the figures below
  // read straight off a null summary and the page renders blank.
  if (!summary) {
    return <p className="cl-hint p-8 text-center">Loading your commissions…</p>;
  }
  if (!lifetime || lifetime.totalDeals === 0) {
    return (
      <div className="glass-card no-lift overflow-hidden">
        <EmptyState icon={CreditCard} title="No commissions yet"
          subtitle="Close your first deal and it appears here with what it earned you." />
      </div>
    );
  }

  // Every month this rep has ever earned in, plus the one being viewed even when
  // it is empty — so the picker never hides the month somebody is standing in.
  var monthKeys = (monthlyBreakdown || []).map(function(m) { return m.month; })
    .filter(function(m) { return m && m !== 'unknown'; });
  if (monthKeys.indexOf(month) === -1) monthKeys = [month].concat(monthKeys);
  monthKeys = monthKeys.sort().reverse().slice(0, 13);

  var picker = (
    <div className="cm-months">
      {monthKeys.map(function(k) {
        return (
          <button key={k} type="button"
            className={'cm-month' + (k === month ? ' on' : '')}
            onClick={function() { setMonth(k); }}>
            {formatMonthShort(k)}
          </button>
        );
      })}
    </div>
  );

  return (
    <>
      {picker}

      {/* What this month has earned, and what is still owed on it. */}
      <div className="dh-band">
        <div className="dh-main">
          <p className="dh-l">Earned in {formatMonth(month)}</p>
          <p className="dh-fig mt-2">{formatCurrency(summary.totalCommission)}</p>
          <p className="dh-sub">
            {summary.totalDeals} deal{summary.totalDeals === 1 ? '' : 's'} closed
            {' · '}{formatCurrency(summary.totalRevenue)} collected
            {' · '}{(summary.commissionRate * 100).toFixed(0)}% rate
          </p>
        </div>
        <div className="dh-side">
          <div>
            <p className="dh-l">Still owed</p>
            <p className="dh-sec-fig" style={{ color: summary.pendingCommission > 0 ? 'var(--crm-warning)' : 'var(--crm-text-bright)' }}>
              {formatCurrency(summary.pendingCommission)}
            </p>
            <p className="dh-sub" style={{ marginTop: '4px' }}>
              {formatCurrency(summary.paidCommission)} paid out
            </p>
          </div>
          <div>
            <p className="dh-l">Earned all time</p>
            <p className="dh-sec-fig">{formatCurrency(lifetime ? lifetime.totalCommission : 0)}</p>
            <p className="dh-sub" style={{ marginTop: '4px' }}>
              across {lifetime ? lifetime.totalDeals : 0} deal{(lifetime && lifetime.totalDeals === 1) ? '' : 's'}
            </p>
          </div>
        </div>
      </div>

      <div className="td-section">
        <div className="td-section-h">
          <h3 className="td-section-t">Deals closed in {formatMonth(month)}</h3>
          <span className="td-section-rule" />
          {canSettle && summary.totalCommission > summary.paidCommission ? (
            <button className="an-chip" disabled={statusBusy === 'all'}
              onClick={function() { markMonthPaid(deals); }}>
              <CheckCircle className="w-3 h-3" />
              {statusBusy === 'all' ? 'Marking…' : 'Mark the month paid'}
            </button>
          ) : null}
          <span className="section-tag">{deals.length} {deals.length === 1 ? 'deal' : 'deals'}</span>
        </div>

        {deals.length === 0 ? (
          <div className="glass-card no-lift p-10 text-center">
            <p className="text-sm" style={{ color: 'var(--crm-text-muted)' }}>
              Nothing closed in {formatMonth(month)} yet.
            </p>
            <p className="text-xs mt-2" style={{ color: 'var(--crm-text-muted)' }}>
              Earlier months are above — this page opens on the month the floor is in.
            </p>
          </div>
        ) : (
          <div className="glass-card eodt-wrap">
            <table className="eodt cm-table">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Lead</th>
                  <th scope="col">Collected</th>
                  <th scope="col">Rate</th>
                  <th scope="col">Commission</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {deals.map(function(deal) {
                  return (
                    <tr key={deal.id}>
                      <td>{deal.day
                        ? new Date(deal.day + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                        : '—'}</td>
                      <th scope="row" className="cm-lead">{deal.leadName || 'Unnamed'}</th>
                      <td>{formatCurrency(deal.dealValue)}</td>
                      <td>{(deal.commissionRate * 100).toFixed(0)}%</td>
                      <td className="cm-earned">{formatCurrency(deal.commissionAmount)}</td>
                      <td>
                        {canSettle ? (
                          <select
                            className={'cm-status cm-status-pick ' + (deal.status || 'pending')}
                            value={deal.status || 'pending'}
                            disabled={statusBusy === deal.id || statusBusy === 'all'}
                            aria-label={'Commission status for ' + (deal.leadName || 'this deal')}
                            onChange={function(e) { handleStatusUpdate(deal.id, e.target.value); }}
                          >
                            <option value="pending">Pending</option>
                            <option value="approved">Approved</option>
                            <option value="paid">Paid</option>
                          </select>
                        ) : (
                          <span className={'cm-status ' + (deal.status || 'pending')}>
                            {deal.status === 'paid' ? <CheckCircle className="w-3 h-3" /> : null}
                            {deal.status || 'pending'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td />
                  <td>{formatCurrency(summary.totalRevenue)}</td>
                  <td>—</td>
                  <td>{formatCurrency(summary.totalCommission)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {monthlyBreakdown && monthlyBreakdown.length > 0 ? (
        <div className="td-section">
          <div className="td-section-h">
            <h3 className="td-section-t">Every month</h3>
            <span className="td-section-rule" />
          </div>
          <div className="glass-card no-lift cm-history">
            {monthlyBreakdown.map(function(m) {
              return (
                <button key={m.month} type="button"
                  className={'cm-hist-row' + (m.month === month ? ' on' : '')}
                  onClick={function() { setMonth(m.month); }}>
                  <span className="cm-hist-m">{formatMonth(m.month)}</span>
                  <span className="cm-hist-n">{m.deals} {m.deals === 1 ? 'deal' : 'deals'}</span>
                  <span className="cm-hist-r">{formatCurrency(m.revenue)}</span>
                  <span className="cm-hist-c">{formatCurrency(m.commission)}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
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
