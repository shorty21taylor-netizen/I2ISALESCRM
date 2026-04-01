'use client';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { formatPercent } from '@/lib/utils';

var staggerMap = { 0: 'stagger-1', 50: 'stagger-2', 100: 'stagger-3', 150: 'stagger-4', 200: 'stagger-5', 250: 'stagger-6', 300: 'stagger-7', 350: 'stagger-8' };

export default function MetricCard({ label, value, trend, trendLabel, icon: Icon, accentColor = 'default', delay = 0 }) {
  var isPositive = trend > 0;
  var isNegative = trend < 0;

  var iconBgMap = {
    red: 'bg-crm-accent/10 text-crm-accent',
    green: 'bg-crm-positive/10 text-crm-positive',
    default: 'bg-white/5 text-crm-muted',
  };

  var glowMap = {
    red: 'glow-red',
    green: 'glow-green',
    default: '',
  };

  var staggerClass = staggerMap[delay] || 'stagger-1';

  return (
    <div className={'glass-card p-5 ' + staggerClass}>
      <div className="flex items-start justify-between mb-3">
        <div className={'p-2.5 rounded-xl ' + iconBgMap[accentColor] + ' ' + glowMap[accentColor]}>
          {Icon && <Icon className="w-5 h-5" />}
        </div>
        {trend !== undefined && trend !== null && (
          <div className={'flex items-center gap-1 font-mono text-xs ' + (isPositive ? 'metric-positive' : isNegative ? 'metric-negative' : 'text-crm-muted')}>
            {isPositive ? <TrendingUp className="w-3 h-3" /> : isNegative ? <TrendingDown className="w-3 h-3" /> : null}
            {formatPercent(trend)}
          </div>
        )}
      </div>
      <div className="font-display font-bold text-2xl text-crm-text-bright mb-1">{value}</div>
      <div className="text-xs font-mono text-crm-muted uppercase tracking-wider">{label}</div>
      {trendLabel && <div className="text-xs text-crm-muted mt-1">{trendLabel}</div>}
    </div>
  );
}
