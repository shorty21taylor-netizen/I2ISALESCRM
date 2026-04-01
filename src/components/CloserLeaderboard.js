'use client';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { formatCurrency, formatPercent, getInitials } from '@/lib/utils';

export default function CloserLeaderboard({ data }) {
  var sorted = data.slice().sort(function(a, b) { return b.totalRevenue - a.totalRevenue; });

  return (
    <div className="glass-card overflow-hidden">
      <div className="section-header">
        <h3>Closer Leaderboard</h3>
        <span className="section-tag">{sorted.length} closers</span>
      </div>
      <div className="px-4 py-3 space-y-1">
        {sorted.map(function(perf, idx) {
          var rank = idx + 1;
          var isTop = rank === 1;
          return (
            <div key={perf.closer.id}>
              <div className={'flex items-center gap-3 p-3 rounded-xl transition-all duration-300 hover:bg-white/[0.03] ' + (isTop ? 'leaderboard-row-1 rounded-xl' : '')}>
                <div className={'rank-circle ' + (isTop ? 'rank-1' : 'rank-default')}>
                  {rank}
                </div>
                <div className={'avatar avatar-md ' + (isTop ? 'border-crm-accent/30 bg-crm-accent/10 text-crm-accent' : 'text-crm-text')}>
                  {getInitials(perf.closer.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-crm-text-bright text-sm truncate">{perf.closer.name}</div>
                  <div className="flex items-center gap-3 text-xs text-crm-muted font-mono mt-0.5">
                    <span>Close {perf.closeRate}%</span>
                    <span>{perf.totalDials} dials</span>
                    <span>${perf.revenuePerDial.toFixed(0)}/dial</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-display font-bold text-crm-text-bright">{formatCurrency(perf.totalRevenue)}</div>
                  <div className={'flex items-center justify-end gap-1 text-xs font-mono ' + (perf.revenueTrend > 0 ? 'metric-positive' : 'metric-negative')}>
                    {perf.revenueTrend > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {formatPercent(perf.revenueTrend)}
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
