'use client';
import { useState } from 'react';
import { ChevronLeft, ChevronRight, Filter, FileText } from 'lucide-react';
import { formatCurrency, formatTime, getInitials } from '@/lib/utils';
import { recentEODs, closers } from '@/lib/mock-data';
import EmptyState from '@/components/EmptyState';

function StatusBadge({ status }) {
  var map = { submitted: 'badge-positive', late: 'badge-warning', missing: 'badge-negative' };
  return <span className={map[status] || 'badge-neutral'}>{status}</span>;
}

export default function EODLogsPage() {
  var s1 = useState('all'), filterCloser = s1[0], setFilterCloser = s1[1];
  var s2 = useState('all'), filterStatus = s2[0], setFilterStatus = s2[1];

  var totalCash = recentEODs.reduce(function(s, e) { return s + e.cashCollected; }, 0);
  var totalCloses = recentEODs.reduce(function(s, e) { return s + e.closes; }, 0);
  var totalDials = recentEODs.reduce(function(s, e) { return s + e.totalDials; }, 0);
  var submitted = recentEODs.filter(function(e) { return e.status === 'submitted'; }).length;

  var filtered = recentEODs.filter(function(e) {
    if (filterCloser !== 'all' && e.closerId !== filterCloser) return false;
    if (filterStatus !== 'all' && e.status !== filterStatus) return false;
    return true;
  });

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-bold text-crm-text-bright">EOD Logs</h1>
        <div className="flex items-center gap-3">
          <button className="btn-ghost p-2"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-sm font-mono text-crm-text-bright">March 31, 2026</span>
          <button className="btn-ghost p-2"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Summary Bar */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Cash', value: formatCurrency(totalCash), color: 'metric-positive' },
          { label: 'Total Closes', value: totalCloses, color: 'text-crm-text-bright' },
          { label: 'Total Dials', value: totalDials, color: 'text-crm-text-bright' },
          { label: 'Submitted', value: recentEODs.length > 0 ? submitted + '/' + recentEODs.length : '0', color: submitted === recentEODs.length && recentEODs.length > 0 ? 'metric-positive' : 'text-crm-muted' },
        ].map(function(s, idx) {
          return (
            <div key={s.label} className={'glass-card p-4 stagger-' + (idx + 1)}>
              <div className="text-xs font-mono text-crm-muted uppercase tracking-wider mb-1">{s.label}</div>
              <div className={'font-display font-bold text-xl ' + s.color}>{s.value}</div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <Filter className="w-4 h-4 text-crm-muted" />
        <select value={filterCloser} onChange={function(e) { setFilterCloser(e.target.value); }} className="input-field w-auto py-1.5">
          <option value="all">All Closers</option>
          {closers.map(function(c) { return <option key={c.id} value={c.id}>{c.name}</option>; })}
        </select>
        <select value={filterStatus} onChange={function(e) { setFilterStatus(e.target.value); }} className="input-field w-auto py-1.5">
          <option value="all">All Status</option>
          <option value="submitted">Submitted</option>
          <option value="late">Late</option>
          <option value="missing">Missing</option>
        </select>
      </div>

      {/* EOD Cards */}
      {filtered.length === 0 ? (
        <div className="glass-card overflow-hidden">
          <EmptyState icon={FileText} title="No EOD reports yet" subtitle="Reports will appear when closers submit their end-of-day" />
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(function(eod) {
            return (
              <div key={eod.id} className="glass-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="avatar avatar-md text-crm-text">
                      {getInitials(eod.closerName)}
                    </div>
                    <div>
                      <div className="font-medium text-crm-text-bright">{eod.closerName}</div>
                      <div className="text-xs text-crm-muted">Submitted {formatTime(eod.submittedAt)}</div>
                    </div>
                  </div>
                  <StatusBadge status={eod.status} />
                </div>

                {eod.status !== 'missing' ? (
                  <>
                    <div className="grid grid-cols-6 gap-3 mb-4">
                      {[
                        { label: 'Dials', value: eod.totalDials },
                        { label: 'Connects', value: eod.connects },
                        { label: 'Booked', value: eod.callsBooked },
                        { label: 'Taken', value: eod.callsTaken },
                        { label: 'Closes', value: eod.closes },
                        { label: 'Cash', value: formatCurrency(eod.cashCollected), color: 'text-crm-positive' },
                      ].map(function(m) {
                        return (
                          <div key={m.label} className="glass-surface p-2 text-center">
                            <div className="text-xs text-crm-muted mb-1">{m.label}</div>
                            <div className={'font-mono font-bold ' + (m.color || 'text-crm-text-bright')}>{m.value}</div>
                          </div>
                        );
                      })}
                    </div>
                    {eod.pipelineNotes && (
                      <div className="text-sm text-crm-text mb-2"><span className="text-crm-muted">Pipeline:</span> {eod.pipelineNotes}</div>
                    )}
                    <div className="grid grid-cols-2 gap-4 mb-3">
                      {eod.biggestWin && (
                        <div className="text-sm"><span className="text-crm-positive">Win:</span> <span className="text-crm-text">{eod.biggestWin}</span></div>
                      )}
                      {eod.biggestLoss && (
                        <div className="text-sm"><span className="text-crm-negative">Loss:</span> <span className="text-crm-text">{eod.biggestLoss}</span></div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-crm-muted">Confidence:</span>
                      <div className="progress-bar w-24">
                        <div className={'progress-fill ' + (eod.confidenceScore >= 7 ? 'progress-fill-green' : eod.confidenceScore >= 5 ? 'progress-fill-amber' : 'progress-fill-red')} style={{ width: (eod.confidenceScore * 10) + '%' }} />
                      </div>
                      <span className="text-xs font-mono text-crm-muted">{eod.confidenceScore}/10</span>
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-crm-negative py-4 text-center">No EOD report submitted</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
