'use client';
import { Lightbulb, AlertTriangle } from 'lucide-react';
import { getInitials } from '@/lib/utils';

export default function AIInsights({ performances }) {
  return (
    <div className="glass-card overflow-hidden">
      <div className="section-header">
        <h3>AI Insights</h3>
        <span className="section-tag" style={{ color: '#dc2626', background: 'rgba(220,38,38,0.08)', borderColor: 'rgba(220,38,38,0.15)' }}>AI</span>
      </div>
      <div className="p-4 space-y-3">
        {performances.map(function(perf) {
          return (
            <div key={perf.closer.id} className="glass-surface p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="avatar avatar-sm text-crm-text">
                  {getInitials(perf.closer.name)}
                </div>
                <span className="text-sm font-medium text-crm-text-bright">{perf.closer.name}</span>
              </div>
              {perf.funnelBottleneck && (
                <div className="flex items-center gap-2 mb-2 px-2 py-1.5 rounded-lg bg-crm-warning/10 border border-crm-warning/20">
                  <AlertTriangle className="w-3.5 h-3.5 text-crm-warning flex-shrink-0" />
                  <span className="text-xs text-crm-warning">{perf.funnelBottleneck}</span>
                </div>
              )}
              <p className="text-xs text-crm-text mb-3 leading-relaxed">{perf.aiDiagnostic}</p>
              <div className="space-y-1.5">
                {perf.aiSuggestions.map(function(s, i) {
                  return (
                    <div key={i} className="flex items-start gap-2 text-xs text-crm-muted">
                      <Lightbulb className="w-3 h-3 text-crm-warning mt-0.5 flex-shrink-0" />
                      <span>{s}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
