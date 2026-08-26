'use client';

import { useState, useEffect } from 'react';
import { Phone, Trash2 } from 'lucide-react';
import { useWorkspace, withWorkspace, apiFetch } from '@/lib/workspace-client';
import ExtraFields from '@/components/ExtraFields';
import ConfirmDialog from '@/components/ConfirmDialog';
import { getUser } from '@/lib/auth';

// Every answer the Lead Booking form collects, on one page. Before this the whole
// form existed only as a number on the dashboard — the credit score, intent score,
// goal and pain a setter typed were stored and never shown to anyone.

export default function BookedCallsPage() {
  var workspaceId = useWorkspace();
  var [calls, setCalls] = useState([]);
  var [loading, setLoading] = useState(true);
  var [confirmDelete, setConfirmDelete] = useState(null);
  var [deleteError, setDeleteError] = useState('');
  var [range, setRange] = useState('30');
  var [customStart, setCustomStart] = useState('');
  var [customEnd, setCustomEnd] = useState('');
  var [filterCloser, setFilterCloser] = useState('');
  var [filterSource, setFilterSource] = useState('');

  var user = getUser();
  var isAdmin = user && user.email === 'shorty21taylor@gmail.com';

  useEffect(function() { if (workspaceId) fetchCalls(); }, [workspaceId]);

  async function handleDelete(id) {
    setDeleteError('');
    try {
      var res = await apiFetch('/api/webhooks/book-call/' + id, { method: 'DELETE' });
      var out = await res.json().catch(function() { return {}; });
      if (!res.ok || out.error) setDeleteError(out.error || 'Delete failed (' + res.status + ')');
    } catch (e) {
      setDeleteError(e.message);
    }
    setConfirmDelete(null);
    fetchCalls();
  }

  async function fetchCalls() {
    setLoading(true);
    try {
      var res = await apiFetch(withWorkspace('/api/webhooks/book-call', workspaceId));
      var data = await res.json();
      setCalls((data.data || []).filter(Boolean).sort(function(a, b) {
        return (b.submittedAt || '') > (a.submittedAt || '') ? 1 : -1;
      }));
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  function getDateRange() {
    var end = new Date();
    var start = new Date();
    if (range === 'today') {
      start.setHours(0, 0, 0, 0);
    } else if (range === 'yesterday') {
      start.setDate(start.getDate() - 1); start.setHours(0, 0, 0, 0);
      end.setDate(end.getDate() - 1); end.setHours(23, 59, 59);
    } else if (range === 'custom') {
      return { start: customStart, end: customEnd || new Date().toISOString().split('T')[0] };
    } else {
      start.setDate(start.getDate() - parseInt(range));
    }
    return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
  }

  var dateRange = getDateRange();

  var filtered = calls.filter(function(c) {
    var dt = c.submittedAt ? c.submittedAt.split('T')[0] : '';
    if (dateRange.start && dt < dateRange.start) return false;
    if (dateRange.end && dt > dateRange.end) return false;
    if (filterCloser && (c.closer || '').toLowerCase() !== filterCloser.toLowerCase()) return false;
    if (filterSource && (c.outboundInbound || '').toLowerCase() !== filterSource.toLowerCase()) return false;
    return true;
  });

  var qualifiedCount = filtered.filter(function(c) { return (c.qualified || '').toLowerCase() === 'yes'; }).length;
  var withPhone = filtered.filter(function(c) { return !!c.leadsPhone; }).length;

  var closerNames = [];
  var sourceNames = [];
  calls.forEach(function(c) {
    if (c.closer && closerNames.indexOf(c.closer) === -1) closerNames.push(c.closer);
    if (c.outboundInbound && sourceNames.indexOf(c.outboundInbound) === -1) sourceNames.push(c.outboundInbound);
  });

  function detailRow(label, value) {
    if (!value) return null;
    return (
      <div>
        <span style={{ color: 'var(--crm-text-muted)' }}>{label}: </span>
        <span style={{ color: 'var(--crm-text-bright)' }}>{value}</span>
      </div>
    );
  }

  function longField(label, value) {
    if (!value) return null;
    return (
      <div className="mt-2">
        <p className="text-[9px] font-mono uppercase mb-0.5" style={{ color: 'var(--crm-text-muted)' }}>{label}</p>
        <p className="text-xs font-mono whitespace-pre-wrap" style={{ color: 'var(--crm-text-bright)' }}>{value}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="page-header py-4 md:py-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-display font-bold" style={{ color: 'var(--crm-text-bright)' }}>Booked Calls</h1>
            <p className="text-xs font-mono" style={{ color: 'var(--crm-text-muted)' }}>{filtered.length} bookings · {qualifiedCount} qualified</p>
          </div>
        </div>
      </header>

      <div className="px-4 md:px-8 pb-8">

        {deleteError && (
          <div className="glass-card p-3 mb-4" style={{ borderColor: 'rgba(239,68,68,0.3)' }}>
            <p className="text-xs font-mono" style={{ color: '#ef4444' }}>{deleteError}</p>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3 md:gap-4 mb-5">
          <div className="glass-card p-4 md:p-5">
            <p className="text-xs font-mono uppercase mb-1" style={{ color: 'var(--crm-text-muted)' }}>Bookings</p>
            <p className="text-xl md:text-2xl font-display font-bold" style={{ color: 'var(--crm-text-bright)' }}>{filtered.length}</p>
          </div>
          <div className="glass-card p-4 md:p-5">
            <p className="text-xs font-mono uppercase mb-1" style={{ color: 'var(--crm-text-muted)' }}>Qualified</p>
            <p className="text-xl md:text-2xl font-display font-bold" style={{ color: '#22c55e' }}>{qualifiedCount}</p>
          </div>
          <div className="glass-card p-4 md:p-5">
            <p className="text-xs font-mono uppercase mb-1" style={{ color: 'var(--crm-text-muted)' }}>With Phone</p>
            <p className="text-xl md:text-2xl font-display font-bold" style={{ color: 'var(--crm-text-bright)' }}>{withPhone}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 mb-4">
          {[
            { label: 'Today', value: 'today' },
            { label: 'Yesterday', value: 'yesterday' },
            { label: '7 Days', value: '7' },
            { label: '30 Days', value: '30' },
            { label: '90 Days', value: '90' },
            { label: 'Year', value: '365' },
            { label: 'All Time', value: '9999' },
            { label: 'Custom', value: 'custom' },
          ].map(function(opt) {
            return (
              <button
                key={opt.value}
                onClick={function() { setRange(opt.value); }}
                className={'px-3 py-1.5 rounded-lg text-xs font-mono transition-all ' + (range === opt.value ? 'text-crm-accent font-bold' : 'text-crm-muted')}
                style={range === opt.value ? { background: 'rgba(var(--accent-rgb),0.1)' } : {}}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {range === 'custom' && (
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <input type="date" value={customStart} onChange={function(e) { setCustomStart(e.target.value); }} className="input-field w-auto text-sm" />
            <span className="text-xs font-mono" style={{ color: 'var(--crm-text-muted)' }}>to</span>
            <input type="date" value={customEnd} onChange={function(e) { setCustomEnd(e.target.value); }} className="input-field w-auto text-sm" />
          </div>
        )}

        <div className="flex flex-wrap gap-3 mb-5">
          <select value={filterCloser} onChange={function(e) { setFilterCloser(e.target.value); }} className="input-field w-auto text-sm">
            <option value="">All Closers</option>
            {closerNames.sort().map(function(c) { return <option key={c} value={c}>{c}</option>; })}
          </select>
          <select value={filterSource} onChange={function(e) { setFilterSource(e.target.value); }} className="input-field w-auto text-sm">
            <option value="">All Sources</option>
            {sourceNames.sort().map(function(sname) { return <option key={sname} value={sname}>{sname}</option>; })}
          </select>
        </div>

        {loading ? (
          <p className="text-sm font-mono py-8 text-center" style={{ color: 'var(--crm-text-muted)' }}>Loading...</p>
        ) : filtered.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <Phone className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--crm-text-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--crm-text-muted)' }}>No booked calls in this range</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(function(call) {
              var dt = call.submittedAt ? new Date(call.submittedAt) : null;
              var dateStr = dt ? dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
              var timeStr = dt ? dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : '';
              var isQualified = (call.qualified || '').toLowerCase() === 'yes';
              var bookedFor = (call.bookedDay || call.bookedTime)
                ? ((call.bookedDay || 'TBD') + ' ' + (call.bookedTime || '')).trim()
                : '';

              return (
                <div key={call.id} className="glass-card p-4 md:p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-display font-bold truncate" style={{ color: 'var(--crm-text-bright)' }}>{call.leadsName || 'Unknown Lead'}</h3>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold flex-shrink-0"
                          style={isQualified
                            ? { background: 'rgba(34,197,94,0.15)', color: '#22c55e' }
                            : { background: 'rgba(var(--accent-rgb),0.15)', color: 'var(--crm-accent)' }}>
                          {isQualified ? 'Qualified' : (call.qualified || 'Unqualified')}
                        </span>
                      </div>
                      <p className="text-xs font-mono" style={{ color: 'var(--crm-text-muted)' }}>
                        {dateStr} {timeStr && '· ' + timeStr}
                      </p>
                    </div>
                    {call.intentScore && (
                      <div className="text-right flex-shrink-0 ml-4">
                        <p className="text-lg font-display font-bold" style={{ color: 'var(--crm-accent)' }}>{call.intentScore}</p>
                        <p className="text-[9px] font-mono uppercase" style={{ color: 'var(--crm-text-muted)' }}>Intent</p>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono">
                    {detailRow('Phone', call.leadsPhone)}
                    {detailRow('Email', call.leadsEmail)}
                    {detailRow('Source', call.outboundInbound)}
                    {detailRow('Credit', call.creditScore)}
                    {detailRow('Setter', call.setter)}
                    {detailRow('Closer', call.closer)}
                    {detailRow('Program', call.program)}
                    {detailRow('Booked For', bookedFor)}
                  </div>

                  {longField('Goal', call.goal)}
                  {longField('Pain', call.pain)}
                  {longField('Notes', call.notes)}

                  <ExtraFields extra={call.extra} />

                  {isAdmin && (
                    <div className="flex justify-end mt-3 pt-2" style={{ borderTop: '0.5px solid var(--crm-divider)' }}>
                      <button
                        onClick={function() { setConfirmDelete({ id: call.id, label: (call.leadsName || 'this booking') }); }}
                        className="flex items-center gap-1.5 text-xs font-mono px-2 py-1 rounded-lg hover:bg-white/5 transition-colors"
                        style={{ color: 'var(--crm-text-muted)' }}
                      >
                        <Trash2 className="w-3 h-3" /> Delete
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete Booked Call?"
        message={confirmDelete ? 'Permanently remove ' + confirmDelete.label + ' from the CRM.' : ''}
        confirmLabel="Delete"
        onConfirm={function() { handleDelete(confirmDelete.id); }}
        onCancel={function() { setConfirmDelete(null); }}
      />
    </div>
  );
}
