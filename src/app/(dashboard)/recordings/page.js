'use client';
import { useState } from 'react';
import { PlayCircle, ExternalLink, Filter, CheckCircle, XCircle } from 'lucide-react';
import { formatCurrency, formatDuration, getInitials, getScoreColor, getScoreBg } from '@/lib/utils';
import { recentCalls, closers } from '@/lib/mock-data';

export default function RecordingsPage() {
  const [filterCloser, setFilterCloser] = useState('all');
  const [filterOutcome, setFilterOutcome] = useState('all');
  const [filterScore, setFilterScore] = useState('all');

  const filtered = recentCalls.filter((c) => {
    if (filterCloser !== 'all' && c.closerId !== filterCloser) return false;
    if (filterOutcome !== 'all' && c.outcome !== filterOutcome) return false;
    if (filterScore === 'high' && c.aiScorecard.overallScore < 80) return false;
    if (filterScore === 'mid' && (c.aiScorecard.overallScore < 60 || c.aiScorecard.overallScore >= 80)) return false;
    if (filterScore === 'low' && c.aiScorecard.overallScore >= 60) return false;
    return true;
  });

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-bold text-crm-text-bright">Recordings</h1>
        <div className="flex items-center gap-2 text-xs text-crm-muted">
          <PlayCircle className="w-4 h-4" />
          <span>{recentCalls.length} recordings with AI analysis</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6">
        <Filter className="w-4 h-4 text-crm-muted" />
        <select value={filterCloser} onChange={(e) => setFilterCloser(e.target.value)} className="bg-white/5 border border-crm-border rounded-lg px-3 py-1.5 text-sm text-crm-text focus:outline-none">
          <option value="all">All Closers</option>
          {closers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={filterOutcome} onChange={(e) => setFilterOutcome(e.target.value)} className="bg-white/5 border border-crm-border rounded-lg px-3 py-1.5 text-sm text-crm-text focus:outline-none">
          <option value="all">All Outcomes</option>
          <option value="closed">Closed</option>
          <option value="no-close">No Close</option>
        </select>
        <select value={filterScore} onChange={(e) => setFilterScore(e.target.value)} className="bg-white/5 border border-crm-border rounded-lg px-3 py-1.5 text-sm text-crm-text focus:outline-none">
          <option value="all">All Scores</option>
          <option value="high">80+ (High)</option>
          <option value="mid">60-79 (Mid)</option>
          <option value="low">&lt;60 (Low)</option>
        </select>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-2 gap-4">
        {filtered.map((call) => {
          const sc = call.aiScorecard;
          return (
            <div key={call.id} className="glass-card p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-sm font-bold text-crm-text">
                    {getInitials(call.closerName)}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-crm-text-bright">{call.leadName}</div>
                    <div className="text-xs text-crm-muted">{call.closerName} &middot; {formatDuration(call.duration)}</div>
                  </div>
                </div>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border ${getScoreBg(sc.overallScore)} ${getScoreColor(sc.overallScore)}`}>
                  {sc.overallScore}
                </div>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <span className={`badge ${call.leadSource === 'inbound' ? 'badge-positive' : 'badge-neutral'}`}>{call.leadSource}</span>
                <span className={`badge ${call.outcome === 'closed' ? 'badge-positive' : 'badge-negative'}`}>{call.outcome === 'closed' ? 'Closed' : 'No Close'}</span>
                {call.dealValue && <span className="text-sm font-mono text-crm-positive">{formatCurrency(call.dealValue)}</span>}
              </div>

              <p className="text-sm text-crm-text mb-3">{sc.summary}</p>

              <div className="grid grid-cols-4 gap-2 mb-3">
                <div className="text-center">
                  <div className="text-xs text-crm-muted mb-1">Discovery</div>
                  {sc.discoveryDone ? <CheckCircle className="w-4 h-4 text-crm-positive mx-auto" /> : <XCircle className="w-4 h-4 text-crm-negative mx-auto" />}
                </div>
                <div className="text-center">
                  <div className="text-xs text-crm-muted mb-1">Objections</div>
                  <div className={`text-sm font-bold ${sc.objectionHandling >= 7 ? 'text-crm-positive' : sc.objectionHandling >= 5 ? 'text-crm-warning' : 'text-crm-negative'}`}>{sc.objectionHandling}/10</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-crm-muted mb-1">Urgency</div>
                  {sc.urgencyCreated ? <CheckCircle className="w-4 h-4 text-crm-positive mx-auto" /> : <XCircle className="w-4 h-4 text-crm-negative mx-auto" />}
                </div>
                <div className="text-center">
                  <div className="text-xs text-crm-muted mb-1">Sentiment</div>
                  <span className={`text-sm font-bold ${sc.sentimentTrend === 'positive' ? 'text-crm-positive' : 'text-crm-negative'}`}>{sc.sentimentTrend}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 mb-3">
                {sc.objectionsRaised.map((obj, i) => <span key={i} className="badge-warning">{obj}</span>)}
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
    </div>
  );
}
