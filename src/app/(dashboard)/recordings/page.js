'use client';
import { useState } from 'react';
import { PlayCircle, ExternalLink, Filter, CheckCircle, XCircle } from 'lucide-react';
import { formatCurrency, formatDuration, getInitials } from '@/lib/utils';
import { recentCalls, closers } from '@/lib/mock-data';
import EmptyState from '@/components/EmptyState';

function getScoreClass(score) {
  if (score >= 80) return 'score-high';
  if (score >= 60) return 'score-mid';
  return 'score-low';
}

export default function RecordingsPage() {
  var s1 = useState('all'), filterCloser = s1[0], setFilterCloser = s1[1];
  var s2 = useState('all'), filterOutcome = s2[0], setFilterOutcome = s2[1];
  var s3 = useState('all'), filterScore = s3[0], setFilterScore = s3[1];

  var filtered = recentCalls.filter(function(c) {
    if (filterCloser !== 'all' && c.closerId !== filterCloser) return false;
    if (filterOutcome !== 'all' && c.outcome !== filterOutcome) return false;
    if (filterScore === 'high' && c.aiScorecard.overallScore < 80) return false;
    if (filterScore === 'mid' && (c.aiScorecard.overallScore < 60 || c.aiScorecard.overallScore >= 80)) return false;
    if (filterScore === 'low' && c.aiScorecard.overallScore >= 60) return false;
    return true;
  });

  return (
    <div className="px-4 md:px-6 py-4 md:py-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-4 md:mb-6">
        <h1 className="font-display text-xl md:text-2xl font-bold text-crm-text-bright">Recordings</h1>
        <div className="flex items-center gap-2 text-xs text-crm-muted glass-surface px-3 py-1.5">
          <PlayCircle className="w-4 h-4" />
          <span>{recentCalls.length} recordings with AI analysis</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-4 md:mb-6">
        <Filter className="w-4 h-4 text-crm-muted" />
        <select value={filterCloser} onChange={function(e) { setFilterCloser(e.target.value); }} className="input-field w-auto py-1.5 text-sm">
          <option value="all">All Closers</option>
          {closers.map(function(c) { return <option key={c.id} value={c.id}>{c.name}</option>; })}
        </select>
        <select value={filterOutcome} onChange={function(e) { setFilterOutcome(e.target.value); }} className="input-field w-auto py-1.5 text-sm">
          <option value="all">All Outcomes</option>
          <option value="closed">Closed</option>
          <option value="no-close">No Close</option>
        </select>
        <select value={filterScore} onChange={function(e) { setFilterScore(e.target.value); }} className="input-field w-auto py-1.5 text-sm">
          <option value="all">All Scores</option>
          <option value="high">80+ (High)</option>
          <option value="mid">60-79 (Mid)</option>
          <option value="low">&lt;60 (Low)</option>
        </select>
      </div>

      {/* Cards Grid */}
      {filtered.length === 0 ? (
        <div className="glass-card overflow-hidden">
          <EmptyState icon={PlayCircle} title="No recordings yet" subtitle="Recordings appear when calls are logged via JustCall and Fathom" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(function(call) {
            var sc = call.aiScorecard;
            return (
              <div key={call.id} className="glass-card p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="avatar avatar-md text-crm-text">
                      {getInitials(call.closerName)}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-crm-text-bright">{call.leadName}</div>
                      <div className="text-xs text-crm-muted">{call.closerName} &middot; {formatDuration(call.duration)}</div>
                    </div>
                  </div>
                  <div className={'score-circle ' + getScoreClass(sc.overallScore)}>
                    {sc.overallScore}
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-3">
                  <span className={'badge ' + (call.leadSource === 'inbound' ? 'badge-positive' : 'badge-neutral')}>{call.leadSource}</span>
                  <span className={'badge ' + (call.outcome === 'closed' ? 'badge-positive' : 'badge-negative')}>{call.outcome === 'closed' ? 'Closed' : 'No Close'}</span>
                  {call.dealValue && <span className="text-sm font-mono metric-positive">{formatCurrency(call.dealValue)}</span>}
                </div>

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
                    <div className="text-xs text-crm-muted mb-1">Sentiment</div>
                    <span className={'text-sm font-bold ' + (sc.sentimentTrend === 'positive' ? 'text-crm-positive' : 'text-crm-negative')}>{sc.sentimentTrend}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 mb-3">
                  {sc.objectionsRaised.map(function(obj, i) { return <span key={i} className="badge-warning">{obj}</span>; })}
                </div>

                {call.fathomRecordingUrl && (
                  <a href={call.fathomRecordingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-crm-accent hover:text-crm-accent-glow transition-colors">
                    <PlayCircle className="w-4 h-4" /> Watch Recording
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
