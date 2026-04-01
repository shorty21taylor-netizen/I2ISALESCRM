'use client';
import { formatCurrency, formatTime, getInitials } from '@/lib/utils';

function StatusBadge({ status }) {
  const map = {
    submitted: 'badge-positive',
    late: 'badge-warning',
    missing: 'badge-negative',
  };
  return <span className={map[status] || 'badge-neutral'}>{status}</span>;
}

function ConfidenceBar({ score }) {
  if (score === 0) return <span className="text-crm-muted text-xs">--</span>;
  const width = (score / 10) * 100;
  const color = score >= 7 ? 'bg-crm-positive' : score >= 5 ? 'bg-crm-warning' : 'bg-crm-negative';
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${width}%` }} />
      </div>
      <span className="text-xs font-mono text-crm-muted">{score}/10</span>
    </div>
  );
}

export default function EODTable({ reports }) {
  return (
    <div className="glass-card overflow-hidden">
      <div className="px-5 py-4 border-b border-crm-border">
        <h3 className="text-sm font-mono text-crm-muted uppercase tracking-wider">Today&apos;s EOD Reports</h3>
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
            {reports.map((r) => (
              <tr key={r.id}>
                <td>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-xs font-bold text-crm-text">
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
