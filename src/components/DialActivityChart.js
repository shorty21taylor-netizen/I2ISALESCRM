'use client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Phone } from 'lucide-react';

var closerNames = ['Marcus', 'Aisha', 'Jordan', 'Derek', 'Tanya'];

var closerColors = {
  Marcus: '#dc2626',
  Aisha: '#f97316',
  Jordan: '#3b82f6',
  Derek: '#8b5cf6',
  Tanya: '#ec4899',
};

function DialTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  var total = payload.reduce(function(sum, p) { return sum + (p.value || 0); }, 0);

  if (total === 0) {
    return (
      <div className="chart-tooltip">
        <p className="text-xs font-mono text-crm-muted">{label}</p>
        <p className="text-sm text-crm-muted font-mono mt-1">Weekend</p>
      </div>
    );
  }

  var topDialer = payload.reduce(function(top, p) {
    return (p.value || 0) > (top.value || 0) ? p : top;
  }, payload[0]);

  return (
    <div className="chart-tooltip">
      <p className="text-xs font-mono text-crm-muted mb-2">{label}</p>
      {payload
        .filter(function(p) { return p.value > 0; })
        .sort(function(a, b) { return b.value - a.value; })
        .map(function(p) {
          var isTop = p.dataKey === topDialer.dataKey;
          return (
            <div key={p.dataKey} className="flex items-center justify-between gap-4 text-xs py-0.5">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ background: p.color }} />
                <span className="text-crm-text">{p.dataKey}</span>
                {isTop && <span className="text-crm-warning text-[9px]">{'\u2605'}</span>}
              </div>
              <span className="font-mono text-crm-text-bright">{p.value}</span>
            </div>
          );
        })}
      <div className="mt-2 pt-2 flex justify-between text-xs" style={{ borderTop: '0.5px solid rgba(255,255,255,0.06)' }}>
        <span className="text-crm-muted">Total</span>
        <span className="font-mono font-semibold text-crm-text-bright">{total}</span>
      </div>
    </div>
  );
}

export default function DialActivityChart({ data }) {
  var totalDials = data.reduce(function(sum, day) {
    return sum + closerNames.reduce(function(s, name) { return s + (day[name] || 0); }, 0);
  }, 0);
  var workingDays = data.filter(function(day) {
    return closerNames.some(function(name) { return day[name] > 0; });
  });

  return (
    <div className="glass-card overflow-hidden">
      <div className="section-header">
        <h3>
          <Phone className="w-4 h-4 text-crm-accent" />
          Dials by closer (7 days)
        </h3>
        <div className="flex items-center gap-3">
          <span className="text-sm font-mono font-semibold text-crm-text-bright">{totalDials.toLocaleString()} total</span>
          <span className="section-tag">Grouped</span>
        </div>
      </div>
      <div className="p-5">
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 0 }} barCategoryGap="20%" barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <ReferenceLine y={30} stroke="rgba(255,255,255,0.12)" strokeDasharray="6 4" strokeWidth={1} label={{ value: 'Target', position: 'right', fill: '#6b6b6b', fontSize: 9, fontFamily: 'JetBrains Mono' }} />
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
              />
              <Tooltip content={<DialTooltip />} />
              {closerNames.map(function(name) {
                return (
                  <Bar
                    key={name}
                    dataKey={name}
                    fill={closerColors[name]}
                    radius={[3, 3, 0, 0]}
                    maxBarSize={16}
                  />
                );
              })}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="px-5 pb-4">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {closerNames.map(function(name) {
            var closerTotal = data.reduce(function(sum, day) { return sum + (day[name] || 0); }, 0);
            var closerAvg = workingDays.length > 0 ? Math.round(closerTotal / workingDays.length) : 0;
            return (
              <div key={name} className="flex items-center gap-2 text-xs">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ background: closerColors[name] }} />
                <span className="text-crm-muted font-mono">{name}</span>
                <span className="text-crm-text-bright font-mono font-semibold">{closerTotal}</span>
                <span className="text-crm-muted/50 font-mono">({closerAvg}/d)</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
