'use client';
import { useState } from 'react';
import { Filter, ChevronDown, ChevronUp, ExternalLink, CheckCircle, XCircle } from 'lucide-react';
import { formatCurrency, formatDuration, getInitials, getScoreColor, getScoreBg } from '@/lib/utils';
import { recentCalls, closers } from '@/lib/mock-data';

// Generate more calls by duplicating with variations
const allCalls = [
  ...recentCalls,
  { ...recentCalls[0], id: 'call-6', leadName: 'Anna Foster', date: '2026-03-30T10:00:00Z', duration: 1980, dealValue: 4200, outcome: 'closed', aiScorecard: { ...recentCalls[0].aiScorecard, overallScore: 88 } },
  { ...recentCalls[1], id: 'call-7', leadName: 'Robert Hayes', date: '2026-03-30T14:00:00Z', duration: 2100, outcome: 'no-close', aiScorecard: { ...recentCalls[1].aiScorecard, overallScore: 55 } },
  { ...recentCalls[2], id: 'call-8', leadName: 'Lisa Park', date: '2026-03-29T11:30:00Z', duration: 1680, outcome: 'no-close', aiScorecard: { ...recentCalls[2].aiScorecard, overallScore: 48 } },
  { ...recentCalls[3], id: 'call-9', leadName: 'Chris Evans', date: '2026-03-29T15:00:00Z', duration: 2400, dealValue: 3900, outcome: 'closed', aiScorecard: { ...recentCalls[3].aiScorecard, overallScore: 85 } },
  { ...recentCalls[4], id: 'call-10', leadName: 'Emily Watson', date: '2026-03-28T09:00:00Z', duration: 1560, dealValue: 4000, outcome: 'closed', aiScorecard: { ...recentCalls[4].aiScorecard, overallScore: 81 } },
  { ...recentCalls[0], id: 'call-11', leadName: 'Tom Brady', date: '2026-03-28T16:00:00Z', duration: 2700, dealValue: 6000, outcome: 'closed', aiScorecard: { ...recentCalls[0].aiScorecard, overallScore: 95 } },
];

export default function CallsPage() {
  const [expandedId, setExpandedId] = useState(null);
  const [filterCloser, setFilterCloser] = useState('all');
  const [filterSource, setFilterSource] = useState('all');
  const [filterOutcome, setFilterOutcome] = useState('all');
  const [filterRange, setFilterRange] = useState('7d');

  const filtered = allCalls.filter((c) => {
    if (filterCloser !== 'all' && c.closerId !== filterCloser) return false;
    if (filterSource !== 'all' && c.leadSource !== filterSource) return false;
    if (filterOutcome !== 'all' && c.outcome !== filterOutcome) return false;
    return true;
  });

  const totalCalls = filtered.length;
  const closedCalls = filtered.filter((c) => c.outcome === 'closed').length;
  const totalRev = filtered.filter((c) => c.dealValue).reduce((s, c) => s + c.dealValue, 0);
  const avgScore = Math.round(filtered.reduce((s, c) => s + c.aiScorecard.overallScore, 0) / filtered.length);

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <h1 className="font-display text-2xl font-bold text-crm-text-bright mb-6">Call Center</h1>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Calls', value: totalCalls },
          { label: 'Closed', value: closedCalls },
          { label: 'Revenue', value: formatCurrency(totalRev), color: 'text-crm-positive' },
          { label: 'Avg AI Score', value: avgScore, color: avgScore >= 70 ? 'text-crm-positive' : 'text-crm-warning' },
        ].map((s) => (
          <div key={s.label} className="glass-card p-4">
            <div className="text-xs font-mono text-crm-muted uppercase tracking-wider mb-1">{s.label}</div>
            <div className={`font-display font-bold text-xl ${s.color || 'text-crm-text-bright'}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <Filter className="w-4 h-4 text-crm-muted" />
        <select value={filterRange} onChange={(e) => setFilterRange(e.target.value)} className="bg-white/5 border border-crm-border rounded-lg px-3 py-1.5 text-sm text-crm-text focus:outline-none">
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
        </select>
        <select value={filterCloser} onChange={(e) => setFilterCloser(e.target.value)} className="bg-white/5 border border-crm-border rounded-lg px-3 py-1.5 text-sm text-crm-text focus:outline-none">
          <option value="all">All Closers</option>
          {closers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)} className="bg-white/5 border border-crm-border rounded-lg px-3 py-1.5 text-sm text-crm-text focus:outline-none">
          <option value="all">All Sources</option>
          <option value="inbound">Inbound</option>
          <option value="outbound">Outbound</option>
        </select>
        <select value={filterOutcome} onChange={(e) => setFilterOutcome(e.target.value)} className="bg-white/5 border border-crm-border rounded-lg px-3 py-1.5 text-sm text-crm-text focus:outline-none">
          <option value="all">All Outcomes</option>
          <option value="closed">Closed</option>
          <option value="no-close">No Close</option>
        </select>
      </div>

      {/* Call List */}
      <div className="glass-card overflow-hidden">
        <div className="space-y-0">
          {filtered.map((call) => {
            const expanded = expandedId === call.id;
            const sc = call.aiScorecard;
            return (
              <div key={call.id} className="border-b border-crm-border/50 last:border-0">
                <button
                  onClick={() => setExpandedId(expanded ? null : call.id)}
                  className="w-full flex items-center gap-3 p-4 hover:bg-white/[0.02] transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-xs font-bold text-crm-text">
                    {getInitials(call.closerName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-crm-text-bright">{call.leadName}</div>
                    <div className="text-xs text-crm-muted">{call.closerName}</div>
                  </div>
                  <span className={`badge ${call.leadSource === 'inbound' ? 'badge-positive' : 'badge-neutral'}`}>{call.leadSource}</span>
                  <span className="text-xs font-mono text-crm-muted w-12">{formatDuration(call.duration)}</span>
                  <span className={`badge ${call.outcome === 'closed' ? 'badge-positive' : 'badge-negative'}`}>{call.outcome === 'closed' ? 'Closed' : 'No Close'}</span>
                  {call.dealValue ? <span className="text-sm font-mono text-crm-positive w-16 text-right">{formatCurrency(call.dealValue)}</span> : <span className="w-16" />}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border ${getScoreBg(sc.overallScore)} ${getScoreColor(sc.overallScore)}`}>{sc.overallScore}</div>
                  {expanded ? <ChevronUp className="w-4 h-4 text-crm-muted" /> : <ChevronDown className="w-4 h-4 text-crm-muted" />}
                </button>
                {expanded && (
                  <div className="px-4 pb-4 bg-white/[0.01]">
                    <p className="text-sm text-crm-text mb-3">{sc.summary}</p>
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
                      {sc.objectionsRaised.map((obj, i) => <span key={i} className="badge-warning">{obj}</span>)}
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
    </div>
  );
}
