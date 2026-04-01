'use client';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ScatterChart, Scatter, ZAxis, PieChart, Pie, Cell } from 'recharts';
import ClientOnly from '@/components/ClientOnly';
import { formatCurrency } from '@/lib/utils';
import { revenueByDay, dialsByCloser, closerPerformances, teamOverview } from '@/lib/mock-data';

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-crm-surface/95 backdrop-blur-sm border border-crm-border rounded-lg p-3 shadow-xl">
      <p className="text-xs font-mono text-crm-muted mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-xs text-crm-text-bright">
          <span style={{ color: entry.color }}>{entry.name}: </span>
          {typeof entry.value === 'number' && entry.value > 100 ? formatCurrency(entry.value) : entry.value}
        </p>
      ))}
    </div>
  );
}

const closeRateData = closerPerformances.map((p) => ({
  name: p.closer.name.split(' ')[0],
  closeRate: p.closeRate,
  teamAvg: teamOverview.teamCloseRate,
}));

const scatterData = closerPerformances.map((p) => ({
  name: p.closer.name.split(' ')[0],
  dials: p.totalDials,
  revenue: p.totalRevenue,
  closeRate: p.closeRate,
}));

const sourceData = [
  { name: 'Inbound', value: teamOverview.inboundRevenue },
  { name: 'Outbound', value: teamOverview.outboundRevenue },
];
const SOURCE_COLORS = ['#22c55e', '#dc2626'];

const funnelData = [
  { stage: 'Dials', value: teamOverview.totalDials },
  { stage: 'Connects', value: Math.round(teamOverview.totalDials * 0.28) },
  { stage: 'Booked', value: Math.round(teamOverview.totalDials * 0.08) },
  { stage: 'Shows', value: Math.round(teamOverview.totalDials * 0.06) },
  { stage: 'Closes', value: teamOverview.totalCloses },
];

export default function AnalyticsPage() {
  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <h1 className="font-display text-2xl font-bold text-crm-text-bright mb-6">Analytics</h1>

      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Revenue Area Chart */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-mono text-crm-muted uppercase tracking-wider mb-4">Revenue Trend</h3>
          <div className="h-[280px]">
            <ClientOnly>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueByDay}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#dc2626" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" />
                  <XAxis dataKey="date" tick={{ fill: '#6b6b6b', fontSize: 11, fontFamily: 'JetBrains Mono' }} axisLine={{ stroke: '#1f1f1f' }} tickLine={false} />
                  <YAxis tick={{ fill: '#6b6b6b', fontSize: 11, fontFamily: 'JetBrains Mono' }} axisLine={{ stroke: '#1f1f1f' }} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="revenue" stroke="#dc2626" strokeWidth={2} fill="url(#revGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </ClientOnly>
          </div>
        </div>

        {/* Close Rate Bar Chart */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-mono text-crm-muted uppercase tracking-wider mb-4">Close Rate by Closer</h3>
          <div className="h-[280px]">
            <ClientOnly>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={closeRateData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" />
                  <XAxis dataKey="name" tick={{ fill: '#6b6b6b', fontSize: 11, fontFamily: 'JetBrains Mono' }} axisLine={{ stroke: '#1f1f1f' }} tickLine={false} />
                  <YAxis tick={{ fill: '#6b6b6b', fontSize: 11, fontFamily: 'JetBrains Mono' }} axisLine={{ stroke: '#1f1f1f' }} tickLine={false} unit="%" />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="closeRate" fill="#dc2626" radius={[4, 4, 0, 0]} name="Close Rate" />
                  <Bar dataKey="teamAvg" fill="#404040" radius={[4, 4, 0, 0]} name="Team Avg" />
                </BarChart>
              </ResponsiveContainer>
            </ClientOnly>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Dials vs Revenue Scatter */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-mono text-crm-muted uppercase tracking-wider mb-4">Dials vs Revenue</h3>
          <div className="h-[280px]">
            <ClientOnly>
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" />
                  <XAxis dataKey="dials" name="Dials" tick={{ fill: '#6b6b6b', fontSize: 11, fontFamily: 'JetBrains Mono' }} axisLine={{ stroke: '#1f1f1f' }} tickLine={false} />
                  <YAxis dataKey="revenue" name="Revenue" tick={{ fill: '#6b6b6b', fontSize: 11, fontFamily: 'JetBrains Mono' }} axisLine={{ stroke: '#1f1f1f' }} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <ZAxis dataKey="closeRate" range={[100, 500]} name="Close Rate" />
                  <Tooltip content={<ChartTooltip />} />
                  <Scatter data={scatterData} fill="#dc2626" />
                </ScatterChart>
              </ResponsiveContainer>
            </ClientOnly>
          </div>
        </div>

        {/* Source Breakdown */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-mono text-crm-muted uppercase tracking-wider mb-4">Revenue by Source</h3>
          <div className="h-[280px]">
            <ClientOnly>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={sourceData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {sourceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={SOURCE_COLORS[index]} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </ClientOnly>
          </div>
        </div>
      </div>

      {/* Funnel */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-mono text-crm-muted uppercase tracking-wider mb-4">Conversion Funnel</h3>
        <div className="h-[200px]">
          <ClientOnly>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnelData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" />
                <XAxis type="number" tick={{ fill: '#6b6b6b', fontSize: 11, fontFamily: 'JetBrains Mono' }} axisLine={{ stroke: '#1f1f1f' }} tickLine={false} />
                <YAxis type="category" dataKey="stage" tick={{ fill: '#6b6b6b', fontSize: 11, fontFamily: 'JetBrains Mono' }} axisLine={{ stroke: '#1f1f1f' }} tickLine={false} width={70} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="value" fill="#dc2626" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ClientOnly>
        </div>
      </div>
    </div>
  );
}
