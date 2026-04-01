'use client';
import { useState } from 'react';
import { ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { formatCurrency, formatTime, getInitials } from '@/lib/utils';
import { recentEODs, closers } from '@/lib/mock-data';

function StatusBadge({ status }) {
  const map = { submitted: 'badge-positive', late: 'badge-warning', missing: 'badge-negative' };
  return <span className={map[status] || 'badge-neutral'}>{status}</span>;
}

export default function EODLogsPage() {
  const [filterCloser, setFilterCloser] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const totalCash = recentEODs.reduce((s, e) => s + e.cashCollected, 0);
  const totalCloses = recentEODs.reduce((s, e) => s + e.closes, 0);
  const totalDials = recentEODs.reduce((s, e) => s + e.totalDials, 0);
  const submitted = recentEODs.filter((e) => e.status === 'submitted').length;

  const filtered = recentEODs.filter((e) => {
    if (filterCloser !== 'all' && e.closerId !== filterCloser) return false;
    if (filterStatus !== 'all' && e.status !== filterStatus) return false;
    return true;
  });

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-bold text-crm-text-bright">EOD Logs</h1>
        <div className="flex items-center gap-3">
          <button className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-crm-muted transition-colors"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-sm font-mono text-crm-text-bright">March 31, 2026</span>
          <button className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-crm-muted transition-colors"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Summary Bar */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Cash', value: formatCurrency(totalCash), color: 'text-crm-positive' },
          { label: 'Total Closes', value: totalCloses, color: 'text-crm-text-bright' },
          { label: 'Total Dials', value: totalDials, color: 'text-crm-text-bright' },
          { label: 'Submitted', value: `${submitted}/${recentEODs.length}`, color: submitted === recentEODs.length ? 'text-crm-positive' : 'text-crm-warning' },
        ].map((s) => (
          <div key={s.label} className="glass-card p-4">
            <div className="text-xs font-mono text-crm-muted uppercase tracking-wider mb-1">{s.label}</div>
            <div className={`font-display font-bold text-xl ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <Filter className="w-4 h-4 text-crm-muted" />
        <select value={filterCloser} onChange={(e) => setFilterCloser(e.target.value)} className="bg-white/5 border border-crm-border rounded-lg px-3 py-1.5 text-sm text-crm-text focus:outline-none">
          <option value="all">All Closers</option>
          {closers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="bg-white/5 border border-crm-border rounded-lg px-3 py-1.5 text-sm text-crm-text focus:outline-none">
          <option value="all">All Status</option>
          <option value="submitted">Submitted</option>
          <option value="late">Late</option>
          <option value="missing">Missing</option>
        </select>
      </div>

      {/* EOD Cards */}
      <div className="space-y-4">
        {filtered.map((eod) => (
          <div key={eod.id} className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-sm font-bold text-crm-text">
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
                  ].map((m) => (
                    <div key={m.label} className="rounded-lg bg-white/[0.03] p-2 text-center">
                      <div className="text-xs text-crm-muted mb-1">{m.label}</div>
                      <div className={`font-mono font-bold ${m.color || 'text-crm-text-bright'}`}>{m.value}</div>
                    </div>
                  ))}
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
                  <div className="w-24 h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${eod.confidenceScore >= 7 ? 'bg-crm-positive' : eod.confidenceScore >= 5 ? 'bg-crm-warning' : 'bg-crm-negative'}`} style={{ width: `${eod.confidenceScore * 10}%` }} />
                  </div>
                  <span className="text-xs font-mono text-crm-muted">{eod.confidenceScore}/10</span>
                </div>
              </>
            ) : (
              <div className="text-sm text-crm-negative py-4 text-center">No EOD report submitted</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
