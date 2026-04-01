'use client';
import { DollarSign, Target, Percent, Phone, TrendingUp, Users, ClipboardCheck, Zap } from 'lucide-react';
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
          </div>
        </div>
      </div>

      {/* Primary Metrics */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard label="Total Revenue" value={formatCurrency(t.totalRevenue)} trend={t.revenueTrend} icon={DollarSign} accentColor="red" delay={0} />
        <MetricCard label="Total Closes" value={t.totalCloses} trend={t.closesTrend} icon={Target} accentColor="red" delay={50} />
        <MetricCard label="Team Close Rate" value={t.teamCloseRate + '%'} trend={t.closeRateTrend} icon={Percent} accentColor="green" delay={100} />
        <MetricCard label="Total Dials" value={formatNumber(t.totalDials)} trend={t.dialsTrend} icon={Phone} accentColor="default" delay={150} />
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard label="Avg Deal Value" value={formatCurrency(t.avgDealValue)} trend={t.dealValueTrend} icon={TrendingUp} delay={200} />
        <MetricCard label="Active Closers" value={t.activeClosers} icon={Users} delay={250} />
        <MetricCard label="EOD Compliance" value={t.eodComplianceRate + '%'} icon={ClipboardCheck} accentColor="green" delay={300} />
        <MetricCard label="Revenue/Dial" value={'$' + (t.totalRevenue / t.totalDials).toFixed(2)} icon={Zap} delay={350} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-4">
        <ClientOnly><RevenueChart data={revenueByDay} /></ClientOnly>
        <ClientOnly><DialActivityChart data={dialsByCloser} /></ClientOnly>
      </div>

      {/* Pipeline + Leaderboard */}
      <div className="grid grid-cols-3 gap-4">
        <PipelineSplit inboundRevenue={t.inboundRevenue} outboundRevenue={t.outboundRevenue} />
        <div className="col-span-2">
          <CloserLeaderboard data={closerPerformances} />
        </div>
      </div>

      {/* EOD Table */}
      <EODTable reports={recentEODs} />

      {/* Calls + Insights */}
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
