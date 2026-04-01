'use client';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import EmptyState from '@/components/EmptyState';

export default function RevenueChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="glass-card overflow-hidden">
        <div className="section-header">
          <h3>
            <TrendingUp className="w-4 h-4 text-crm-accent" />
            Revenue (14 days)
          </h3>
          <span className="section-tag">Daily</span>
        </div>
        <EmptyState icon={TrendingUp} title="No revenue data yet" subtitle="Revenue will appear as deals close" />
      </div>
    );
  }

  var totalRevenue = data.reduce(function(sum, d) { return sum + d.revenue; }, 0);
  var workingDays = data.filter(function(d) { return d.revenue > 0; });
  var avgRevenue = workingDays.length > 0 ? Math.round(totalRevenue / workingDays.length) : 0;

  function RevenueTooltip({ active, payload, label }) {
    if (!active || !payload || !payload.length) return null;
    var revenue = payload[0].value;
    var closes = payload[0].payload.closes;
    var isAboveAvg = revenue >= avgRevenue;
    var isWeekend = revenue === 0;

    return (
      <div className="chart-tooltip">
        <p className="text-xs font-mono text-crm-muted mb-1">{label}</p>
        {isWeekend ? (
          <p className="text-sm text-crm-muted font-mono">Weekend</p>
        ) : (
          <>
            <p className="text-sm font-display font-bold text-crm-text-bright">{formatCurrency(revenue)}</p>
            <p className="text-xs text-crm-muted font-mono mt-1">{closes} close{closes !== 1 ? 's' : ''}</p>
            <div className="flex items-center gap-1 mt-1">
              <div className={'w-1.5 h-1.5 rounded-full ' + (isAboveAvg ? 'bg-crm-positive' : 'bg-crm-negative')} />
              <span className={'text-xs font-mono ' + (isAboveAvg ? 'text-crm-positive' : 'text-crm-negative')}>
                {isAboveAvg ? 'Above' : 'Below'} avg
              </span>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="glass-card overflow-hidden">
      <div className="section-header">
        <h3>
          <TrendingUp className="w-4 h-4 text-crm-accent" />
          Revenue (14 days)
        </h3>
        <div className="flex items-center gap-3">
          <span className="text-sm font-mono font-semibold text-crm-text-bright">{formatCurrency(totalRevenue)}</span>
          <span className="section-tag">Daily</span>
        </div>
      </div>
      <div className="p-5">
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#dc2626" stopOpacity={0.35} />
                  <stop offset="50%" stopColor="#dc2626" stopOpacity={0.12} />
                  <stop offset="100%" stopColor="#dc2626" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <ReferenceArea x1="Mar 22" x2="Mar 23" fill="rgba(255,255,255,0.015)" />
              <ReferenceArea x1="Mar 29" x2="Mar 30" fill="rgba(255,255,255,0.015)" />
              <ReferenceLine y={avgRevenue} stroke="#6b6b6b" strokeDasharray="6 4" strokeWidth={1} label={{ value: 'Avg', position: 'right', fill: '#6b6b6b', fontSize: 10, fontFamily: 'JetBrains Mono' }} />
              <XAxis
                dataKey="date"
                tick={{ fill: '#6b6b6b', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#6b6b6b', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={function(v) { return '$' + (v / 1000).toFixed(0) + 'k'; }}
                domain={[0, 'auto']}
              />
              <Tooltip content={<RevenueTooltip />} />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#dc2626"
                strokeWidth={2.5}
                fill="url(#revenueGrad)"
                dot={{ r: 3, fill: '#dc2626', stroke: '#0a0a0a', strokeWidth: 2 }}
                activeDot={{ r: 5, fill: '#dc2626', stroke: '#fafafa', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="flex items-center gap-6 px-5 pb-4">
        <div className="flex items-center gap-2 text-xs text-crm-muted">
          <div className="w-4 h-0.5 bg-crm-accent rounded" />
          <span className="font-mono">Daily revenue</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-crm-muted">
          <div className="w-4 h-0.5 border-t border-dashed border-crm-muted" />
          <span className="font-mono">Avg {formatCurrency(avgRevenue)}/day</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-crm-muted">
          <div className="w-3 h-3 rounded-sm" style={{ background: 'rgba(255,255,255,0.015)', border: '0.5px solid rgba(255,255,255,0.06)' }} />
          <span className="font-mono">Weekend</span>
        </div>
      </div>
    </div>
  );
}
