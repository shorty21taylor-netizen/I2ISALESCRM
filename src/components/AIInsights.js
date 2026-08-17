'use client';
import { Lightbulb, AlertTriangle, Brain } from 'lucide-react';
import { getInitials } from '@/lib/utils';
import EmptyState from '@/components/EmptyState';

export default function AIInsights({ performances }) {
  if (!performances || performances.length === 0) {
    return (
      <div className="glass-card overflow-hidden">
        <div className="section-header">
          <h3>AI Insights</h3>
          <div className="flex items-center gap-2">
            <div className="glow-dot-accent" />
            <span className="section-tag" style={{ color: 'var(--crm-text-bright)', background: 'var(--section-tag-bg)', borderColor: 'var(--section-tag-border)' }}>AI</span>
          </div>
        </div>
        <EmptyState icon={Brain} title="No AI insights yet" subtitle="Diagnostics generate after closers have enough call and performance data" />
      </div>
    );
  }

  return (
    <div className="glass-card overflow-hidden">
      <div className="section-header">
        <h3>AI Insights</h3>
        <div className="flex items-center gap-2">
          <div className="glow-dot-accent" />
          <span className="section-tag" style={{ color: 'var(--crm-text-bright)', background: 'var(--section-tag-bg)', borderColor: 'var(--section-tag-border)' }}>AI</span>
        </div>
      </div>
      <div className="p-4 space-y-3">
        {performances.filter(Boolean).map(function(perf, idx) {
          var name = (perf.closer && perf.closer.name) || perf.name || 'Unknown';
          var id = (perf.closer && perf.closer.id) || perf.name || idx;
          var suggestions = perf.aiSuggestions || [];
          var diagnostic = perf.aiDiagnostic || '';
          var bottleneck = perf.funnelBottleneck || '';

          // Skip entries with no AI data (live data doesn't have diagnostics yet)
          if (!diagnostic && suggestions.length === 0) {
            var cr = perf.closeRate || (perf.callsTaken > 0 ? Math.round((perf.closes / perf.callsTaken) * 1000) / 10 : 0);
            var dials = perf.totalDials || perf.dials || 0;
            diagnostic = name + ': ' + (perf.closes || 0) + ' closes, ' + dials + ' dials, ' + cr + '% close rate.';
            if (cr < 15 && perf.callsTaken > 0) {
              suggestions = ['Focus on improving pitch delivery and objection handling to boost close rate.'];
              bottleneck = 'Low close rate (' + cr + '%)';
            } else if (dials < 20 && perf.eodCount > 0) {
              suggestions = ['Increase daily outbound dial volume for more opportunities.'];
              bottleneck = 'Low dial volume (' + dials + ' total)';
            }
          }

          return (
            <div key={id} className="glass-surface p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="avatar avatar-sm text-crm-text">
                  {getInitials(name)}
                </div>
                <span className="text-sm font-medium text-crm-text-bright">{name}</span>
              </div>
              {bottleneck && (
                <div className="flex items-center gap-2 mb-2 px-2 py-1.5 rounded-lg bg-crm-warning/10 border border-crm-warning/20">
                  <AlertTriangle className="w-3.5 h-3.5 text-crm-warning flex-shrink-0" />
                  <span className="text-xs text-crm-warning">{bottleneck}</span>
                </div>
              )}
              {diagnostic && <p className="text-xs text-crm-text mb-3 leading-relaxed">{diagnostic}</p>}
              <div className="space-y-1.5">
                {suggestions.map(function(s, i) {
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
