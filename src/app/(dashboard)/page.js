'use client';
import { useState, useEffect } from 'react';
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
import { teamOverview, closerPerformances, recentEODs, recentCalls, revenueByDay, dialsByCloser } from '@/lib/mock-data';

export default function DashboardPage() {
  var s = useState('performance'), metricPage = s[0], setMetricPage = s[1];
  var s2 = useState(null), liveData = s2[0], setLiveData = s2[1];

  useEffect(function() {
    function fetchDashboard() {
      fetch('/api/dashboard')
        .then(function(r) { return r.json(); })
        .then(function(data) {
          if (data.success) {
            setLiveData(data);
          }
        })
        .catch(function(e) { console.error('Dashboard fetch error:', e); });
    }

    fetchDashboard();
    var interval = setInterval(fetchDashboard, 30000);
    return function() { clearInterval(interval); };
  }, []);

  var t = liveData && liveData.overview ? liveData.overview : teamOverview;
  var todayCash = t.todayCash || recentEODs.reduce(function(sum, e) { return sum + e.cashCollected; }, 0);
  var todayCloses = t.todayCloses || recentEODs.reduce(function(sum, e) { return sum + e.closes; }, 0);
  var todayDials = t.todayDials || recentEODs.reduce(function(sum, e) { return sum + e.totalDials; }, 0);

  // Build live EOD data for the table from the API
  var liveEODReports = liveData && liveData.activity ? liveData.activity.filter(function(a) { return a.type === 'eod-report'; }) : [];
  var displayEODs = recentEODs.length > 0 ? recentEODs : [];

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
            <span className="text-xs font-mono text-crm-muted">Today: <span className="metric-value-green text-sm">{formatCurrency(todayCash)}</span></span>
            <span className="text-xs font-mono text-crm-muted">{todayCloses} closes</span>
            <span className="text-xs font-mono text-crm-muted">{todayDials} dials</span>
            <span className="text-xs font-mono text-crm-muted">{t.activeClosers || 0} closers</span>
          </div>
        </div>
      </div>

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
            <MetricCard label="Total Revenue" value={formatCurrency(t.totalRevenue)} trend={t.revenueTrend} trendLabel="vs prev 30d" icon={DollarSign} accentColor="red" delay={0} />
            <MetricCard label="Total Closes" value={formatNumber(t.totalCloses)} trend={t.closesTrend} trendLabel="vs prev 30d" icon={Target} accentColor="green" delay={50} />
            <MetricCard label="Team Close Rate" value={t.teamCloseRate + '%'} trend={t.closeRateTrend} icon={Percent} delay={100} />
            <MetricCard label="Total Dials" value={formatNumber(t.totalDials)} trend={t.dialsTrend} icon={Phone} delay={150} />
            <MetricCard label="Avg Deal Value" value={formatCurrency(t.avgDealValue)} trend={t.dealValueTrend} icon={TrendingUp} delay={200} />
            <MetricCard label="Cash / Call Taken" value={formatCurrency(t.cashPerCallTaken)} trend={t.cashPerCallTrend} icon={Zap} accentColor="red" delay={250} />
            <MetricCard label="One-Call Close Rate" value={t.oneCallCloseRate + '%'} trend={t.oneCallCloseTrend} icon={CheckCircle} accentColor="green" delay={300} />
            <MetricCard label="Offer Rate" value={t.offerRate + '%'} trend={t.offerRateTrend} icon={Target} delay={350} />
          </>
        ) : (
          <>
            <MetricCard label="Booked This Week" value={String(t.bookedCallsThisWeek)} trend={t.bookedCallsTrend} icon={Calendar} delay={0} />
            <MetricCard label="Show Rate" value={t.showRate + '%'} trend={t.showRateTrend} icon={UserCheck} delay={50} />
            <MetricCard label="Pipeline Value" value={formatCurrency(t.pipelineValue)} trend={t.pipelineValueTrend} icon={TrendingUp} accentColor="green" delay={100} />
            <MetricCard label="Avg Days to Close" value={String(t.avgDaysToClose)} trend={t.daysToCloseTrend ? t.daysToCloseTrend * -1 : 0} trendLabel="faster closing" icon={Clock} accentColor="green" delay={150} />
            <MetricCard label="Refund Rate" value={t.refundRate + '%'} trend={t.refundRateTrend ? t.refundRateTrend * -1 : 0} trendLabel="fewer refunds" icon={ShieldCheck} accentColor="green" delay={200} />
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

      {/* Row 6 — Charts */}
      <div className="grid grid-cols-2 gap-4 relative z-10 stagger-3">
        <ClientOnly><RevenueChart data={revenueByDay} /></ClientOnly>
        <ClientOnly><DialActivityChart data={dialsByCloser} /></ClientOnly>
      </div>

      {/* Row 7 — Pipeline + Leaderboard */}
      <div className="grid grid-cols-3 gap-4 relative z-10 stagger-4">
        <PipelineSplit inboundRevenue={t.inboundRevenue || 0} outboundRevenue={t.outboundRevenue || 0} />
        <div className="col-span-2">
          <CloserLeaderboard data={closerPerformances} />
        </div>
      </div>

      {/* Row 8 — EOD Table */}
      <div className="relative z-10 stagger-5"><EODTable reports={displayEODs} /></div>

      {/* Row 9 — Calls + Insights */}
      <div className="grid grid-cols-2 gap-4 relative z-10 stagger-6">
        <RecentCalls calls={recentCalls} />
        <AIInsights performances={closerPerformances} />
      </div>

      {/* Footer */}
      <hr className="divider" />
      <div className="text-center text-xs text-crm-muted py-4">
        Summit CRM v1.0 &middot; Data refreshes every 30s via n8n webhooks
        {liveData && liveData.counts ? (
          <span className="ml-3 text-crm-muted/50">
            ({liveData.counts.bookedCalls} bookings, {liveData.counts.closedDeals} deals, {liveData.counts.eodReports} EODs)
          </span>
        ) : null}
      </div>
    </div>
  );
}
