'use client';
import { formatCurrency } from '@/lib/utils';

export default function PipelineSplit({ inboundRevenue, outboundRevenue }) {
  var total = inboundRevenue + outboundRevenue;
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
            <span className="font-mono text-crm-accent" style={{ textShadow: '0 0 12px rgba(220,38,38,0.3)' }}>{formatCurrency(outboundRevenue)} ({outPct}%)</span>
          </div>
        </div>
        <div className="progress-bar h-3">
          <div className="h-full flex">
            <div className="h-full progress-fill-green rounded-l-full" style={{ width: inPct + '%' }} />
            <div className="h-full progress-fill-red rounded-r-full" style={{ width: outPct + '%' }} />
          </div>
        </div>
        <div className="flex justify-between text-xs font-mono text-crm-muted">
          <span>Inbound {inPct}%</span>
          <span>Outbound {outPct}%</span>
        </div>
      </div>
    </div>
  );
}
