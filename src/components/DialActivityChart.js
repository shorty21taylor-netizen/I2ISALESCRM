'use client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

var COLORS = {
  Marcus: '#dc2626',
  Aisha: '#f87171',
  Jordan: '#6b6b6b',
  Derek: '#404040',
  Tanya: '#991b1b',
};

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <p className="text-xs font-mono text-crm-muted mb-2">{label}</p>
      {payload.map(function(entry) {
        return (
          <div key={entry.dataKey} className="flex items-center justify-between gap-4 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-crm-text">{entry.dataKey}</span>
            </span>
            <span className="font-mono text-crm-text-bright">{entry.value}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function DialActivityChart({ data }) {
  return (
    <div className="glass-card overflow-hidden">
      <div className="section-header">
        <h3>Dials by Closer (7 Days)</h3>
        <span className="section-tag">Stacked</span>
      </div>
      <div className="p-5">
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" tick={{ fill: '#6b6b6b', fontSize: 11, fontFamily: 'JetBrains Mono' }} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} tickLine={false} />
              <YAxis tick={{ fill: '#6b6b6b', fontSize: 11, fontFamily: 'JetBrains Mono' }} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '11px', fontFamily: 'JetBrains Mono' }} />
              {Object.keys(COLORS).map(function(name) {
                return <Bar key={name} dataKey={name} stackId="dials" fill={COLORS[name]} />;
              })}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
