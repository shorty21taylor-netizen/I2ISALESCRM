'use client';
import { useState, useEffect, useCallback } from 'react';
import { DollarSign, TrendingUp, Phone, PhoneIncoming, Trophy } from 'lucide-react';
import CloserLeaderboard from '@/components/CloserLeaderboard';
import RevenueChart from '@/components/RevenueChart';
import DialActivityChart from '@/components/DialActivityChart';
import EODTable from '@/components/EODTable';
import RecentCalls from '@/components/RecentCalls';
import PipelineSplit from '@/components/PipelineSplit';
import AIInsights from '@/components/AIInsights';
import ClientOnly from '@/components/ClientOnly';
import { formatCurrency } from '@/lib/utils';
import { teamOverview, closerPerformances, recentEODs, recentCalls, revenueByDay, dialsByCloser } from '@/lib/mock-data';

export default function DashboardPage() {
  var s2 = useState(null), liveData = s2[0], setLiveData = s2[1];
  var s3 = useState('today'), dateRange = s3[0], setDateRange = s3[1];
  var s4 = useState(''), customStart = s4[0], setCustomStart = s4[1];
  var s5 = useState(''), customEnd = s5[0], setCustomEnd = s5[1];
  var s6 = useState(''), lastFetch = s6[0], setLastFetch = s6[1];

  function getDateParams() {
    var today = new Date();
    var todayStr = today.toISOString().split('T')[0];

    if (dateRange === 'today') {
      return { start: todayStr, end: todayStr };
    }
    if (dateRange === 'yesterday') {
      var y = new Date(today);
      y.setDate(y.getDate() - 1);
      return { start: y.toISOString().split('T')[0], end: y.toISOString().split('T')[0] };
    }
    if (dateRange === '7d') {
      var d7 = new Date(today);
      d7.setDate(d7.getDate() - 6);
      return { start: d7.toISOString().split('T')[0], end: todayStr };
    }
    if (dateRange === '30d') {
      var d30 = new Date(today);
      d30.setDate(d30.getDate() - 29);
      return { start: d30.toISOString().split('T')[0], end: todayStr };
    }
    if (dateRange === '365d') {
      var d365 = new Date(today);
      d365.setDate(d365.getDate() - 364);
      return { start: d365.toISOString().split('T')[0], end: todayStr };
    }
    if (dateRange === 'custom' && customStart && customEnd) {
      return { start: customStart, end: customEnd };
    }
    return { start: todayStr, end: todayStr };
  }

  var fetchDashboard = useCallback(function() {
    var params = getDateParams();
    var qs = '?start=' + params.start + '&end=' + params.end;
    fetch('/api/dashboard' + qs)
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.success) {
          setLiveData(data);
          setLastFetch(new Date().toISOString());
        }
      })
      .catch(function(e) { console.error('Dashboard fetch error:', e); });
  }, [dateRange, customStart, customEnd]);

  useEffect(function() {
    fetchDashboard();
    var interval = setInterval(fetchDashboard, 30000);
    return function() { clearInterval(interval); };
  }, [fetchDashboard]);

  var displayOverview = liveData && liveData.overview ? liveData.overview : teamOverview;
  var t = displayOverview;
  var todayCash = t.todayCash || t.totalCash || 0;
  var todayCloses = t.todayCloses || t.totalCloses || 0;
  var todayDials = t.todayDials || t.totalDials || 0;

  var liveClosers = liveData && liveData.closers ? liveData.closers : closerPerformances;

  // Build live EOD data for the table from the API
  var liveEODReports = liveData && liveData.activity ? liveData.activity.filter(function(a) { return a.type === 'eod-report'; }) : [];
  var displayEODs = recentEODs.length > 0 ? recentEODs : [];

  var rangeLabel = (function() {
    if (dateRange === 'today') return 'Today';
    if (dateRange === 'yesterday') return 'Yesterday';
    if (dateRange === '7d') return '7 Days';
    if (dateRange === '30d') return '30 Days';
    if (dateRange === '365d') return 'Year';
    return 'Custom';
  })();

  var dateDisplay = (function() {
    var p = getDateParams();
    if (dateRange === 'today') return p.start;
    if (dateRange === 'yesterday') return p.start;
    return p.start + ' → ' + p.end;
  })();

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto bg-orbs relative">
      {/* Header */}
      <div className="flex items-center justify-between stagger-1 relative z-10">
        <div>
          <h1 className="font-display text-2xl font-bold text-crm-text-bright">Good afternoon, Anthony</h1>
          <p className="text-sm text-crm-muted mt-1">{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="live-indicator">
            <div className={liveData ? 'glow-dot-green' : 'w-1.5 h-1.5 rounded-full bg-crm-muted'} />
            <span className={liveData ? 'text-crm-positive' : 'text-crm-muted'}>{liveData ? 'Live' : 'Connecting...'}</span>
          </div>
          <div className="flex items-center gap-4 glass-surface px-4 py-2">
            <span className="text-xs font-mono text-crm-muted">{rangeLabel}: <span className="metric-value-green text-sm">{formatCurrency(todayCash)}</span></span>
            <span className="text-xs font-mono text-crm-muted">{todayCloses} closes</span>
            <span className="text-xs font-mono text-crm-muted">{todayDials} dials</span>
            <span className="text-xs font-mono text-crm-muted">{t.activeClosers || 0} closers</span>
            {liveData && liveData.counts ? (
              <span className="text-xs font-mono text-crm-accent">{liveData.counts.bookedCalls} total bookings</span>
            ) : null}
          </div>
        </div>
      </div>

      {/* ===== DATE RANGE PICKER ===== */}
      <div className="flex items-center justify-between relative z-10 stagger-2">
        <div className="glass-surface inline-flex rounded-xl p-1 gap-0.5">
          {[
            { id: 'today', label: 'Today' },
            { id: 'yesterday', label: 'Yesterday' },
            { id: '7d', label: '7 Days' },
            { id: '30d', label: '30 Days' },
            { id: '365d', label: 'Year' },
            { id: 'custom', label: 'Custom' },
          ].map(function(opt) {
            return (
              <button
                key={opt.id}
                onClick={function() { setDateRange(opt.id); }}
                className={dateRange === opt.id
                  ? 'px-3 py-1.5 rounded-lg text-xs font-display font-semibold bg-crm-accent/15 text-crm-accent transition-all duration-200'
                  : 'px-3 py-1.5 rounded-lg text-xs font-display font-medium text-crm-muted hover:text-crm-text transition-all duration-200'}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        <div className="text-xs font-mono text-crm-muted">
          {dateDisplay}
        </div>
      </div>

      {/* Custom date inputs */}
      {dateRange === 'custom' && (
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

      {/* 5 Core KPIs — no toggle, no pages */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-5 mb-6 relative z-10">

        {/* Cash Collected */}
        <div className="glass-card p-6 md:p-8">
          <div className="flex items-start justify-between mb-3 md:mb-4">
            <div className="p-2.5 md:p-3 rounded-xl" style={{ background: 'rgba(34,197,94,0.1)' }}>
              <DollarSign className="w-5 h-5 md:w-6 md:h-6" style={{ color: '#22c55e' }} />
            </div>
          </div>
          <p className="text-3xl md:text-4xl font-display font-bold" style={{ color: '#22c55e' }}>
            {formatCurrency(displayOverview.totalCash || displayOverview.totalRevenue || 0)}
          </p>
          <p className="text-xs md:text-sm font-mono uppercase tracking-wider mt-2" style={{ color: 'var(--crm-text-muted)' }}>
            Cash Collected
          </p>
        </div>

        {/* Revenue */}
        <div className="glass-card p-6 md:p-8">
          <div className="flex items-start justify-between mb-3 md:mb-4">
            <div className="p-2.5 md:p-3 rounded-xl" style={{ background: 'rgba(34,197,94,0.1)' }}>
              <TrendingUp className="w-5 h-5 md:w-6 md:h-6" style={{ color: '#22c55e' }} />
            </div>
          </div>
          <p className="text-3xl md:text-4xl font-display font-bold" style={{ color: '#22c55e' }}>
            {formatCurrency(displayOverview.totalRevenue || 0)}
          </p>
          <p className="text-xs md:text-sm font-mono uppercase tracking-wider mt-2" style={{ color: 'var(--crm-text-muted)' }}>
            Revenue
          </p>
        </div>

        {/* Outbound Dials */}
        <div className="glass-card p-6 md:p-8">
          <div className="flex items-start justify-between mb-3 md:mb-4">
            <div className="p-2.5 md:p-3 rounded-xl" style={{ background: 'rgba(220,38,38,0.1)' }}>
              <Phone className="w-5 h-5 md:w-6 md:h-6" style={{ color: '#dc2626' }} />
            </div>
          </div>
          <p className="text-3xl md:text-4xl font-display font-bold" style={{ color: 'var(--crm-text-bright)' }}>
            {(displayOverview.totalDials || 0).toLocaleString()}
          </p>
          <p className="text-xs md:text-sm font-mono uppercase tracking-wider mt-2" style={{ color: 'var(--crm-text-muted)' }}>
            Outbound Dials
          </p>
        </div>

        {/* Calls Taken */}
        <div className="glass-card p-6 md:p-8">
          <div className="flex items-start justify-between mb-3 md:mb-4">
            <div className="p-2.5 md:p-3 rounded-xl" style={{ background: 'rgba(59,130,246,0.1)' }}>
              <PhoneIncoming className="w-5 h-5 md:w-6 md:h-6" style={{ color: '#3b82f6' }} />
            </div>
          </div>
          <p className="text-3xl md:text-4xl font-display font-bold" style={{ color: 'var(--crm-text-bright)' }}>
            {displayOverview.totalCallsTaken || 0}
          </p>
          <p className="text-xs md:text-sm font-mono uppercase tracking-wider mt-2" style={{ color: 'var(--crm-text-muted)' }}>
            Calls Taken
          </p>
        </div>

        {/* Deals Closed */}
        <div className="glass-card p-6 md:p-8 col-span-2 md:col-span-1">
          <div className="flex items-start justify-between mb-3 md:mb-4">
            <div className="p-2.5 md:p-3 rounded-xl" style={{ background: 'rgba(245,158,11,0.1)' }}>
              <Trophy className="w-5 h-5 md:w-6 md:h-6" style={{ color: '#f59e0b' }} />
            </div>
          </div>
          <p className="text-3xl md:text-4xl font-display font-bold" style={{ color: '#f59e0b' }}>
            {displayOverview.totalCloses || 0}
          </p>
          <p className="text-xs md:text-sm font-mono uppercase tracking-wider mt-2" style={{ color: 'var(--crm-text-muted)' }}>
            Deals Closed
          </p>
        </div>

      </div>

      {/* Offer Breakdown */}
      {t.offerBreakdown && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative z-10 stagger-2">
          {[
            { key: 'saas', label: 'SaaS', subtitle: 'Fund2Grow', color: '#3b82f6', emoji: '💻' },
            { key: 'coaching', label: 'Coaching', subtitle: 'Digital Programs', color: '#8b5cf6', emoji: '🎯' },
            { key: 'dfy-funding', label: 'DFY Funding', subtitle: 'Inner Circle', color: '#f59e0b', emoji: '💰' },
          ].map(function(offer) {
            var data = t.offerBreakdown[offer.key] || { booked: 0, closes: 0, revenue: 0 };
            return (
              <div key={offer.key} className="glass-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{offer.emoji}</span>
                    <div>
                      <p className="text-sm font-display font-bold text-crm-text-bright">{offer.label}</p>
                      <p className="text-xs font-mono text-crm-muted">{offer.subtitle}</p>
                    </div>
                  </div>
                  <div className="w-3 h-3 rounded-full" style={{ background: offer.color, boxShadow: '0 0 8px ' + offer.color + '40' }} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="glass-surface p-3 rounded-lg text-center">
                    <p className="text-lg font-display font-bold text-crm-text-bright">{data.booked}</p>
                    <p className="text-[10px] font-mono text-crm-muted">BOOKED</p>
                  </div>
                  <div className="glass-surface p-3 rounded-lg text-center">
                    <p className="text-lg font-display font-bold text-crm-text-bright">{data.closes}</p>
                    <p className="text-[10px] font-mono text-crm-muted">CLOSES</p>
                  </div>
                  <div className="glass-surface p-3 rounded-lg text-center">
                    <p className="text-lg font-display font-bold" style={{ color: offer.color }}>{formatCurrency(data.revenue)}</p>
                    <p className="text-[10px] font-mono text-crm-muted">REVENUE</p>
                  </div>
                </div>
                {t.totalRevenue > 0 && (
                  <div className="mt-3">
                    <div className="progress-bar">
                      <div className="progress-fill" style={{
                        width: Math.round((data.revenue / t.totalRevenue) * 100) + '%',
                        background: offer.color,
                        boxShadow: '0 0 8px ' + offer.color + '40',
                      }} />
                    </div>
                    <p className="text-[10px] font-mono text-crm-muted mt-1">
                      {Math.round((data.revenue / t.totalRevenue) * 100)}% of total revenue
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Row 6 — Charts */}
      <div className="grid grid-cols-2 gap-4 relative z-10 stagger-3">
        <ClientOnly><RevenueChart data={revenueByDay} /></ClientOnly>
        <ClientOnly><DialActivityChart data={dialsByCloser} /></ClientOnly>
      </div>

      {/* Row 7 — Pipeline + Leaderboard */}
      <div className="grid grid-cols-3 gap-4 relative z-10 stagger-4">
        <PipelineSplit inboundRevenue={t.inboundRevenue || 0} outboundRevenue={t.outboundRevenue || 0} />
        <div className="col-span-2">
          <CloserLeaderboard data={liveClosers} />
        </div>
      </div>

      {/* Row 8 — EOD Table */}
      <div className="relative z-10 stagger-5"><EODTable reports={displayEODs} /></div>

      {/* Row 9 — Calls + Insights */}
      <div className="grid grid-cols-2 gap-4 relative z-10 stagger-6">
        <RecentCalls calls={recentCalls} />
        <AIInsights performances={liveClosers} />
      </div>

      {/* Footer */}
      <hr className="divider" />
      <div className="text-center text-xs text-crm-muted py-4">
        Summit CRM v1.0 &middot; Data refreshes every 30s
        {liveData && liveData.counts ? (
          <span className="ml-3 text-crm-muted/50">
            ({liveData.counts.bookedCalls} bookings, {liveData.counts.closedDeals} deals, {liveData.counts.eodReports} EODs)
          </span>
        ) : null}
      </div>
    </div>
  );
}
