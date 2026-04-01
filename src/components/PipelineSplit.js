'use client';
import { formatCurrency } from '@/lib/utils';

export default function PipelineSplit({ inboundRevenue, outboundRevenue }) {
  const total = inboundRevenue + outboundRevenue;
  const inPct = ((inboundRevenue / total) * 100).toFixed(1);
  const outPct = ((outboundRevenue / total) * 100).toFixed(1);

  return (
    <div className="glass-card p-5">
      <h3 className="text-sm font-mono text-crm-muted uppercase tracking-wider mb-4">Pipeline Split</h3>
      <div className="space-y-4">
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-crm-text">Inbound</span>
            <span className="font-mono text-crm-positive">{formatCurrency(inboundRevenue)} ({inPct}%)</span>
          </div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-crm-text">Outbound</span>
            <span className="font-mono text-crm-accent">{formatCurrency(outboundRevenue)} ({outPct}%)</span>
          </div>
        </div>
        <div className="h-3 bg-white/5 rounded-full overflow-hidden flex">
          <div className="h-full bg-crm-positive rounded-l-full transition-all" style={{ width: `${inPct}%` }} />
          <div className="h-full bg-crm-accent rounded-r-full transition-all" style={{ width: `${outPct}%` }} />
        </div>
        <div className="flex justify-between text-xs font-mono text-crm-muted">
          <span>Inbound {inPct}%</span>
          <span>Outbound {outPct}%</span>
        </div>
      </div>
    </div>
  );
}
