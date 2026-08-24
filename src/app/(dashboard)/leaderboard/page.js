'use client';

import { useState, useEffect, useCallback } from 'react';
import { Trophy, DollarSign, TrendingUp, Users, Phone, Medal } from 'lucide-react';
import { useWorkspace, withWorkspace, apiFetch } from '@/lib/workspace-client';
import { formatCurrency } from '@/lib/utils';
import EmptyState from '@/components/EmptyState';

var RANGES = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: '30d', label: '30 Days' },
  { id: 'quarter', label: 'Quarter' },
  { id: 'year', label: 'Year' },
  { id: 'all', label: 'All Time' },
  { id: 'custom', label: 'Custom' },
];

function iso(d) { return d.toISOString().split('T')[0]; }

function initials(name) {
  return (name || '?')
    .split(' ')
    .filter(Boolean)
    .map(function(w) { return w.charAt(0); })
    .join('')
    .substring(0, 2)
    .toUpperCase();
}

export default function LeaderboardPage() {
  var workspaceId = useWorkspace();
  var s1 = useState(null), data = s1[0], setData = s1[1];
  var s2 = useState(true), loading = s2[0], setLoading = s2[1];
  var s3 = useState('month'), range = s3[0], setRange = s3[1];
  var s4 = useState(''), customStart = s4[0], setCustomStart = s4[1];
  var s5 = useState(''), customEnd = s5[0], setCustomEnd = s5[1];
  var s6 = useState('cash'), sortBy = s6[0], setSortBy = s6[1];

  // Inclusive start/end for the selected range. Both null means all time.
  function getDateParams() {
    var today = new Date();
    var todayStr = iso(today);

    if (range === 'today') return { start: todayStr, end: todayStr };
    if (range === 'week') {
      var w = new Date(today);
      // Week starts Monday; Sunday (day 0) belongs to the week that just ended.
      var back = (w.getDay() + 6) % 7;
      w.setDate(w.getDate() - back);
      return { start: iso(w), end: todayStr };
    }
    if (range === 'month') {
      return { start: iso(new Date(today.getFullYear(), today.getMonth(), 1)), end: todayStr };
    }
    if (range === '30d') {
      var d30 = new Date(today);
      d30.setDate(d30.getDate() - 29);
      return { start: iso(d30), end: todayStr };
    }
    if (range === 'quarter') {
      var q = Math.floor(today.getMonth() / 3) * 3;
      return { start: iso(new Date(today.getFullYear(), q, 1)), end: todayStr };
    }
    if (range === 'year') {
      return { start: iso(new Date(today.getFullYear(), 0, 1)), end: todayStr };
    }
    if (range === 'custom' && customStart && customEnd) {
      return { start: customStart, end: customEnd };
    }
    return { start: null, end: null };
  }

  var fetchLeaderboard = useCallback(function() {
    if (!workspaceId) return; // wait for the active workspace to resolve client-side
    var p = getDateParams();
    var qs = [];
    if (p.start) qs.push('start=' + p.start);
    if (p.end) qs.push('end=' + p.end);
    var path = '/api/leaderboard' + (qs.length ? '?' + qs.join('&') : '');

    apiFetch(withWorkspace(path, workspaceId))
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (d.success) setData(d);
        setLoading(false);
      })
      .catch(function(e) {
        console.error('[Leaderboard] fetch error:', e);
        setLoading(false);
      });
  }, [range, customStart, customEnd, workspaceId]);

  useEffect(function() {
    fetchLeaderboard();
    var interval = setInterval(fetchLeaderboard, 30000);
    return function() { clearInterval(interval); };
  }, [fetchLeaderboard]);

  var reps = (data && data.reps) || [];
  var totals = (data && data.totals) || { cash: 0, revenue: 0, closes: 0, dials: 0, reps: 0 };

  // The API ranks by cash; re-sorting is presentation only, so the rank badge keeps
  // showing the rep's standing on cash collected.
  var sorted = reps.slice().sort(function(a, b) {
    if (sortBy === 'revenue') return b.revenue - a.revenue;
    if (sortBy === 'closes') return b.closes - a.closes;
    if (sortBy === 'dials') return b.dials - a.dials;
    return b.cash - a.cash;
  });

  var leaderCash = reps.length ? Math.max.apply(null, reps.map(function(r) { return r.cash; })) : 0;
  var podium = reps.slice(0, 3);

  var params = getDateParams();
  var dateDisplay = params.start ? (params.start === params.end ? params.start : params.start + ' → ' + params.end) : 'All time';

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto bg-orbs relative">

      {/* Header */}
      <div className="flex items-center justify-between stagger-1 relative z-10">
        <div>
          <h1 className="font-display text-2xl font-bold text-crm-text-bright flex items-center gap-2">
            <Trophy className="w-6 h-6 text-crm-accent" /> Leaderboard
          </h1>
          <p className="text-sm text-crm-muted mt-1">
            Every rep who submits a close or an EOD, ranked by cash collected
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="live-indicator">
            <div className={data ? 'glow-dot-green' : 'w-1.5 h-1.5 rounded-full bg-crm-muted'} />
            <span className={data ? 'text-crm-positive' : 'text-crm-muted'}>{data ? 'Live' : 'Connecting...'}</span>
          </div>
          <div className="text-xs font-mono text-crm-muted">{dateDisplay}</div>
        </div>
      </div>

      {/* Range picker */}
      <div className="flex items-center justify-between flex-wrap gap-3 relative z-10 stagger-2">
        <div className="glass-surface inline-flex rounded-xl p-1 gap-0.5 flex-wrap">
          {RANGES.map(function(opt) {
            return (
              <button
                key={opt.id}
                onClick={function() { setRange(opt.id); }}
                className={range === opt.id
                  ? 'px-3 py-1.5 rounded-lg text-xs font-display font-semibold bg-crm-accent/15 text-crm-accent transition-all duration-200'
                  : 'px-3 py-1.5 rounded-lg text-xs font-display font-medium text-crm-muted hover:text-crm-text transition-all duration-200'}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-crm-muted">Sort</span>
          <div className="glass-surface inline-flex rounded-xl p-1 gap-0.5">
            {[
              { id: 'cash', label: 'Cash' },
              { id: 'revenue', label: 'Revenue' },
              { id: 'closes', label: 'Closes' },
              { id: 'dials', label: 'Dials' },
            ].map(function(opt) {
              return (
                <button
                  key={opt.id}
                  onClick={function() { setSortBy(opt.id); }}
                  className={sortBy === opt.id
                    ? 'px-3 py-1.5 rounded-lg text-xs font-display font-semibold bg-crm-accent/15 text-crm-accent transition-all duration-200'
                    : 'px-3 py-1.5 rounded-lg text-xs font-display font-medium text-crm-muted hover:text-crm-text transition-all duration-200'}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {range === 'custom' && (
        <div className="flex items-center gap-3 relative z-10">
          <div className="flex items-center gap-2">
            <label className="text-xs font-mono text-crm-muted">From</label>
            <input
              type="date"
              value={customStart}
              onChange={function(e) { setCustomStart(e.target.value); }}
              className="input-field"
              style={{ width: '160px', fontSize: '12px', padding: '6px 10px' }}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-mono text-crm-muted">To</label>
            <input
              type="date"
              value={customEnd}
              onChange={function(e) { setCustomEnd(e.target.value); }}
              className="input-field"
              style={{ width: '160px', fontSize: '12px', padding: '6px 10px' }}
            />
          </div>
        </div>
      )}

      {/* Team totals */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 relative z-10 stagger-3">
        <div className="glass-card p-6">
          <div className="p-2.5 rounded-xl inline-flex mb-3" style={{ background: 'rgba(34,197,94,0.1)' }}>
            <DollarSign className="w-5 h-5" style={{ color: '#22c55e' }} />
          </div>
          <p className="text-3xl font-display font-bold" style={{ color: '#22c55e' }}>{formatCurrency(totals.cash)}</p>
          <p className="text-xs font-mono uppercase tracking-wider mt-2 text-crm-muted">Total Cash Collected</p>
        </div>
        <div className="glass-card p-6">
          <div className="p-2.5 rounded-xl inline-flex mb-3" style={{ background: 'rgba(34,197,94,0.1)' }}>
            <TrendingUp className="w-5 h-5" style={{ color: '#22c55e' }} />
          </div>
          <p className="text-3xl font-display font-bold" style={{ color: '#22c55e' }}>{formatCurrency(totals.revenue)}</p>
          <p className="text-xs font-mono uppercase tracking-wider mt-2 text-crm-muted">Total Revenue</p>
        </div>
        <div className="glass-card p-6">
          <div className="p-2.5 rounded-xl inline-flex mb-3" style={{ background: 'rgba(245,158,11,0.1)' }}>
            <Trophy className="w-5 h-5 text-crm-text-bright" />
          </div>
          <p className="text-3xl font-display font-bold text-crm-text-bright">{totals.closes || 0}</p>
          <p className="text-xs font-mono uppercase tracking-wider mt-2 text-crm-muted">Closes</p>
        </div>
        <div className="glass-card p-6">
          <div className="p-2.5 rounded-xl inline-flex mb-3" style={{ background: 'rgba(var(--accent-rgb),0.1)' }}>
            <Users className="w-5 h-5" style={{ color: 'var(--crm-accent)' }} />
          </div>
          <p className="text-3xl font-display font-bold text-crm-text-bright">{totals.reps || 0}</p>
          <p className="text-xs font-mono uppercase tracking-wider mt-2 text-crm-muted">Reps On The Board</p>
        </div>
      </div>

      {/* Podium */}
      {podium.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative z-10 stagger-4">
          {podium.map(function(rep) {
            var accent = rep.rank === 1 ? '#f59e0b' : rep.rank === 2 ? '#a3a3a3' : '#b45309';
            return (
              <div key={rep.name} className={'glass-card p-5 ' + (rep.rank === 1 ? 'glass-card-accent' : '')}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="avatar avatar-lg font-display" style={{ color: accent, borderColor: accent + '55', background: accent + '18' }}>
                    {initials(rep.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <Medal className="w-3.5 h-3.5" style={{ color: accent }} />
                      <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: accent }}>
                        {rep.rank === 1 ? '1st' : rep.rank === 2 ? '2nd' : '3rd'}
                      </span>
                    </div>
                    <p className="text-base font-display font-bold text-crm-text-bright truncate">{rep.name}</p>
                    {rep.email && <p className="text-[10px] font-mono text-crm-muted truncate">{rep.email}</p>}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="glass-surface p-3 rounded-xl text-center">
                    <p className="text-lg font-display font-bold" style={{ color: '#22c55e' }}>{formatCurrency(rep.cash)}</p>
                    <p className="text-[10px] font-mono uppercase text-crm-muted mt-0.5">Cash</p>
                  </div>
                  <div className="glass-surface p-3 rounded-xl text-center">
                    <p className="text-lg font-display font-bold text-crm-text-bright">{formatCurrency(rep.revenue)}</p>
                    <p className="text-[10px] font-mono uppercase text-crm-muted mt-0.5">Revenue</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Standings */}
      <div className="glass-card overflow-hidden relative z-10 stagger-5">
        <div className="section-header">
          <h3>Standings</h3>
          <span className="section-tag">{reps.length} {reps.length === 1 ? 'rep' : 'reps'}</span>
        </div>

        {loading && !data ? (
          <div className="p-8 text-center text-crm-muted text-sm font-mono">Loading leaderboard...</div>
        ) : reps.length === 0 ? (
          <EmptyState
            icon={Trophy}
            title="No submissions in this range"
            subtitle="Reps appear here as soon as they submit a closed deal or an EOD report"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] font-mono uppercase tracking-wider text-crm-muted">
                  <th className="text-left font-medium px-4 py-3 w-12">#</th>
                  <th className="text-left font-medium px-4 py-3">Rep</th>
                  <th className="text-right font-medium px-4 py-3">Cash Collected</th>
                  <th className="text-right font-medium px-4 py-3">Revenue</th>
                  <th className="text-right font-medium px-4 py-3">Closes</th>
                  <th className="text-right font-medium px-4 py-3">Dials</th>
                  <th className="text-right font-medium px-4 py-3">Close Rate</th>
                  <th className="text-right font-medium px-4 py-3">EODs</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--divider-color)' }}>
                {sorted.map(function(rep) {
                  var share = leaderCash > 0 ? Math.round((rep.cash / leaderCash) * 100) : 0;
                  var isTop = rep.rank === 1;
                  return (
                    <tr key={rep.name} className={'transition-colors hover:bg-white/[0.02] ' + (isTop ? 'leaderboard-row-1' : '')}>
                      <td className="px-4 py-3">
                        <div className={'rank-circle ' + (isTop ? 'rank-1' : 'rank-default')}>{rep.rank}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={'avatar avatar-md ' + (isTop ? 'text-crm-accent' : 'text-crm-text')}>
                            {initials(rep.name)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-display font-semibold text-crm-text-bright truncate">{rep.name}</p>
                            <div className="progress-bar mt-1" style={{ width: '120px' }}>
                              <div className="progress-fill progress-fill-green" style={{ width: share + '%' }} />
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-display font-bold" style={{ color: '#22c55e' }}>
                        {formatCurrency(rep.cash)}
                      </td>
                      <td className="px-4 py-3 text-right font-display font-bold text-crm-text-bright">
                        {formatCurrency(rep.revenue)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-crm-text">{rep.closes}</td>
                      <td className="px-4 py-3 text-right font-mono text-crm-text">{(rep.dials || 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-mono text-crm-text">{rep.closeRate}%</td>
                      <td className="px-4 py-3 text-right font-mono text-crm-muted">{rep.eodCount}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t" style={{ borderColor: 'var(--divider-color)' }}>
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3 text-xs font-mono uppercase tracking-wider text-crm-muted">Team total</td>
                  <td className="px-4 py-3 text-right font-display font-bold" style={{ color: '#22c55e' }}>{formatCurrency(totals.cash)}</td>
                  <td className="px-4 py-3 text-right font-display font-bold text-crm-text-bright">{formatCurrency(totals.revenue)}</td>
                  <td className="px-4 py-3 text-right font-mono text-crm-text">{totals.closes || 0}</td>
                  <td className="px-4 py-3 text-right font-mono text-crm-text">{(totals.dials || 0).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-mono text-crm-text">{totals.closeRate || 0}%</td>
                  <td className="px-4 py-3 text-right font-mono text-crm-muted">{totals.eodCount || 0}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <p className="text-[11px] font-mono text-crm-muted relative z-10 flex items-center gap-1.5">
        <Phone className="w-3 h-3" />
        Cash is settled per day, taking the higher of a rep&apos;s closed deals and their EOD
        cash so the same money is never counted twice. Revenue uses the EOD &ldquo;Revenue on Day&rdquo;
        figure, falling back to that day&apos;s cash when it is left blank.
      </p>

    </div>
  );
}
