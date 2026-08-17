'use client';
import { useState, useEffect, useCallback } from 'react';
import { DollarSign, Target, Percent, Phone, TrendingUp, ClipboardCheck, Zap, Calendar, UserCheck, Clock, Timer, CheckCircle, ShieldCheck } from 'lucide-react';
import MetricCard from '@/components/MetricCard';
import CloserLeaderboard from '@/components/CloserLeaderboard';
import RevenueChart from '@/components/RevenueChart';
import DialActivityChart from '@/components/DialActivityChart';
import EODTable from '@/components/EODTable';
import RecentCalls from '@/components/RecentCalls';
import PipelineSplit from '@/components/PipelineSplit';
import AIInsights from '@/components/AIInsights';
import ClientOnly from '@/components/ClientOnly';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { useWorkspace, withWorkspace } from '@/lib/workspace-client';
import { teamOverview, closerPerformances, recentEODs, recentCalls, revenueByDay, dialsByCloser } from '@/lib/mock-data';

export default function DashboardPage() {
  var s = useState('performance'), metricPage = s[0], setMetricPage = s[1];
  var s2 = useState(null), liveData = s2[0], setLiveData = s2[1];
  var s3 = useState('30d'), dateRange = s3[0], setDateRange = s3[1];
  var s4 = useState(''), customStart = s4[0], setCustomStart = s4[1];
  var s5 = useState(''), customEnd = s5[0], setCustomEnd = s5[1];
  var s6 = useState(''), lastFetch = s6[0], setLastFetch = s6[1];
  var workspaceId = useWorkspace();

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
    if (!workspaceId) return; // wait for the active workspace to resolve client-side
    var params = getDateParams();
    var qs = '?start=' + params.start + '&end=' + params.end;
    fetch(withWorkspace('/api/dashboard' + qs, workspaceId))
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.success) {
          setLiveData(data);
          setLastFetch(new Date().toISOString());
        }
      })
      .catch(function(e) { console.error('Dashboard fetch error:', e); });
  }, [dateRange, customStart, customEnd, workspaceId]);

  useEffect(function() {
    fetchDashboard();
    var interval = setInterval(fetchDashboard, 30000);
    return function() { clearInterval(interval); };
  }, [fetchDashboard]);

  var displayOverview = liveData && liveData.overview ? liveData.overview : teamOverview;
  var t = displayOverview;
  var todayCash = t.totalRevenue || t.totalCash || 0;
  var todayCloses = t.totalCloses || 0;
  var todayDials = t.totalDials || 0;

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
    <div className="px-4 md:px-6 py-4 md:py-6 space-y-4 md:space-y-6 max-w-[1600px] mx-auto bg-orbs relative">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 stagger-1 relative z-10">
        <div>
          <h1 className="font-display text-xl md:text-2xl font-bold text-crm-text-bright">Good afternoon, Anthony</h1>
          <p className="text-xs md:text-sm text-crm-muted mt-1">{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:gap-4">
          <div className="live-indicator">
            <div className={liveData ? 'glow-dot-green' : 'w-1.5 h-1.5 rounded-full bg-crm-muted'} />
            <span className={liveData ? 'text-crm-positive' : 'text-crm-muted'}>{liveData ? 'Live' : 'Connecting...'}</span>
          </div>
          <div className="hidden md:flex items-center gap-4 glass-surface px-4 py-2">
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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 relative z-10 stagger-2">
        <div className="glass-surface inline-flex flex-wrap rounded-xl p-1 gap-0.5">
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

      {/* ===== METRIC PAGE TOGGLE ===== */}
      <div className="flex items-center justify-center relative z-10">
        <div className="glass-surface inline-flex rounded-xl p-1">
          <button
            onClick={function() { setMetricPage('performance'); }}
            className={metricPage === 'performance'
              ? 'px-5 py-2 rounded-lg text-sm font-display font-semibold bg-crm-accent/15 text-crm-accent transition-all duration-300'
              : 'px-5 py-2 rounded-lg text-sm font-display font-medium text-crm-muted hover:text-crm-text transition-all duration-300'}
          >
            Performance
          </button>
          <button
            onClick={function() { setMetricPage('pipeline'); }}
            className={metricPage === 'pipeline'
              ? 'px-5 py-2 rounded-lg text-sm font-display font-semibold bg-crm-accent/15 text-crm-accent transition-all duration-300'
              : 'px-5 py-2 rounded-lg text-sm font-display font-medium text-crm-muted hover:text-crm-text transition-all duration-300'}
          >
            Pipeline &amp; Health
          </button>
        </div>
      </div>

      {/* ===== KPI CARDS — 8 at a time ===== */}
      <div key={metricPage} className="grid grid-cols-2 md:grid-cols-4 gap-4 relative z-10">
        {metricPage === 'performance' ? (
          <>
            <MetricCard label="Total Revenue" value={formatCurrency(t.totalRevenue)} trend={t.revenueTrend} trendLabel="vs prev 30d" icon={DollarSign} accentColor="accent" delay={0} />
            <MetricCard label="Total Closes" value={formatNumber(t.totalCloses)} trend={t.closesTrend} trendLabel="vs prev 30d" icon={Target} accentColor="green" delay={50} />
            <MetricCard label="Close Rate" value={t.teamCloseRate + '%'} trend={t.closeRateTrend} icon={Percent} delay={100} />
            <MetricCard label="Total Dials" value={formatNumber(t.totalDials)} trend={t.dialsTrend} icon={Phone} delay={150} />
            <MetricCard label="Avg Deal Value" value={formatCurrency(t.avgDealValue)} trend={t.dealValueTrend} icon={TrendingUp} delay={200} />
            <MetricCard label="Cash / Call Taken" value={formatCurrency(t.cashPerCallTaken)} trend={t.cashPerCallTrend} icon={Zap} accentColor="accent" delay={250} />
            <MetricCard label="Dial → Book" value={t.dialToBookRate + '%'} icon={Phone} accentColor="green" delay={300} />
            <MetricCard label="Offer Rate" value={t.offerRate + '%'} trend={t.offerRateTrend} icon={Target} delay={350} />
          </>
        ) : (
          <>
            <MetricCard label="Booked This Week" value={String(t.bookedCallsThisWeek)} trend={t.bookedCallsTrend} icon={Calendar} delay={0} />
            <MetricCard label="Show Rate" value={t.showRate + '%'} trend={t.showRateTrend} icon={UserCheck} delay={50} />
            <MetricCard label="Pipeline Value" value={formatCurrency(t.pipelineValue)} trend={t.pipelineValueTrend} icon={TrendingUp} accentColor="green" delay={100} />
            <MetricCard label="Avg Days to Close" value={String(t.avgDaysToClose)} trend={t.daysToCloseTrend ? t.daysToCloseTrend * -1 : 0} trendLabel="faster closing" icon={Clock} accentColor="green" delay={150} />
            <MetricCard label="Overall Conv." value={t.overallConversion + '%'} icon={TrendingUp} delay={200} />
            <MetricCard label="Net Revenue (30d)" value={formatCurrency(t.netRevenueRetained30d)} trend={t.netRetainedTrend} icon={DollarSign} accentColor="green" delay={250} />
            <MetricCard label="EOD Compliance" value={t.eodComplianceRate + '%'} icon={ClipboardCheck} accentColor="green" delay={300} />
            <MetricCard label="Dials / Hour" value={String(t.avgDialsPerHour)} trend={t.dialsPerHourTrend} icon={Timer} delay={350} />
          </>
        )}
      </div>

      {/* ===== PAGE INDICATOR DOTS ===== */}
      <div className="flex items-center justify-center gap-2 relative z-10">
        <div style={{ transition: 'all 0.3s ease' }} className={metricPage === 'performance' ? 'w-6 h-1.5 rounded-full bg-crm-accent' : 'w-1.5 h-1.5 rounded-full bg-crm-muted/30'} />
        <div style={{ transition: 'all 0.3s ease' }} className={metricPage === 'pipeline' ? 'w-6 h-1.5 rounded-full bg-crm-accent' : 'w-1.5 h-1.5 rounded-full bg-crm-muted/30'} />
      </div>

      {/* Offer Breakdown — 5 offers */}
      {t.offerBreakdown && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 md:gap-4 relative z-10 stagger-2">
          {Object.values(t.offerBreakdown).map(function(b) {
            var totalRev = t.totalRevenue || 0;
            var pct = totalRev > 0 ? Math.round((b.revenue / totalRev) * 100) : 0;
            return (
              <div key={b.key} className="glass-card p-4 overflow-hidden">
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-display font-bold truncate" style={{ color: 'var(--crm-text-bright)' }}>{b.label}</p>
                    <p className="text-[10px] font-mono uppercase truncate" style={{ color: 'var(--crm-text-muted)' }}>{b.subtitle}</p>
                  </div>
                  <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1" style={{ background: b.color, boxShadow: '0 0 8px rgba(var(--accent-rgb),0.5)' }} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center">
                    <p className="text-base font-display font-bold" style={{ color: 'var(--crm-text-bright)' }}>{b.booked}</p>
                    <p className="text-[9px] font-mono uppercase" style={{ color: 'var(--crm-text-muted)' }}>Booked</p>
                  </div>
                  <div className="text-center">
                    <p className="text-base font-display font-bold" style={{ color: 'var(--crm-text-bright)' }}>{b.closes}</p>
                    <p className="text-[9px] font-mono uppercase" style={{ color: 'var(--crm-text-muted)' }}>Closes</p>
                  </div>
                  <div className="text-center">
                    <p className="text-base font-display font-bold" style={{ color: b.color }}>{formatCurrency(b.revenue)}</p>
                    <p className="text-[9px] font-mono uppercase" style={{ color: 'var(--crm-text-muted)' }}>Revenue</p>
                  </div>
                </div>
                <div className="mt-3 pt-2" style={{ borderTop: '0.5px solid var(--crm-divider)' }}>
                  <p className="text-[10px] font-mono text-center" style={{ color: 'var(--crm-text-muted)' }}>{pct}% of total revenue</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Row 6 — Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10 stagger-3">
        <ClientOnly><RevenueChart data={revenueByDay} /></ClientOnly>
        <ClientOnly><DialActivityChart data={dialsByCloser} /></ClientOnly>
      </div>

      {/* Row 7 — Pipeline + Leaderboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative z-10 stagger-4">
        <PipelineSplit inboundRevenue={t.inboundRevenue || 0} outboundRevenue={t.outboundRevenue || 0} paymentBreakdown={t.paymentBreakdown} />
        <div className="md:col-span-2">
          <CloserLeaderboard data={liveClosers} />
        </div>
      </div>

      {/* Row 8 — EOD Table */}
      <div className="relative z-10 stagger-5"><EODTable reports={displayEODs} /></div>

      {/* Row 9 — Calls + Insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10 stagger-6">
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
