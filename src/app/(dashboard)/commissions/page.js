'use client';
import { useState, useEffect } from 'react';
import { DollarSign, Clock, CheckCircle, Percent, Users, CreditCard, Trash2, AlertTriangle, PenLine } from 'lucide-react';
import { useWorkspace, withWorkspace, apiFetch, useAccess } from '@/lib/workspace-client';
import { getUser } from '@/lib/auth';
import { formatCurrency, getInitials } from '@/lib/utils';
import { todayInReportTimezone } from '@/lib/report-date';
import EmptyState from '@/components/EmptyState';
import CommissionLogger from '@/components/CommissionLogger';

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

  // A hand-logged row is not a closed deal, so it does not go through
  // /api/commissions/status — that endpoint edits the deal record. Its own
  // endpoint owns it, and only a manager is allowed to move its status.
  function handleLoggedStatus(id, newStatus) {
    setStatusBusy(id);
    apiFetch(withWorkspace('/api/commissions/log', workspaceId), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: id, status: newStatus }),
    })
      .then(function(r) { return r.json(); })
      .then(function() { setStatusBusy(''); refreshCommissions(); })
      .catch(function() { setStatusBusy(''); });
  }

  // Soft, like every delete here — the row keeps its data in Postgres with
  // deleted_at stamped, so a mis-click on a figure somebody is paid from is
  // recoverable. Confirmed first all the same.
  function handleLoggedDelete(row) {
    if (typeof window !== 'undefined'
      && !window.confirm('Remove the logged sale to ' + (row.leadName || 'this lead') + '?')) return;
    setStatusBusy(row.id);
    apiFetch(withWorkspace('/api/commissions/log?id=' + encodeURIComponent(row.id), workspaceId), {
      method: 'DELETE',
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
            <p className="text-xs text-crm-muted font-mono">{user ? user.name + ' \u2014 closed deals and the sales you log yourself' : 'Closed deals and the sales you log yourself'}</p>
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
        {view === 'personal' ? renderPersonalView({
          summary: summary, lifetime: lifetime, deals: deals, monthlyBreakdown: monthlyBreakdown,
          logged: commData ? commData.logged || [] : [],
          loggedSummary: commData ? commData.loggedSummary : null,
          loggedLifetime: commData ? commData.loggedLifetime : null,
          loggedMonthlyBreakdown: commData ? commData.loggedMonthlyBreakdown || [] : [],
          duplicates: commData ? commData.duplicates || [] : [],
          month: month, setMonth: setMonth,
          handleStatusUpdate: handleStatusUpdate, markMonthPaid: markMonthPaid,
          handleLoggedStatus: handleLoggedStatus, handleLoggedDelete: handleLoggedDelete,
          canSettle: canSettle, statusBusy: statusBusy,
          workspaceId: workspaceId, userName: user ? user.name : '',
          onLogged: refreshCommissions,
        }) : renderTeamView(allData, handleBulkStatusUpdate)}
      </div>
    </div>
  );
}

function renderPersonalView(p) {
  var summary = p.summary, lifetime = p.lifetime, deals = p.deals;
  var monthlyBreakdown = p.monthlyBreakdown, month = p.month, setMonth = p.setMonth;
  var canSettle = p.canSettle, statusBusy = p.statusBusy;
  var logged = p.logged || [], loggedSummary = p.loggedSummary, loggedLifetime = p.loggedLifetime;
  var duplicates = p.duplicates || [];

  // One history, both sources. Showing closed deals alone here meant the month
  // rows added up to a different figure than the headline above them, and the
  // picker hid any month whose only sales were logged by hand.
  var historyBy = {};
  function foldMonth(m, from) {
    if (!m || !m.month || m.month === 'unknown') return;
    if (!historyBy[m.month]) {
      historyBy[m.month] = { month: m.month, deals: 0, logged: 0, revenue: 0, commission: 0 };
    }
    historyBy[m.month][from] += m.deals || 0;
    historyBy[m.month].revenue += m.revenue || 0;
    historyBy[m.month].commission += m.commission || 0;
  }
  (monthlyBreakdown || []).forEach(function(m) { foldMonth(m, 'deals'); });
  (p.loggedMonthlyBreakdown || []).forEach(function(m) { foldMonth(m, 'logged'); });
  var history = Object.keys(historyBy).sort().reverse().map(function(k) { return historyBy[k]; });

  var logger = (
    <CommissionLogger
      workspaceId={p.workspaceId}
      defaultRate={summary ? summary.commissionRate : 0}
      canFileForOthers={canSettle}
      myName={p.userName}
      onLogged={p.onLogged}
    />
  );

  // Nothing loaded yet, or nothing ever earned. Without this the figures below
  // read straight off a null summary and the page renders blank.
  if (!summary) {
    return <p className="cl-hint p-8 text-center">Loading your commissions…</p>;
  }
  // No closed deals AND nothing logged by hand. The gate used to look at closed
  // deals alone, so a rep whose sales are all hand-logged hit the empty state and
  // could not reach the thing that would fill it.
  if ((!lifetime || lifetime.totalDeals === 0)
    && (!loggedLifetime || loggedLifetime.totalDeals === 0)) {
    return (
      <>
        <div className="glass-card no-lift overflow-hidden">
          <EmptyState icon={CreditCard} title="No commissions yet"
            subtitle="Close your first deal and it appears here with what it earned you. A sale the CRM never saw — a renewal, an upsell — you can log by hand." />
        </div>
        {logger}
      </>
    );
  }

  // Every month this rep has ever earned in, plus the one being viewed even when
  // it is empty — so the picker never hides the month somebody is standing in.
  var monthKeys = history.map(function(m) { return m.month; });
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

  var loggedTotal = loggedSummary ? loggedSummary.totalCommission : 0;
  var loggedOwed = loggedSummary ? loggedSummary.pendingCommission : 0;

  return (
    <>
      {picker}

      {/* What this month has earned, and what is still owed on it. */}
      <div className="dh-band">
        <div className="dh-main">
          <p className="dh-l">Earned in {formatMonth(month)}</p>
          <p className="dh-fig mt-2">{formatCurrency(summary.totalCommission + loggedTotal)}</p>
          <p className="dh-sub">
            {formatCurrency(summary.totalCommission)} from {summary.totalDeals} closed deal{summary.totalDeals === 1 ? '' : 's'}
            {loggedTotal > 0
              ? ' · ' + formatCurrency(loggedTotal) + ' logged by hand'
              : ''}
            {' · '}{(summary.commissionRate * 100).toFixed(0)}% rate
          </p>
        </div>
        <div className="dh-side">
          <div>
            <p className="dh-l">Still owed</p>
            <p className="dh-sec-fig" style={{ color: (summary.pendingCommission + loggedOwed) > 0 ? 'var(--crm-warning)' : 'var(--crm-text-bright)' }}>
              {formatCurrency(summary.pendingCommission + loggedOwed)}
            </p>
            <p className="dh-sub" style={{ marginTop: '4px' }}>
              {formatCurrency(summary.paidCommission + (loggedSummary ? loggedSummary.paidCommission : 0))} paid out
            </p>
          </div>
          <div>
            <p className="dh-l">Earned all time</p>
            <p className="dh-sec-fig">
              {formatCurrency((lifetime ? lifetime.totalCommission : 0)
                + (loggedLifetime ? loggedLifetime.totalCommission : 0))}
            </p>
            <p className="dh-sub" style={{ marginTop: '4px' }}>
              across {(lifetime ? lifetime.totalDeals : 0) + (loggedLifetime ? loggedLifetime.totalDeals : 0)} sale{((lifetime ? lifetime.totalDeals : 0) + (loggedLifetime ? loggedLifetime.totalDeals : 0)) === 1 ? '' : 's'}
            </p>
          </div>
        </div>
      </div>

      {/* A logged sale and a closed deal naming the same lead on the same day is
          almost certainly one sale recorded twice. Both stay on the page: hiding
          one would mean a rep whose two genuine same-day sales to the same name
          disappeared, and no way to tell which figure they were paid from. */}
      {duplicates.length > 0 ? (
        <div className="cm-dupe">
          <AlertTriangle className="w-4 h-4 cm-dupe-i" />
          <div>
            <p className="cm-dupe-t">
              {duplicates.length === 1 ? 'One logged sale looks like a deal you already filed' : duplicates.length + ' logged sales look like deals you already filed'}
            </p>
            <p className="cl-hint">
              Both are counted in the figures above. Remove the logged row if it is the
              same sale — {duplicates.map(function(d) {
                return (d.leadName || 'Unnamed') + ' on ' + new Date(d.day + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              }).join(', ')}.
            </p>
          </div>
        </div>
      ) : null}

      <div className="td-section">
        <div className="td-section-h">
          <h3 className="td-section-t">Deals closed in {formatMonth(month)}</h3>
          <span className="td-section-rule" />
          {canSettle && summary.totalCommission > summary.paidCommission ? (
            <button className="an-chip" disabled={statusBusy === 'all'}
              onClick={function() { p.markMonthPaid(deals); }}>
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
                            onChange={function(e) { p.handleStatusUpdate(deal.id, e.target.value); }}
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

      {/* The hand-logged ledger. Its own section and its own subtotal, never
          folded into the table above: two sources for one figure somebody is paid
          from is how a commission run quietly doubles. */}
      <div className="td-section">
        <div className="td-section-h">
          <h3 className="td-section-t">Logged by hand</h3>
          <span className="td-section-rule" />
          <span className="section-tag">{logged.length} {logged.length === 1 ? 'sale' : 'sales'}</span>
        </div>

        {logged.length === 0 ? null : (
          <div className="glass-card eodt-wrap">
            <table className="eodt cm-table">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Lead</th>
                  <th scope="col">Program</th>
                  <th scope="col">Collected</th>
                  <th scope="col">Commission</th>
                  <th scope="col">Status</th>
                  <th scope="col"><span className="sr-only">Remove</span></th>
                </tr>
              </thead>
              <tbody>
                {logged.map(function(row) {
                  return (
                    <tr key={row.id}>
                      <td>{row.day
                        ? new Date(row.day + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                        : '—'}</td>
                      <th scope="row" className="cm-lead">
                        {row.leadName || 'Unnamed'}
                        <span className="cm-src" title="Logged by hand, not from a closed deal">
                          <PenLine className="w-3 h-3" /> logged
                        </span>
                      </th>
                      <td>{row.program || '—'}</td>
                      <td>{formatCurrency(row.dealValue)}</td>
                      <td className="cm-earned">{formatCurrency(row.commissionAmount)}</td>
                      <td>
                        {canSettle ? (
                          <select
                            className={'cm-status cm-status-pick ' + (row.status || 'pending')}
                            value={row.status || 'pending'}
                            disabled={statusBusy === row.id}
                            aria-label={'Commission status for the logged sale to ' + (row.leadName || 'this lead')}
                            onChange={function(e) { p.handleLoggedStatus(row.id, e.target.value); }}
                          >
                            <option value="pending">Pending</option>
                            <option value="approved">Approved</option>
                            <option value="paid">Paid</option>
                          </select>
                        ) : (
                          <span className={'cm-status ' + (row.status || 'pending')}>
                            {row.status === 'paid' ? <CheckCircle className="w-3 h-3" /> : null}
                            {row.status || 'pending'}
                          </span>
                        )}
                      </td>
                      <td>
                        {/* A paid-out row stays put. Removing the record of a
                            commission somebody has already been paid is not an
                            edit anybody needs. */}
                        {row.status === 'paid' ? null : (
                          <button type="button" className="cm-del"
                            disabled={statusBusy === row.id}
                            aria-label={'Remove the logged sale to ' + (row.leadName || 'this lead')}
                            onClick={function() { p.handleLoggedDelete(row); }}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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
                  <td />
                  <td>{formatCurrency(loggedSummary ? loggedSummary.totalRevenue : 0)}</td>
                  <td>{formatCurrency(loggedTotal)}</td>
                  <td />
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {logger}
      </div>

      {history.length > 0 ? (
        <div className="td-section">
          <div className="td-section-h">
            <h3 className="td-section-t">Every month</h3>
            <span className="td-section-rule" />
          </div>
          <div className="glass-card no-lift cm-history">
            {history.map(function(m) {
              var n = m.deals + m.logged;
              return (
                <button key={m.month} type="button"
                  className={'cm-hist-row' + (m.month === month ? ' on' : '')}
                  onClick={function() { setMonth(m.month); }}>
                  <span className="cm-hist-m">{formatMonth(m.month)}</span>
                  <span className="cm-hist-n">
                    {n} {n === 1 ? 'sale' : 'sales'}{m.logged > 0 ? ' · ' + m.logged + ' logged' : ''}
                  </span>
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

  // Every tile here is what the workspace owes, so it is closed deals plus the
  // hand-logged ledger. A rep whose sales were all logged by hand is owed just as
  // much as one whose deals came off a call, and leaving them out of the payout
  // figures is how somebody gets missed on a commission run.
  function teamTotal(key) {
    return allData.closers.reduce(function(sum, c) {
      var logged = c.data.loggedSummary || {};
      return sum + (c.data.summary[key] || 0) + (logged[key] || 0);
    }, 0);
  }
  var teamRevenue = teamTotal('totalRevenue');
  var teamCommission = teamTotal('totalCommission');
  var teamPending = teamTotal('pendingCommission');
  var teamPaid = teamTotal('paidCommission');

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
            var lg = c.data.loggedSummary || { totalDeals: 0, totalRevenue: 0, totalCommission: 0, pendingCommission: 0, paidCommission: 0 };
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
                    {lg.totalDeals > 0 ? <span>+{lg.totalDeals} logged</span> : null}
                    <span>{(s.commissionRate * 100).toFixed(0)}% rate</span>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-right">
                  <div>
                    <div className="text-xs text-crm-muted font-mono">Revenue</div>
                    <div className="text-sm font-mono text-crm-text-bright">{formatCurrency(s.totalRevenue + lg.totalRevenue)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-crm-muted font-mono">Earned</div>
                    <div className="text-sm font-mono metric-positive font-bold">{formatCurrency(s.totalCommission + lg.totalCommission)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-crm-muted font-mono">Pending</div>
                    <div className="text-sm font-mono text-crm-warning">{formatCurrency(s.pendingCommission + lg.pendingCommission)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-crm-muted font-mono">Paid</div>
                    <div className="text-sm font-mono text-crm-positive">{formatCurrency(s.paidCommission + lg.paidCommission)}</div>
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
