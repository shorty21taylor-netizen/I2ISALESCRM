'use client';
import { Lightbulb, AlertTriangle } from 'lucide-react';
import { getInitials } from '@/lib/utils';

export default function AIInsights({ performances }) {
  return (
    <div className="glass-card p-5">
      <h3 className="text-sm font-mono text-crm-muted uppercase tracking-wider mb-4">AI Insights</h3>
      <div className="space-y-4">
        {performances.map((perf) => (
          <div key={perf.closer.id} className="rounded-lg border border-crm-border/50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-xs font-bold text-crm-text">
                {getInitials(perf.closer.name)}
              </div>
              <span className="text-sm font-medium text-crm-text-bright">{perf.closer.name}</span>
            </div>
            {perf.funnelBottleneck && (
              <div className="flex items-center gap-2 mb-2 px-2 py-1.5 rounded bg-crm-warning/10 border border-crm-warning/20">
                <AlertTriangle className="w-3.5 h-3.5 text-crm-warning flex-shrink-0" />
                <span className="text-xs text-crm-warning">{perf.funnelBottleneck}</span>
              </div>
            )}
            <p className="text-xs text-crm-text mb-3 leading-relaxed">{perf.aiDiagnostic}</p>
            <div className="space-y-1.5">
              {perf.aiSuggestions.map((s, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-crm-muted">
                  <Lightbulb className="w-3 h-3 text-crm-warning mt-0.5 flex-shrink-0" />
                  <span>{s}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
