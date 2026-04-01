'use client';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatCurrency } from '@/lib/utils';

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-crm-surface/95 backdrop-blur-sm border border-crm-border rounded-lg p-3 shadow-xl">
      <p className="text-xs font-mono text-crm-muted mb-1">{label}</p>
      <p className="text-sm font-bold text-crm-text-bright">{formatCurrency(payload[0].value)}</p>
      {payload[0].payload.closes !== undefined && (
        <p className="text-xs text-crm-muted mt-1">{payload[0].payload.closes} closes</p>
      )}
    </div>
  );
}

export default function RevenueChart({ data }) {
  return (
    <div className="glass-card p-5">
      <h3 className="text-sm font-mono text-crm-muted uppercase tracking-wider mb-4">Revenue (14 Days)</h3>
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#dc2626" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" />
            <XAxis dataKey="date" tick={{ fill: '#6b6b6b', fontSize: 11, fontFamily: 'JetBrains Mono' }} axisLine={{ stroke: '#1f1f1f' }} tickLine={false} />
            <YAxis tick={{ fill: '#6b6b6b', fontSize: 11, fontFamily: 'JetBrains Mono' }} axisLine={{ stroke: '#1f1f1f' }} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="revenue" stroke="#dc2626" strokeWidth={2} fill="url(#revenueGradient)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
