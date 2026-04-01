'use client';
import { DollarSign, Target, Percent, Phone, TrendingUp, Users, ClipboardCheck, Zap, Calendar, UserCheck, Clock, Timer, CheckCircle, ShieldCheck } from 'lucide-react';
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
  var t = teamOverview;
  var todayCash = recentEODs.reduce(function(sum, e) { return sum + e.cashCollected; }, 0);
  var todayCloses = recentEODs.reduce(function(sum, e) { return sum + e.closes; }, 0);
  var todayDials = recentEODs.reduce(function(sum, e) { return sum + e.totalDials; }, 0);

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between stagger-1">
        <div>
          <h1 className="font-display text-2xl font-bold text-crm-text-bright">Good afternoon, Anthony</h1>
          <p className="text-sm text-crm-muted mt-1">March 31, 2026</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-crm-positive/10 border border-crm-positive/20">
            <div className="glow-dot-green" />
            <span className="text-xs font-mono text-crm-positive">n8n Connected</span>
          </div>
          <div className="flex items-center gap-4 glass-surface px-4 py-2">
            <span className="text-xs font-mono text-crm-muted">Today: <span className="metric-positive">{formatCurrency(todayCash)}</span></span>
            <span className="text-xs font-mono text-crm-muted">{todayCloses} closes</span>
            <span className="text-xs font-mono text-crm-muted">{todayDials} dials</span>
            <span className="text-xs font-mono text-crm-muted">{t.activeClosers} closers</span>
          </div>
        </div>
      </div>

      {/* Row 2 — Primary Revenue KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard label="Total Revenue" value={formatCurrency(t.totalRevenue)} trend={t.revenueTrend} icon={DollarSign} accentColor="red" delay={0} />
        <MetricCard label="Total Closes" value={t.totalCloses} trend={t.closesTrend} icon={Target} accentColor="red" delay={50} />
        <MetricCard label="Team Close Rate" value={t.teamCloseRate + '%'} trend={t.closeRateTrend} icon={Percent} accentColor="green" delay={100} />
        <MetricCard label="Total Dials" value={formatNumber(t.totalDials)} trend={t.dialsTrend} icon={Phone} accentColor="default" delay={150} />
      </div>

      {/* Row 3 — Pipeline Health KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard label="Booked This Week" value={t.bookedCallsThisWeek} trend={t.bookedCallsTrend} icon={Calendar} accentColor="default" delay={200} />
        <MetricCard label="Show Rate" value={t.showRate + '%'} trend={t.showRateTrend} icon={UserCheck} accentColor="default" delay={250} />
        <MetricCard label="Pipeline Value" value={formatCurrency(t.pipelineValue)} trend={t.pipelineValueTrend} icon={TrendingUp} accentColor="green" delay={300} />
        <MetricCard label="Avg Days to Close" value={t.avgDaysToClose} trend={t.daysToCloseTrend * -1} icon={Clock} accentColor="green" delay={350} trendLabel="faster closing" />
      </div>

      {/* Row 4 — Efficiency KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard label="Cash / Call Taken" value={formatCurrency(t.cashPerCallTaken)} trend={t.cashPerCallTrend} icon={Zap} accentColor="red" delay={0} />
        <MetricCard label="Offer Rate" value={t.offerRate + '%'} trend={t.offerRateTrend} icon={Target} accentColor="default" delay={50} />
        <MetricCard label="One-Call Close Rate" value={t.oneCallCloseRate + '%'} trend={t.oneCallCloseTrend} icon={CheckCircle} accentColor="green" delay={100} />
        <MetricCard label="Dials / Hour" value={t.avgDialsPerHour} trend={t.dialsPerHourTrend} icon={Timer} accentColor="default" delay={150} />
      </div>

      {/* Row 5 — Quality & Retention KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard label="Refund Rate" value={t.refundRate + '%'} trend={t.refundRateTrend * -1} icon={ShieldCheck} accentColor="green" delay={200} trendLabel="fewer refunds" />
        <MetricCard label="Net Revenue (30d)" value={formatCurrency(t.netRevenueRetained30d)} trend={t.netRetainedTrend} icon={DollarSign} accentColor="green" delay={250} />
        <MetricCard label="EOD Compliance" value={t.eodComplianceRate + '%'} icon={ClipboardCheck} accentColor="green" delay={300} />
        <MetricCard label="Avg Deal Value" value={formatCurrency(t.avgDealValue)} trend={t.dealValueTrend} icon={TrendingUp} delay={350} />
      </div>

      {/* Row 6 — Charts */}
      <div className="grid grid-cols-2 gap-4">
        <ClientOnly><RevenueChart data={revenueByDay} /></ClientOnly>
        <ClientOnly><DialActivityChart data={dialsByCloser} /></ClientOnly>
      </div>

      {/* Row 7 — Pipeline + Leaderboard */}
      <div className="grid grid-cols-3 gap-4">
        <PipelineSplit inboundRevenue={t.inboundRevenue} outboundRevenue={t.outboundRevenue} />
        <div className="col-span-2">
          <CloserLeaderboard data={closerPerformances} />
        </div>
      </div>

      {/* Row 8 — EOD Table */}
      <EODTable reports={recentEODs} />

      {/* Row 9 — Calls + Insights */}
      <div className="grid grid-cols-2 gap-4">
        <RecentCalls calls={recentCalls} />
        <AIInsights performances={closerPerformances} />
      </div>

      {/* Footer */}
      <hr className="divider" />
      <div className="text-center text-xs text-crm-muted py-4">
        Summit CRM v1.0 &middot; Data refreshes via n8n webhooks
      </div>
    </div>
  );
}
