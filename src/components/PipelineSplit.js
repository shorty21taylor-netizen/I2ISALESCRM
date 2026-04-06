'use client';
import { GitBranch } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import EmptyState from '@/components/EmptyState';

export default function PipelineSplit({ inboundRevenue, outboundRevenue, paymentBreakdown }) {
  var total = inboundRevenue + outboundRevenue;
  var pb = paymentBreakdown || { fullPay: { deals: 0, revenue: 0 }, paymentPlan: { deals: 0, revenue: 0 } };
  var payTotal = pb.fullPay.revenue + pb.paymentPlan.revenue;

  if (total === 0 && payTotal === 0) {
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

  var inPct = total > 0 ? ((inboundRevenue / total) * 100).toFixed(1) : '0.0';
  var outPct = total > 0 ? ((outboundRevenue / total) * 100).toFixed(1) : '0.0';

  var fpPct = payTotal > 0 ? Math.round((pb.fullPay.revenue / payTotal) * 100) : 0;
  var ppPct = payTotal > 0 ? Math.round((pb.paymentPlan.revenue / payTotal) * 100) : 0;

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
        <div className="split-bar">
          <div className="h-full" style={{ width: inPct + '%', background: 'linear-gradient(90deg, #22c55e, #4ade80)', boxShadow: '0 0 16px rgba(34,197,94,0.3)', borderRadius: '12px 0 0 12px' }} />
          <div className="split-fill-red" style={{ width: outPct + '%', borderRadius: '0 12px 12px 0' }} />
        </div>
        <div className="flex justify-between text-xs font-mono text-crm-muted">
          <span>Inbound {inPct}%</span>
          <span>Outbound {outPct}%</span>
        </div>

        {/* Payment Type Split */}
        <div className="pt-4" style={{ borderTop: '0.5px solid var(--crm-divider, rgba(255,255,255,0.06))' }}>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-crm-text">Full Pay</span>
            <span className="font-mono metric-positive">{formatCurrency(pb.fullPay.revenue)} ({fpPct}%)</span>
          </div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-crm-text">Payment Plan</span>
            <span className="font-mono" style={{ color: 'var(--crm-warning, #f59e0b)' }}>{formatCurrency(pb.paymentPlan.revenue)} ({ppPct}%)</span>
          </div>
          <div className="split-bar">
            <div className="h-full" style={{
              width: fpPct + '%',
              background: 'linear-gradient(90deg, #22c55e, #4ade80)',
              boxShadow: '0 0 16px rgba(34,197,94,0.3)',
              borderRadius: payTotal > 0 && pb.paymentPlan.revenue === 0 ? '12px' : '12px 0 0 12px',
            }} />
            <div className="h-full" style={{
              flex: 1,
              background: 'var(--crm-warning, #f59e0b)',
              opacity: 0.5,
              borderRadius: payTotal > 0 && pb.fullPay.revenue === 0 ? '12px' : '0 12px 12px 0',
            }} />
          </div>
          <div className="flex justify-between text-xs font-mono text-crm-muted mt-1">
            <span>Full Pay {fpPct}%</span>
            <span>Payment Plan {ppPct}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
