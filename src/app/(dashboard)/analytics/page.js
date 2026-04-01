'use client';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ScatterChart, Scatter, ZAxis, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, BarChart3 } from 'lucide-react';
import ClientOnly from '@/components/ClientOnly';
import EmptyState from '@/components/EmptyState';
import { formatCurrency } from '@/lib/utils';
import { revenueByDay, dialsByCloser, closerPerformances, teamOverview } from '@/lib/mock-data';

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <p className="text-xs font-mono text-crm-muted mb-1">{label}</p>
      {payload.map(function(entry, i) {
        return (
          <p key={i} className="text-xs text-crm-text-bright">
            <span style={{ color: entry.color }}>{entry.name}: </span>
            {typeof entry.value === 'number' && entry.value > 100 ? formatCurrency(entry.value) : entry.value}
          </p>
        );
      })}
    </div>
  );
}

var closeRateData = closerPerformances.map(function(p) {
  return {
    name: p.closer.name.split(' ')[0],
    closeRate: p.closeRate,
    teamAvg: teamOverview.teamCloseRate,
  };
});

var scatterData = closerPerformances.map(function(p) {
  return {
    name: p.closer.name.split(' ')[0],
    dials: p.totalDials,
    revenue: p.totalRevenue,
    closeRate: p.closeRate,
  };
});

var sourceData = [
  { name: 'Inbound', value: teamOverview.inboundRevenue },
  { name: 'Outbound', value: teamOverview.outboundRevenue },
];
var SOURCE_COLORS = ['#22c55e', '#dc2626'];

var funnelData = teamOverview.totalDials > 0 ? [
  { stage: 'Dials', value: teamOverview.totalDials },
  { stage: 'Connects', value: Math.round(teamOverview.totalDials * 0.28) },
  { stage: 'Booked', value: Math.round(teamOverview.totalDials * 0.08) },
  { stage: 'Shows', value: Math.round(teamOverview.totalDials * 0.06) },
  { stage: 'Closes', value: teamOverview.totalCloses },
] : [];

function ChartEmpty({ title, subtitle }) {
  return <EmptyState icon={BarChart3} title={title} subtitle={subtitle} />;
}

export default function AnalyticsPage() {
  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <h1 className="font-display text-2xl font-bold text-crm-text-bright mb-6">Analytics</h1>

      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Revenue Area Chart */}
        <div className="glass-card overflow-hidden stagger-1">
          <div className="section-header">
            <h3>Revenue Trend</h3>
            <span className="section-tag">14 Days</span>
          </div>
          {revenueByDay.length === 0 ? (
            <ChartEmpty title="No revenue data yet" subtitle="Revenue will appear as deals close" />
          ) : (
            <div className="p-5 h-[280px]">
              <ClientOnly>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueByDay}>
                    <defs>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#dc2626" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="date" tick={{ fill: '#6b6b6b', fontSize: 11, fontFamily: 'JetBrains Mono' }} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} tickLine={false} />
                    <YAxis tick={{ fill: '#6b6b6b', fontSize: 11, fontFamily: 'JetBrains Mono' }} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} tickLine={false} tickFormatter={function(v) { return '$' + (v / 1000).toFixed(0) + 'k'; }} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area type="monotone" dataKey="revenue" stroke="#dc2626" strokeWidth={2} fill="url(#revGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </ClientOnly>
            </div>
          )}
        </div>

        {/* Close Rate Bar Chart */}
        <div className="glass-card overflow-hidden stagger-2">
          <div className="section-header">
            <h3>Close Rate by Closer</h3>
            <span className="section-tag">Comparison</span>
          </div>
          {closeRateData.length === 0 ? (
            <ChartEmpty title="No close rate data yet" subtitle="Appears when closers have performance data" />
          ) : (
            <div className="p-5 h-[280px]">
              <ClientOnly>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={closeRateData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="name" tick={{ fill: '#6b6b6b', fontSize: 11, fontFamily: 'JetBrains Mono' }} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} tickLine={false} />
                    <YAxis tick={{ fill: '#6b6b6b', fontSize: 11, fontFamily: 'JetBrains Mono' }} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} tickLine={false} unit="%" />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="closeRate" fill="#dc2626" radius={[4, 4, 0, 0]} name="Close Rate" />
                    <Bar dataKey="teamAvg" fill="#404040" radius={[4, 4, 0, 0]} name="Team Avg" />
                  </BarChart>
                </ResponsiveContainer>
              </ClientOnly>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Dials vs Revenue Scatter */}
        <div className="glass-card overflow-hidden stagger-3">
          <div className="section-header">
            <h3>Dials vs Revenue</h3>
            <span className="section-tag">Scatter</span>
          </div>
          {scatterData.length === 0 ? (
            <ChartEmpty title="No dial/revenue data yet" subtitle="Appears when closers have performance data" />
          ) : (
            <div className="p-5 h-[280px]">
              <ClientOnly>
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="dials" name="Dials" tick={{ fill: '#6b6b6b', fontSize: 11, fontFamily: 'JetBrains Mono' }} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} tickLine={false} />
                    <YAxis dataKey="revenue" name="Revenue" tick={{ fill: '#6b6b6b', fontSize: 11, fontFamily: 'JetBrains Mono' }} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} tickLine={false} tickFormatter={function(v) { return '$' + (v / 1000).toFixed(0) + 'k'; }} />
                    <ZAxis dataKey="closeRate" range={[100, 500]} name="Close Rate" />
                    <Tooltip content={<ChartTooltip />} />
                    <Scatter data={scatterData} fill="#dc2626" />
                  </ScatterChart>
                </ResponsiveContainer>
              </ClientOnly>
            </div>
          )}
        </div>

        {/* Source Breakdown */}
        <div className="glass-card overflow-hidden stagger-4">
          <div className="section-header">
            <h3>Revenue by Source</h3>
            <span className="section-tag">Split</span>
          </div>
          {sourceData[0].value === 0 && sourceData[1].value === 0 ? (
            <ChartEmpty title="No revenue source data yet" subtitle="Appears as inbound and outbound deals close" />
          ) : (
            <div className="p-5 h-[280px]">
              <ClientOnly>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={sourceData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value" label={function(d) { return d.name + ' ' + (d.percent * 100).toFixed(0) + '%'; }}>
                      {sourceData.map(function(entry, index) {
                        return <Cell key={'cell-' + index} fill={SOURCE_COLORS[index]} />;
                      })}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </ClientOnly>
            </div>
          )}
        </div>
      </div>

      {/* Funnel */}
      <div className="glass-card overflow-hidden stagger-5">
        <div className="section-header">
          <h3>Conversion Funnel</h3>
          <span className="section-tag">Full Pipeline</span>
        </div>
        {funnelData.length === 0 ? (
          <ChartEmpty title="No funnel data yet" subtitle="Funnel stages populate as dials and closes are recorded" />
        ) : (
          <div className="p-5 h-[200px]">
            <ClientOnly>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={funnelData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis type="number" tick={{ fill: '#6b6b6b', fontSize: 11, fontFamily: 'JetBrains Mono' }} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} tickLine={false} />
                  <YAxis type="category" dataKey="stage" tick={{ fill: '#6b6b6b', fontSize: 11, fontFamily: 'JetBrains Mono' }} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} tickLine={false} width={70} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="value" fill="#dc2626" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ClientOnly>
          </div>
        )}
      </div>
    </div>
  );
}
