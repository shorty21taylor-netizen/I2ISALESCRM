'use client';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { formatPercent } from '@/lib/utils';

var staggerMap = { 0: 'stagger-1', 50: 'stagger-2', 100: 'stagger-3', 150: 'stagger-4', 200: 'stagger-5', 250: 'stagger-6', 300: 'stagger-7', 350: 'stagger-8' };

export default function MetricCard({ label, value, trend, trendLabel, icon: Icon, accentColor = 'default', delay = 0 }) {
  var isPositive = trend > 0;
  var isNegative = trend < 0;

  var iconBoxMap = {
    red: 'icon-box-red',
    green: 'icon-box-green',
    default: 'icon-box-default',
  };

  var valueClass = accentColor === 'red' ? 'metric-value-red' : accentColor === 'green' ? 'metric-value-green' : 'metric-value';
  var cardClass = accentColor === 'red' ? 'glass-card-accent shimmer' : 'glass-card shimmer';

  var staggerClass = staggerMap[delay] || 'stagger-1';

  return (
    <div className={cardClass + ' p-3 md:p-5 ' + staggerClass}>
      <div className="flex items-start justify-between mb-2 md:mb-3">
        <div className={iconBoxMap[accentColor]}>
          {Icon && <Icon className="w-4 h-4 md:w-5 md:h-5" />}
        </div>
        {trend !== undefined && trend !== null && (
          <div className={'flex items-center gap-1 font-mono text-[10px] md:text-xs ' + (isPositive ? 'metric-positive' : isNegative ? 'metric-negative' : 'text-crm-muted')}>
            {isPositive ? <TrendingUp className="w-3 h-3" /> : isNegative ? <TrendingDown className="w-3 h-3" /> : null}
            {formatPercent(trend)}
          </div>
        )}
      </div>
      <div className={valueClass + ' text-lg md:text-2xl mb-0.5 md:mb-1'}>{value}</div>
      <div className="text-[10px] md:text-xs font-mono text-crm-muted uppercase tracking-wider">{label}</div>
      {trendLabel && <div className="text-[10px] md:text-xs text-crm-muted mt-1 hidden md:block">{trendLabel}</div>}
    </div>
  );
}
