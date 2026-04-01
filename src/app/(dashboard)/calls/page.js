'use client';
import { useState } from 'react';
import { Filter, ChevronDown, ChevronUp, ExternalLink, CheckCircle, XCircle, PhoneCall } from 'lucide-react';
import { formatCurrency, formatDuration, getInitials, getScoreColor, getScoreBg } from '@/lib/utils';
import { recentCalls, closers } from '@/lib/mock-data';
import EmptyState from '@/components/EmptyState';

var allCalls = recentCalls.slice();

function getScoreClass(score) {
  if (score >= 80) return 'score-high';
  if (score >= 60) return 'score-mid';
  return 'score-low';
}

export default function CallsPage() {
  var s1 = useState(null), expandedId = s1[0], setExpandedId = s1[1];
  var s2 = useState('all'), filterCloser = s2[0], setFilterCloser = s2[1];
  var s3 = useState('all'), filterSource = s3[0], setFilterSource = s3[1];
  var s4 = useState('all'), filterOutcome = s4[0], setFilterOutcome = s4[1];
  var s5 = useState('7d'), filterRange = s5[0], setFilterRange = s5[1];

  var filtered = allCalls.filter(function(c) {
    if (filterCloser !== 'all' && c.closerId !== filterCloser) return false;
    if (filterSource !== 'all' && c.leadSource !== filterSource) return false;
    if (filterOutcome !== 'all' && c.outcome !== filterOutcome) return false;
    return true;
  });

  var totalCalls = filtered.length;
  var closedCalls = filtered.filter(function(c) { return c.outcome === 'closed'; }).length;
  var totalRev = filtered.filter(function(c) { return c.dealValue; }).reduce(function(s, c) { return s + c.dealValue; }, 0);
  var avgScore = totalCalls > 0 ? Math.round(filtered.reduce(function(s, c) { return s + c.aiScorecard.overallScore; }, 0) / totalCalls) : 0;

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <h1 className="font-display text-2xl font-bold text-crm-text-bright mb-6">Call Center</h1>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Calls', value: totalCalls },
          { label: 'Closed', value: closedCalls },
          { label: 'Revenue', value: formatCurrency(totalRev), color: 'metric-positive' },
          { label: 'Avg AI Score', value: avgScore || '--', color: avgScore >= 70 ? 'metric-positive' : avgScore > 0 ? 'text-crm-warning' : 'text-crm-muted' },
        ].map(function(s, idx) {
          return (
            <div key={s.label} className={'glass-card p-4 stagger-' + (idx + 1)}>
              <div className="text-xs font-mono text-crm-muted uppercase tracking-wider mb-1">{s.label}</div>
              <div className={'font-display font-bold text-xl ' + (s.color || 'text-crm-text-bright')}>{s.value}</div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <Filter className="w-4 h-4 text-crm-muted" />
        <select value={filterRange} onChange={function(e) { setFilterRange(e.target.value); }} className="input-field w-auto py-1.5">
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
        </select>
        <select value={filterCloser} onChange={function(e) { setFilterCloser(e.target.value); }} className="input-field w-auto py-1.5">
          <option value="all">All Closers</option>
          {closers.map(function(c) { return <option key={c.id} value={c.id}>{c.name}</option>; })}
        </select>
        <select value={filterSource} onChange={function(e) { setFilterSource(e.target.value); }} className="input-field w-auto py-1.5">
          <option value="all">All Sources</option>
          <option value="inbound">Inbound</option>
          <option value="outbound">Outbound</option>
        </select>
        <select value={filterOutcome} onChange={function(e) { setFilterOutcome(e.target.value); }} className="input-field w-auto py-1.5">
          <option value="all">All Outcomes</option>
          <option value="closed">Closed</option>
          <option value="no-close">No Close</option>
        </select>
      </div>

      {/* Call List */}
      <div className="glass-card overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState icon={PhoneCall} title="No calls recorded yet" subtitle="Call data flows in from JustCall and Fathom" />
        ) : (
          <div className="space-y-0">
            {filtered.map(function(call) {
              var expanded = expandedId === call.id;
              var sc = call.aiScorecard;
              return (
                <div key={call.id} className="border-b border-crm-border/50 last:border-0">
                  <button
                    onClick={function() { setExpandedId(expanded ? null : call.id); }}
                    className="w-full flex items-center gap-3 p-4 hover:bg-white/[0.02] transition-colors text-left"
                  >
                    <div className="avatar avatar-sm text-crm-text">
                      {getInitials(call.closerName)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-crm-text-bright">{call.leadName}</div>
                      <div className="text-xs text-crm-muted">{call.closerName}</div>
                    </div>
                    <span className={'badge ' + (call.leadSource === 'inbound' ? 'badge-positive' : 'badge-neutral')}>{call.leadSource}</span>
                    <span className="text-xs font-mono text-crm-muted w-12">{formatDuration(call.duration)}</span>
                    <span className={'badge ' + (call.outcome === 'closed' ? 'badge-positive' : 'badge-negative')}>{call.outcome === 'closed' ? 'Closed' : 'No Close'}</span>
                    {call.dealValue ? <span className="text-sm font-mono text-crm-positive w-16 text-right">{formatCurrency(call.dealValue)}</span> : <span className="w-16" />}
                    <div className={'score-circle ' + getScoreClass(sc.overallScore)}>{sc.overallScore}</div>
                    {expanded ? <ChevronUp className="w-4 h-4 text-crm-muted" /> : <ChevronDown className="w-4 h-4 text-crm-muted" />}
                  </button>
                  {expanded && (
                    <div className="px-4 pb-4">
                      <p className="text-sm text-crm-text mb-3">{sc.summary}</p>
                      <div className="grid grid-cols-4 gap-2 mb-3">
                        <div className="glass-surface p-2 text-center">
                          <div className="text-xs text-crm-muted mb-1">Discovery</div>
                          {sc.discoveryDone ? <CheckCircle className="w-4 h-4 text-crm-positive mx-auto" /> : <XCircle className="w-4 h-4 text-crm-negative mx-auto" />}
                        </div>
                        <div className="glass-surface p-2 text-center">
                          <div className="text-xs text-crm-muted mb-1">Objections</div>
                          <div className={'text-sm font-bold ' + (sc.objectionHandling >= 7 ? 'text-crm-positive' : sc.objectionHandling >= 5 ? 'text-crm-warning' : 'text-crm-negative')}>{sc.objectionHandling}/10</div>
                        </div>
                        <div className="glass-surface p-2 text-center">
                          <div className="text-xs text-crm-muted mb-1">Urgency</div>
                          {sc.urgencyCreated ? <CheckCircle className="w-4 h-4 text-crm-positive mx-auto" /> : <XCircle className="w-4 h-4 text-crm-negative mx-auto" />}
                        </div>
                        <div className="glass-surface p-2 text-center">
                          <div className="text-xs text-crm-muted mb-1">Talk/Listen</div>
                          <div className={'text-sm font-bold ' + (call.talkToListenRatio <= 50 ? 'text-crm-positive' : 'text-crm-negative')}>{call.talkToListenRatio}/{100 - call.talkToListenRatio}</div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {sc.objectionsRaised.map(function(obj, i) { return <span key={i} className="badge-warning">{obj}</span>; })}
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
        )}
      </div>
    </div>
  );
}
