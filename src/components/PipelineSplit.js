'use client';
import { GitBranch } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import EmptyState from '@/components/EmptyState';

export default function PipelineSplit({ inboundRevenue, outboundRevenue }) {
  var total = inboundRevenue + outboundRevenue;

  if (total === 0) {
    return (
      <div className="glass-card overflow-hidden">
        <div className="section-header">
          <h3>Pipeline Split</h3>
          <span className="section-tag">Revenue</span>
        </div>
        <EmptyState icon={GitBranch} title="No revenue split data yet" subtitle="Will populate as inbound and outbound deals close" />
      </div>
    );
  }

  var inPct = ((inboundRevenue / total) * 100).toFixed(1);
  var outPct = ((outboundRevenue / total) * 100).toFixed(1);

  return (
    <div className="glass-card overflow-hidden">
      <div className="section-header">
        <h3>Pipeline Split</h3>
        <span className="section-tag">Revenue</span>
      </div>
      <div className="p-5 space-y-4">
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-crm-text">Inbound</span>
            <span className="font-mono metric-positive">{formatCurrency(inboundRevenue)} ({inPct}%)</span>
          </div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-crm-text">Outbound</span>
            <span className="font-mono text-crm-accent" style={{ textShadow: '0 0 12px rgba(var(--accent-rgb),0.3)' }}>{formatCurrency(outboundRevenue)} ({outPct}%)</span>
          </div>
        </div>
        <div className="split-bar">
          <div className="h-full" style={{ width: inPct + '%', background: 'linear-gradient(90deg, #22c55e, #4ade80)', boxShadow: '0 0 16px rgba(34,197,94,0.3)', borderRadius: '12px 0 0 12px' }} />
          <div className="split-fill-accent" style={{ width: outPct + '%', borderRadius: '0 12px 12px 0' }} />
        </div>
        <div className="flex justify-between text-xs font-mono text-crm-muted">
          <span>Inbound {inPct}%</span>
          <span>Outbound {outPct}%</span>
        </div>
      </div>
    </div>
  );
}
