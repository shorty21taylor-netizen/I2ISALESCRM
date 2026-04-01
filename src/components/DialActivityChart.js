'use client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const COLORS = {
  Marcus: '#dc2626',
  Aisha: '#f87171',
  Jordan: '#6b6b6b',
  Derek: '#404040',
  Tanya: '#991b1b',
};

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-crm-surface/95 backdrop-blur-sm border border-crm-border rounded-lg p-3 shadow-xl">
      <p className="text-xs font-mono text-crm-muted mb-2">{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center justify-between gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-crm-text">{entry.dataKey}</span>
          </span>
          <span className="font-mono text-crm-text-bright">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function DialActivityChart({ data }) {
  return (
    <div className="glass-card p-5">
      <h3 className="text-sm font-mono text-crm-muted uppercase tracking-wider mb-4">Dials by Closer (7 Days)</h3>
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" />
            <XAxis dataKey="date" tick={{ fill: '#6b6b6b', fontSize: 11, fontFamily: 'JetBrains Mono' }} axisLine={{ stroke: '#1f1f1f' }} tickLine={false} />
            <YAxis tick={{ fill: '#6b6b6b', fontSize: 11, fontFamily: 'JetBrains Mono' }} axisLine={{ stroke: '#1f1f1f' }} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: '11px', fontFamily: 'JetBrains Mono' }} />
            {Object.keys(COLORS).map((name) => (
              <Bar key={name} dataKey={name} stackId="dials" fill={COLORS[name]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
