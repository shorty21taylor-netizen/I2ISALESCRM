'use client';
import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Filter, FileText } from 'lucide-react';
import { formatCurrency, formatTime, getInitials } from '@/lib/utils';
import EmptyState from '@/components/EmptyState';

function StatusBadge({ status }) {
  var map = { submitted: 'badge-positive', late: 'badge-warning', missing: 'badge-negative' };
  return <span className={map[status] || 'badge-neutral'}>{status}</span>;
}

export default function EODLogsPage() {
  var s1 = useState('all'), filterCloser = s1[0], setFilterCloser = s1[1];
  var s2 = useState('all'), filterStatus = s2[0], setFilterStatus = s2[1];
  var s3 = useState([]), liveEODs = s3[0], setLiveEODs = s3[1];
  var s4 = useState([]), closerNames = s4[0], setCloserNames = s4[1];

  useEffect(function() {
    fetch('/api/webhooks/eod-report')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.success && data.data) {
          setLiveEODs(data.data);
          var names = {};
          data.data.forEach(function(e) { names[e.salesRep] = true; });
          delete names[''];
          setCloserNames(Object.keys(names));
        }
      })
      .catch(function() {});
  }, []);

  var totalCash = liveEODs.reduce(function(s, e) { return s + (e.cashCollectedMYFM || 0) + (e.cashCollectedI2I || 0); }, 0);
  var totalCloses = liveEODs.reduce(function(s, e) { return s + (e.closes || 0); }, 0);
  var totalDials = liveEODs.reduce(function(s, e) { return s + (e.outboundDials || 0); }, 0);
  var submitted = liveEODs.filter(function(e) { return e.status === 'submitted'; }).length;

  var filtered = liveEODs.filter(function(e) {
    if (filterCloser !== 'all' && e.salesRep !== filterCloser) return false;
    if (filterStatus !== 'all' && e.status !== filterStatus) return false;
    return true;
  });

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-bold text-crm-text-bright">EOD Logs</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm font-mono text-crm-text-bright">{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
        </div>
      </div>

      {/* Summary Bar */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Cash', value: formatCurrency(totalCash), color: 'metric-positive' },
          { label: 'Total Closes', value: totalCloses, color: 'text-crm-text-bright' },
          { label: 'Total Dials', value: totalDials, color: 'text-crm-text-bright' },
          { label: 'Submitted', value: liveEODs.length > 0 ? submitted + '/' + liveEODs.length : '0', color: submitted === liveEODs.length && liveEODs.length > 0 ? 'metric-positive' : 'text-crm-muted' },
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
          <option value="all">All Reps</option>
          {closerNames.map(function(name) { return <option key={name} value={name}>{name}</option>; })}
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
          <EmptyState icon={FileText} title="No EOD reports yet" subtitle="Reports will appear when reps submit their end-of-day" />
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(function(eod) {
            var totalEodCash = (eod.cashCollectedMYFM || 0) + (eod.cashCollectedI2I || 0);
            return (
              <div key={eod.id} className="glass-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="avatar avatar-md text-crm-text">
                      {getInitials(eod.salesRep)}
                    </div>
                    <div>
                      <div className="font-medium text-crm-text-bright">{eod.salesRep}</div>
                      <div className="text-xs text-crm-muted">Submitted {formatTime(eod.submittedAt)} &middot; {eod.date}</div>
                    </div>
                  </div>
                  <StatusBadge status={eod.status} />
                </div>

                {eod.status !== 'missing' ? (
                  <>
                    <div className="grid grid-cols-6 gap-3 mb-4">
                      {[
                        { label: 'Outbound Dials', value: eod.outboundDials || 0 },
                        { label: 'Net New Booked', value: eod.netNewCallsBooked || 0 },
                        { label: 'On Calendar', value: eod.callsOnCalendar || 0 },
                        { label: 'Taken & Pitched', value: eod.callsTakenAndPitched || 0 },
                        { label: 'Closes', value: eod.closes || 0 },
                        { label: 'Cash', value: formatCurrency(totalEodCash), color: 'text-crm-positive' },
                      ].map(function(m) {
                        return (
                          <div key={m.label} className="glass-surface p-2 text-center">
                            <div className="text-xs text-crm-muted mb-1">{m.label}</div>
                            <div className={'font-mono font-bold ' + (m.color || 'text-crm-text-bright')}>{m.value}</div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="grid grid-cols-4 gap-3 mb-4">
                      {[
                        { label: 'No-Showed', value: eod.callsNoShowed || 0 },
                        { label: 'Canceled', value: eod.callsCanceled || 0 },
                        { label: 'Rescheduled', value: eod.callsRescheduled || 0 },
                        { label: 'Revenue', value: formatCurrency(eod.revenueOnDay || 0), color: 'text-crm-positive' },
                      ].map(function(m) {
                        return (
                          <div key={m.label} className="glass-surface p-2 text-center">
                            <div className="text-xs text-crm-muted mb-1">{m.label}</div>
                            <div className={'font-mono font-bold text-sm ' + (m.color || 'text-crm-text-bright')}>{m.value}</div>
                          </div>
                        );
                      })}
                    </div>
                    {(eod.cashCollectedMYFM > 0 || eod.cashCollectedI2I > 0) && (
                      <div className="flex items-center gap-4 mb-3 text-xs text-crm-muted">
                        <span>MYFM: <span className="text-crm-text-bright font-mono">{formatCurrency(eod.cashCollectedMYFM || 0)}</span></span>
                        <span>I2I: <span className="text-crm-text-bright font-mono">{formatCurrency(eod.cashCollectedI2I || 0)}</span></span>
                      </div>
                    )}
                    {eod.improvementPlan && (
                      <div className="text-sm text-crm-text mt-2"><span className="text-crm-muted">Improvement Plan:</span> {eod.improvementPlan}</div>
                    )}
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
