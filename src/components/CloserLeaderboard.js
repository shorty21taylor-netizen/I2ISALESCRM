'use client';
import { TrendingUp, TrendingDown, Trophy } from 'lucide-react';
import { formatCurrency, formatPercent, getInitials } from '@/lib/utils';
import EmptyState from '@/components/EmptyState';

export default function CloserLeaderboard({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="glass-card overflow-hidden">
        <div className="section-header">
          <h3>Closer Leaderboard</h3>
          <span className="section-tag">0 closers</span>
        </div>
        <EmptyState icon={Trophy} title="No closer data yet" subtitle="Data will appear when closers submit their first reports" />
      </div>
    );
  }

  var sorted = data.filter(Boolean).slice().sort(function(a, b) {
    var aRev = a.totalRevenue || a.cash || a.revenue || 0;
    var bRev = b.totalRevenue || b.cash || b.revenue || 0;
    return bRev - aRev;
  });

  return (
    <div className="glass-card overflow-hidden">
      <div className="section-header">
        <h3>Closer Leaderboard</h3>
        <span className="section-tag">{sorted.length} closers</span>
      </div>
      <div className="px-4 py-3 space-y-1">
        {sorted.map(function(perf, idx) {
          if (!perf) return null;
          var name = (perf.closer && perf.closer.name) || perf.name || 'Unknown';
          var id = (perf.closer && perf.closer.id) || perf.name || idx;
          var rev = perf.totalRevenue || perf.cash || perf.revenue || 0;
          var dials = perf.totalDials || perf.dials || 0;
          var cr = perf.closeRate || (perf.callsTaken > 0 ? Math.round((perf.closes / perf.callsTaken) * 1000) / 10 : 0);
          var rpd = perf.revenuePerDial || (dials > 0 ? rev / dials : 0);
          var trend = perf.revenueTrend || 0;
          var rank = idx + 1;
          var isTop = rank === 1;
          return (
            <div key={id}>
              <div className={'flex items-center gap-3 p-3 rounded-xl transition-all duration-300 hover:bg-white/[0.03] ' + (isTop ? 'leaderboard-row-1 rounded-xl' : '')}>
                <div className={'rank-circle ' + (isTop ? 'rank-1' : 'rank-default')}>
                  {rank}
                </div>
                <div className={'avatar avatar-md ' + (isTop ? 'border-crm-accent/30 bg-crm-accent/10 text-crm-accent' : 'text-crm-text')}>
                  {getInitials(name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-crm-text-bright text-sm truncate">{name}</div>
                  <div className="flex items-center gap-3 text-xs text-crm-muted font-mono mt-0.5">
                    <span>Close {cr}%</span>
                    <span>{dials} dials</span>
                    <span>${rpd.toFixed(0)}/dial</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-display font-bold text-crm-text-bright">{formatCurrency(rev)}</div>
                  <div className={'flex items-center justify-end gap-1 text-xs font-mono ' + (trend > 0 ? 'metric-positive' : 'metric-negative')}>
                    {trend > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {formatPercent(trend)}
                  </div>
                </div>
              </div>
              {idx < sorted.length - 1 && <hr className="divider-subtle mx-3" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
