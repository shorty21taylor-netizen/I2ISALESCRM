'use client';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { formatCurrency, formatPercent, getInitials } from '@/lib/utils';

export default function CloserLeaderboard({ data }) {
  const sorted = [...data].sort((a, b) => b.totalRevenue - a.totalRevenue);

  return (
    <div className="glass-card p-5">
      <h3 className="text-sm font-mono text-crm-muted uppercase tracking-wider mb-4">Closer Leaderboard</h3>
      <div className="space-y-3">
        {sorted.map((perf, idx) => {
          const rank = idx + 1;
          const isTop = rank === 1;
          return (
            <div key={perf.closer.id} className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-mono font-bold ${isTop ? 'bg-crm-accent/20 text-crm-accent' : 'bg-white/5 text-crm-muted'}`}>
                #{rank}
              </div>
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${isTop ? 'bg-crm-accent/10 text-crm-accent' : 'bg-white/5 text-crm-text'}`}>
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
                <div className={`flex items-center justify-end gap-1 text-xs font-mono ${perf.revenueTrend > 0 ? 'text-crm-positive' : 'text-crm-negative'}`}>
                  {perf.revenueTrend > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {formatPercent(perf.revenueTrend)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
