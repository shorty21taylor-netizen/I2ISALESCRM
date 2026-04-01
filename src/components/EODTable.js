'use client';
import { FileText } from 'lucide-react';
import { formatCurrency, formatTime, getInitials } from '@/lib/utils';
import EmptyState from '@/components/EmptyState';

function StatusBadge({ status }) {
  var map = {
    submitted: 'badge-positive',
    late: 'badge-warning',
    missing: 'badge-negative',
  };
  return <span className={map[status] || 'badge-neutral'}>{status}</span>;
}

function ConfidenceBar({ score }) {
  if (score === 0) return <span className="text-crm-muted text-xs">--</span>;
  var width = (score / 10) * 100;
  var fillClass = score >= 7 ? 'progress-fill-green' : score >= 5 ? 'progress-fill-amber' : 'progress-fill-red';
  return (
    <div className="flex items-center gap-2">
      <div className="progress-bar w-16">
        <div className={'progress-fill ' + fillClass} style={{ width: width + '%' }} />
      </div>
      <span className="text-xs font-mono text-crm-muted">{score}/10</span>
    </div>
  );
}

export default function EODTable({ reports }) {
  if (!reports || reports.length === 0) {
    return (
      <div className="glass-card overflow-hidden">
        <div className="section-header">
          <h3>Today&apos;s EOD Reports</h3>
          <span className="section-tag">0 reports</span>
        </div>
        <EmptyState icon={FileText} title="No EOD reports yet" subtitle="Reports appear when closers submit their end-of-day" />
      </div>
    );
  }

  return (
    <div className="glass-card overflow-hidden">
      <div className="section-header">
        <h3>Today&apos;s EOD Reports</h3>
        <span className="section-tag">{reports.length} reports</span>
      </div>
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Closer</th>
              <th>Status</th>
              <th>Dials</th>
              <th>Connects</th>
              <th>Booked</th>
              <th>Closes</th>
              <th>Cash</th>
              <th>Confidence</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {reports.map(function(r) {
              return (
                <tr key={r.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="avatar avatar-sm text-crm-text">
                        {getInitials(r.closerName)}
                      </div>
                      <span className="text-crm-text-bright text-sm">{r.closerName}</span>
                    </div>
                  </td>
                  <td><StatusBadge status={r.status} /></td>
                  <td className="font-mono">{r.totalDials || '--'}</td>
                  <td className="font-mono">{r.connects || '--'}</td>
                  <td className="font-mono">{r.callsBooked || '--'}</td>
                  <td className="font-mono">{r.closes || '--'}</td>
                  <td className="font-mono text-crm-positive">{r.cashCollected ? formatCurrency(r.cashCollected) : '--'}</td>
                  <td><ConfidenceBar score={r.confidenceScore} /></td>
                  <td className="text-xs font-mono text-crm-muted">{formatTime(r.submittedAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
