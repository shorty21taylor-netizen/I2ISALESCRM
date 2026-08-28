'use client';

import { useState, useEffect, useCallback } from 'react';
import { Trophy, DollarSign, TrendingUp, Users, Handshake, Crown, Medal } from 'lucide-react';
import { useWorkspace, withWorkspace, apiFetch } from '@/lib/workspace-client';
import { formatCurrency } from '@/lib/utils';
import EmptyState from '@/components/EmptyState';
import { toReportDay } from '@/lib/report-date';

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

var SORTS = [
  { id: 'cash', label: 'Cash' },
  { id: 'revenue', label: 'Revenue' },
  { id: 'closes', label: 'Closes' },
  { id: 'dials', label: 'Dials' },
];

function iso(d) { return toReportDay(d); }

function initials(name) {
  return (name || '?')
    .split(' ')
    .filter(Boolean)
    .map(function(w) { return w.charAt(0); })
    .join('')
    .substring(0, 2)
    .toUpperCase();
}

function ordinal(n) {
  return n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : n + 'th';
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
  var partner = (data && data.partner) || { reps: [], partners: [], totals: { cash: 0, deals: 0, reps: 0, partners: 0 } };

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
  var partnerLeaderCash = partner.reps.length ? Math.max.apply(null, partner.reps.map(function(r) { return r.cash; })) : 0;

  var params = getDateParams();
  var dateDisplay = params.start ? (params.start === params.end ? params.start : params.start + ' → ' + params.end) : 'All time';

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto bg-orbs relative">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 stagger-1 relative z-10">
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

      {/* Range + sort */}
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
            {SORTS.map(function(opt) {
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

      {/* Team totals — cash leads */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 relative z-10 stagger-3">
        <div className="glass-card glass-card-accent p-6 lg:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 rounded-lg" style={{ background: 'rgba(34,197,94,0.12)' }}>
              <DollarSign className="w-4 h-4" style={{ color: '#22c55e' }} />
            </div>
            <p className="text-xs font-mono uppercase tracking-wider text-crm-muted">Total Cash Collected</p>
          </div>
          <p className="cash-figure cash-figure-hero">{formatCurrency(totals.cash)}</p>
          <p className="text-xs font-mono text-crm-muted mt-3">
            across {totals.reps || 0} rep{totals.reps === 1 ? '' : 's'} · {totals.closes || 0} closes
          </p>
        </div>
        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 rounded-lg" style={{ background: 'rgba(34,197,94,0.1)' }}>
              <TrendingUp className="w-4 h-4" style={{ color: '#22c55e' }} />
            </div>
            <p className="text-xs font-mono uppercase tracking-wider text-crm-muted">Revenue</p>
          </div>
          <p className="revenue-figure" style={{ fontSize: '30px' }}>{formatCurrency(totals.revenue)}</p>
        </div>
        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 rounded-lg" style={{ background: 'rgba(var(--accent-rgb),0.1)' }}>
              <Users className="w-4 h-4" style={{ color: 'var(--crm-accent)' }} />
            </div>
            <p className="text-xs font-mono uppercase tracking-wider text-crm-muted">On The Board</p>
          </div>
          <p className="revenue-figure" style={{ fontSize: '30px' }}>{totals.reps || 0}</p>
        </div>
      </div>

      {/* Podium */}
      {podium.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative z-10 stagger-4 items-end">
          {podium.map(function(rep) {
            var isFirst = rep.rank === 1;
            var accent = isFirst ? '#f5b301' : rep.rank === 2 ? '#c4c4c4' : '#cd7f32';
            return (
              <div
                key={rep.name}
                className={'glass-card ' + (isFirst ? 'glass-card-accent p-7' : 'p-6')}
                style={isFirst ? { boxShadow: '0 0 44px rgba(34,197,94,0.10)' } : undefined}
              >
                <div className="flex items-center gap-3 mb-5">
                  <div
                    className={'avatar font-display ' + (isFirst ? 'avatar-lg' : 'avatar-md')}
                    style={{ color: accent, borderColor: accent + '55', background: accent + '1a' }}
                  >
                    {initials(rep.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {isFirst
                        ? <Crown className="w-3.5 h-3.5" style={{ color: accent }} />
                        : <Medal className="w-3.5 h-3.5" style={{ color: accent }} />}
                      <span className="text-[10px] font-mono uppercase tracking-[0.15em]" style={{ color: accent }}>
                        {ordinal(rep.rank)}
                      </span>
                    </div>
                    <p className={'font-display font-bold text-crm-text-bright truncate ' + (isFirst ? 'text-xl' : 'text-base')}>
                      {rep.name}
                    </p>
                  </div>
                </div>

                <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-crm-muted mb-2">Cash Collected</p>
                <p className={'cash-figure ' + (isFirst ? 'cash-figure-xl' : 'cash-figure-lg')}>
                  {formatCurrency(rep.cash)}
                </p>
                {rep.dealCash > 0 && rep.eodCash > 0 && (
                  <p className="text-[10px] font-mono text-crm-muted mt-1">
                    {'deals ' + formatCurrency(rep.dealCash) + ' · EOD ' + formatCurrency(rep.eodCash) + ' — counted once'}
                  </p>
                )}

                <div className="lb-bar mt-4">
                  <div className="lb-bar-fill" style={{ width: (leaderCash > 0 ? Math.round((rep.cash / leaderCash) * 100) : 0) + '%' }} />
                </div>

                <div className="flex items-center justify-between mt-4 pt-4 border-t" style={{ borderColor: 'var(--glass-surface-border)' }}>
                  <div>
                    <p className="text-[10px] font-mono uppercase text-crm-muted">Revenue</p>
                    <p className="revenue-figure mt-1" style={{ fontSize: '15px' }}>{formatCurrency(rep.revenue)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-mono uppercase text-crm-muted">Closes</p>
                    <p className="revenue-figure mt-1" style={{ fontSize: '15px' }}>{rep.closes}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-mono uppercase text-crm-muted">Close Rate</p>
                    <p className="revenue-figure mt-1" style={{ fontSize: '15px' }}>
                      {rep.eodCount > 0 ? rep.closeRate + '%' : '—'}
                    </p>
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
          <h3><Trophy className="w-4 h-4 text-crm-accent" /> Standings</h3>
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
          <div className="p-3 space-y-1">
            {sorted.map(function(rep) {
              var share = leaderCash > 0 ? Math.round((rep.cash / leaderCash) * 100) : 0;
              var isLeader = rep.rank === 1;
              return (
                <div key={rep.name} className={'lb-row ' + (isLeader ? 'lb-row-leader' : '')}>
                  <div className={'rank-circle ' + (isLeader ? 'rank-1' : 'rank-default')}>{rep.rank}</div>
                  <div className="avatar avatar-md text-crm-text font-display">{initials(rep.name)}</div>

                  <div className="flex-1 min-w-0">
                    <p className="font-display font-semibold text-crm-text-bright truncate">{rep.name}</p>
                    <div className="flex items-center gap-3 text-[11px] text-crm-muted font-mono mt-1 flex-wrap">
                      <span>{rep.closes} closes</span>
                      {rep.eodCount > 0 ? (
                        <>
                          <span>{(rep.dials || 0).toLocaleString()} dials</span>
                          <span>{rep.closeRate}% close rate</span>
                          <span>{rep.eodCount} EOD{rep.eodCount === 1 ? '' : 's'}</span>
                        </>
                      ) : (
                        <span>deals only — no EOD submitted</span>
                      )}
                    </div>
                    <div className="lb-bar mt-2 max-w-[320px]">
                      <div className="lb-bar-fill" style={{ width: share + '%' }} />
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <p className="text-[9px] font-mono uppercase tracking-[0.15em] text-crm-muted mb-1.5">Cash Collected</p>
                    <p className="cash-figure cash-figure-lg">{formatCurrency(rep.cash)}</p>
                    <p className="text-[11px] font-mono text-crm-muted mt-2">
                      revenue <span className="text-crm-text">{formatCurrency(rep.revenue)}</span>
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ===== PARTNER SALES — its own board ===== */}
      <div className="glass-card overflow-hidden relative z-10 stagger-6">
        <div className="section-header">
          <h3><Handshake className="w-4 h-4" style={{ color: '#a78bfa' }} /> Partner Sales</h3>
          <span className="section-tag">
            {partner.totals.deals} deal{partner.totals.deals === 1 ? '' : 's'}
            {partner.totals.partners > 0 ? ' · ' + partner.totals.partners + ' partner' + (partner.totals.partners === 1 ? '' : 's') : ''}
          </span>
        </div>

        {partner.reps.length === 0 ? (
          <EmptyState
            icon={Handshake}
            title="No partner sales in this range"
            subtitle='Deals submitted under a "Partner" program land here, split out by rep and brand'
          />
        ) : (
          <div>
            {/* Partner total + brand breakdown */}
            <div className="p-5 pb-4 flex flex-wrap items-end gap-x-8 gap-y-4 border-b" style={{ borderColor: 'var(--glass-surface-border)' }}>
              <div>
                <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-crm-muted mb-2">Partner Cash Collected</p>
                <p className="partner-figure cash-figure-xl">{formatCurrency(partner.totals.cash)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {partner.partners.map(function(b) {
                  return (
                    <div key={b.name} className="partner-chip">
                      <div>
                        <p className="text-xs font-display font-semibold text-crm-text-bright">{b.name}</p>
                        <p className="text-[10px] font-mono text-crm-muted mt-0.5">
                          {b.deals} deal{b.deals === 1 ? '' : 's'} · avg {formatCurrency(b.avgDealSize)}
                        </p>
                      </div>
                      <span className="partner-figure" style={{ fontSize: '17px' }}>{formatCurrency(b.cash)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Rep standings for partner deals */}
            <div className="p-3 space-y-1">
              {partner.reps.map(function(rep) {
                var share = partnerLeaderCash > 0 ? Math.round((rep.cash / partnerLeaderCash) * 100) : 0;
                return (
                  <div key={rep.name} className="lb-row">
                    <div className={'rank-circle ' + (rep.rank === 1 ? 'rank-1' : 'rank-default')}>{rep.rank}</div>
                    <div
                      className="avatar avatar-md font-display"
                      style={{ color: '#a78bfa', borderColor: 'rgba(167,139,250,0.35)', background: 'rgba(167,139,250,0.12)' }}
                    >
                      {initials(rep.name)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-display font-semibold text-crm-text-bright truncate">{rep.name}</p>
                      <div className="flex items-center gap-3 text-[11px] text-crm-muted font-mono mt-1 flex-wrap">
                        <span>{rep.deals} deal{rep.deals === 1 ? '' : 's'}</span>
                        <span>avg {formatCurrency(rep.avgDealSize)}</span>
                        {rep.topBrand && (
                          <span>
                            top: <span className="text-crm-text">{rep.topBrand}</span>
                            {rep.brandCount > 1 ? ' +' + (rep.brandCount - 1) : ''}
                          </span>
                        )}
                      </div>
                      <div className="lb-bar mt-2 max-w-[320px]">
                        <div className="lb-bar-fill lb-bar-fill-partner" style={{ width: share + '%' }} />
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <p className="text-[9px] font-mono uppercase tracking-[0.15em] text-crm-muted mb-1.5">Partner Cash</p>
                      <p className="partner-figure cash-figure-lg">{formatCurrency(rep.cash)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="text-[11px] font-mono text-crm-muted relative z-10 space-y-1 pb-2">
        <p>
          Cash is settled per day, in Pacific time, taking the higher of a rep&apos;s closed deals and
          their EOD cash so the same money is never counted twice — log both, the board
          settles it. Revenue uses the EOD &ldquo;Revenue on Day&rdquo;
          figure, falling back to that day&apos;s cash when it is left blank.
        </p>
        <p>
          Partner sales come from deals submitted under a &ldquo;Partner&rdquo; program. Those deals are
          also part of the standings above, so the two boards do not sum to a grand total.
        </p>
      </div>

    </div>
  );
}
