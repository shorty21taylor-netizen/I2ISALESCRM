'use client';
import { useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, CheckCircle, XCircle } from 'lucide-react';
import { formatCurrency, formatDuration, getInitials, getScoreColor, getScoreBg } from '@/lib/utils';

export default function RecentCalls({ calls }) {
  const [expandedId, setExpandedId] = useState(null);

  return (
    <div className="glass-card p-5">
      <h3 className="text-sm font-mono text-crm-muted uppercase tracking-wider mb-4">Recent Calls</h3>
      <div className="space-y-2">
        {calls.map((call) => {
          const expanded = expandedId === call.id;
          const sc = call.aiScorecard;
          return (
            <div key={call.id} className="rounded-lg border border-crm-border/50 overflow-hidden">
              <button
                onClick={() => setExpandedId(expanded ? null : call.id)}
                className="w-full flex items-center gap-3 p-3 hover:bg-white/[0.02] transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-xs font-bold text-crm-text">
                  {getInitials(call.closerName)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-crm-text-bright truncate">{call.leadName}</div>
                  <div className="text-xs text-crm-muted">{call.closerName}</div>
                </div>
                <span className={`badge ${call.leadSource === 'inbound' ? 'badge-positive' : 'badge-neutral'}`}>
                  {call.leadSource}
                </span>
                <span className="text-xs font-mono text-crm-muted">{formatDuration(call.duration)}</span>
                <span className={`badge ${call.outcome === 'closed' ? 'badge-positive' : 'badge-negative'}`}>
                  {call.outcome === 'closed' ? 'Closed' : 'No Close'}
                </span>
                {call.dealValue && (
                  <span className="text-sm font-mono text-crm-positive">{formatCurrency(call.dealValue)}</span>
                )}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border ${getScoreBg(sc.overallScore)} ${getScoreColor(sc.overallScore)}`}>
                  {sc.overallScore}
                </div>
                {expanded ? <ChevronUp className="w-4 h-4 text-crm-muted" /> : <ChevronDown className="w-4 h-4 text-crm-muted" />}
              </button>

              {expanded && (
                <div className="px-4 pb-4 border-t border-crm-border/50 bg-white/[0.01]">
                  <p className="text-sm text-crm-text mt-3 mb-3">{sc.summary}</p>
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    <div className="rounded-lg bg-white/[0.03] p-2 text-center">
                      <div className="text-xs text-crm-muted mb-1">Discovery</div>
                      {sc.discoveryDone ? <CheckCircle className="w-4 h-4 text-crm-positive mx-auto" /> : <XCircle className="w-4 h-4 text-crm-negative mx-auto" />}
                    </div>
                    <div className="rounded-lg bg-white/[0.03] p-2 text-center">
                      <div className="text-xs text-crm-muted mb-1">Objections</div>
                      <div className={`text-sm font-bold ${sc.objectionHandling >= 7 ? 'text-crm-positive' : sc.objectionHandling >= 5 ? 'text-crm-warning' : 'text-crm-negative'}`}>{sc.objectionHandling}/10</div>
                    </div>
                    <div className="rounded-lg bg-white/[0.03] p-2 text-center">
                      <div className="text-xs text-crm-muted mb-1">Urgency</div>
                      {sc.urgencyCreated ? <CheckCircle className="w-4 h-4 text-crm-positive mx-auto" /> : <XCircle className="w-4 h-4 text-crm-negative mx-auto" />}
                    </div>
                    <div className="rounded-lg bg-white/[0.03] p-2 text-center">
                      <div className="text-xs text-crm-muted mb-1">Talk/Listen</div>
                      <div className={`text-sm font-bold ${call.talkToListenRatio <= 50 ? 'text-crm-positive' : 'text-crm-negative'}`}>{call.talkToListenRatio}/{100 - call.talkToListenRatio}</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {sc.objectionsRaised.map((obj, i) => (
                      <span key={i} className="badge-warning">{obj}</span>
                    ))}
                  </div>
                  {call.fathomRecordingUrl && (
                    <a href={call.fathomRecordingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-crm-accent hover:text-crm-accent-glow transition-colors">
                      <ExternalLink className="w-3 h-3" /> View in Fathom
                    </a>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
