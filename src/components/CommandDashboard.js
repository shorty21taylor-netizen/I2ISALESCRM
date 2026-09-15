'use client';

import { DollarSign, CalendarCheck, Trophy, UserCheck, UserX, Target, Receipt, Building2 } from 'lucide-react';

// The company across every workspace at once, in the order the question is
// usually asked: how much came in, how many calls did we get, how many did we
// close — then why.

function money(n) {
  return (Number(n) || 0).toLocaleString('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  });
}

function count(n) {
  return (Number(n) || 0).toLocaleString('en-US');
}

// A rate is null when the question cannot be answered — nothing was on the
// calendar, nobody has filed an EOD yet. Printing 0% there reads as a catastrophe
// rather than as silence, so it prints a dash and says so on hover.
function pct(v) {
  if (v === null || v === undefined) return '—';
  return v + '%';
}

function untracked(v) {
  return (v === null || v === undefined) ? 'Not enough reported yet to work this out' : undefined;
}

function Tile({ icon: Icon, label, value, sub, accent, title }) {
  return (
    <div className={accent ? 'glass-card-accent p-4 md:p-5' : 'glass-card p-4 md:p-5'} title={title}>
      <div className="flex items-center justify-between mb-3">
        <div className={accent ? 'icon-box-accent' : 'icon-box-default'}><Icon className="w-5 h-5" /></div>
        {sub ? <span className="text-[10px] font-mono text-crm-muted uppercase tracking-wider">{sub}</span> : null}
      </div>
      <div className={(accent ? 'metric-value-accent' : 'metric-value') + ' text-2xl md:text-3xl mb-1'}>{value}</div>
      <div className="text-[10px] md:text-xs font-mono text-crm-muted uppercase tracking-wider">{label}</div>
    </div>
  );
}

export default function CommandDashboard({ metrics, rangeLabel }) {
  if (!metrics) {
    return (
      <div className="glass-card p-8 text-center text-sm text-crm-muted">Loading company numbers…</div>
    );
  }

  var t = metrics.totals || {};
  var rows = (metrics.workspaces || []).filter(function (r) {
    // A workspace with no activity at all in the range is noise on this table.
    return r.cashCollected > 0 || r.closes > 0 || r.callsBooked > 0 || r.onCalendar > 0;
  });

  return (
    <div className="space-y-4 md:space-y-6">

      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <h2 className="font-display text-base md:text-lg font-bold text-crm-text-bright">
          Company &mdash; every workspace
        </h2>
        <span className="text-[11px] font-mono text-crm-muted uppercase tracking-wider">
          {rangeLabel || 'Today'} &middot; {metrics.workspacesActive} of {metrics.workspacesTotal} active
        </span>
      </div>

      {/* The three that get asked first. */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
        <Tile icon={DollarSign} label="Cash Collected" value={money(t.cashCollected)}
          sub={count(t.dealsFiled) + ' filed'} accent />
        <Tile icon={CalendarCheck} label="Calls Booked" value={count(t.callsBooked)}
          sub={count(t.onCalendar) + ' on calendar'} />
        <Tile icon={Trophy} label="Closes" value={count(t.closes)}
          sub={t.avgDeal === null ? 'no closes yet' : money(t.avgDeal) + ' avg'} />
      </div>

      {/* Why the top row looks the way it does. */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
        <Tile icon={UserCheck} label="Show Rate" value={pct(t.showRate)}
          sub={count(t.taken) + ' of ' + count(t.onCalendar)} title={untracked(t.showRate)} />
        <Tile icon={UserX} label="No-Shows" value={count(t.noShowed)}
          sub={pct(t.noShowRate) + ' of calendar'} title={untracked(t.noShowRate)} />
        <Tile icon={Target} label="Close Rate" value={pct(t.closeRate)}
          sub={count(t.closes) + ' of ' + count(t.taken) + ' taken'} title={untracked(t.closeRate)} />
        <Tile icon={Receipt} label="Avg Deal Size" value={t.avgDeal === null ? '—' : money(t.avgDeal)}
          sub={t.cashPerBookedCall === null ? '' : money(t.cashPerBookedCall) + ' per booked call'} />
      </div>

      {t.duplicatesRemoved > 0 ? (
        <p className="text-[11px] text-crm-muted">
          {count(t.duplicatesRemoved)} duplicate {t.duplicatesRemoved === 1 ? 'deal was' : 'deals were'} filed
          twice and counted once. Cash above is the deduped figure.
        </p>
      ) : null}

      {/* ---- per workspace ---- */}
      <div className="glass-card overflow-hidden">
        <div className="section-header">
          <h3><Building2 className="w-4 h-4 text-crm-accent" /> By Workspace</h3>
          <span className="section-tag">{rows.length} with activity</span>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Workspace</th>
                <th className="text-right">Cash</th>
                <th className="text-right">Booked</th>
                <th className="text-right">Taken</th>
                <th className="text-right">Show</th>
                <th className="text-right">Closes</th>
                <th className="text-right">Close Rate</th>
                <th className="text-right">Avg Deal</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(function (r) {
                return (
                  <tr key={r.workspaceId}>
                    <td className="text-sm font-medium text-crm-text-bright">{r.name}</td>
                    <td className="text-right font-mono text-crm-text-bright">{money(r.cashCollected)}</td>
                    <td className="text-right font-mono text-crm-text">{count(r.callsBooked)}</td>
                    <td className="text-right font-mono text-crm-text">{count(r.taken)}</td>
                    <td className="text-right font-mono text-crm-muted" title={untracked(r.showRate)}>{pct(r.showRate)}</td>
                    <td className="text-right font-mono text-crm-text">{count(r.closes)}</td>
                    <td className="text-right font-mono text-crm-muted" title={untracked(r.closeRate)}>{pct(r.closeRate)}</td>
                    <td className="text-right font-mono text-crm-muted">{r.avgDeal === null ? '—' : money(r.avgDeal)}</td>
                  </tr>
                );
              })}
              {rows.length > 0 ? (
                <tr>
                  <td className="font-display font-bold text-crm-text-bright">Company</td>
                  <td className="text-right font-mono font-bold text-crm-text-bright">{money(t.cashCollected)}</td>
                  <td className="text-right font-mono font-bold text-crm-text-bright">{count(t.callsBooked)}</td>
                  <td className="text-right font-mono font-bold text-crm-text-bright">{count(t.taken)}</td>
                  <td className="text-right font-mono font-bold text-crm-text-bright">{pct(t.showRate)}</td>
                  <td className="text-right font-mono font-bold text-crm-text-bright">{count(t.closes)}</td>
                  <td className="text-right font-mono font-bold text-crm-text-bright">{pct(t.closeRate)}</td>
                  <td className="text-right font-mono font-bold text-crm-text-bright">{t.avgDeal === null ? '—' : money(t.avgDeal)}</td>
                </tr>
              ) : (
                <tr>
                  <td colSpan={8} className="text-center text-sm text-crm-muted py-8">
                    Nothing filed in this range yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
