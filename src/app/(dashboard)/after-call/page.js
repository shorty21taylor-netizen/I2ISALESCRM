'use client';

import { useState, useEffect } from 'react';
import { FileText, Trash2 } from 'lucide-react';
import { useWorkspace, withWorkspace, apiFetch } from '@/lib/workspace-client';
import ExtraFields from '@/components/ExtraFields';
import ConfirmDialog from '@/components/ConfirmDialog';
import { getUser } from '@/lib/auth';

// After-call recaps. Until now this form's submissions were rejected outright by the
// ingest route (unknown form type) — nothing a closer wrote here ever reached the CRM.

export default function AfterCallPage() {
  var workspaceId = useWorkspace();
  var [reports, setReports] = useState([]);
  var [loading, setLoading] = useState(true);
  var [confirmDelete, setConfirmDelete] = useState(null);
  var [deleteError, setDeleteError] = useState('');
  var [range, setRange] = useState('30');
  var [customStart, setCustomStart] = useState('');
  var [customEnd, setCustomEnd] = useState('');
  var [filterCloser, setFilterCloser] = useState('');
  var [search, setSearch] = useState('');

  var user = getUser();
  var isAdmin = user && user.email === 'shorty21taylor@gmail.com';

  useEffect(function() { if (workspaceId) fetchReports(); }, [workspaceId]);

  async function handleDelete(id) {
    setDeleteError('');
    try {
      var res = await apiFetch('/api/webhooks/after-call/' + id, { method: 'DELETE' });
      var out = await res.json().catch(function() { return {}; });
      if (!res.ok || out.error) setDeleteError(out.error || 'Delete failed (' + res.status + ')');
    } catch (e) {
      setDeleteError(e.message);
    }
    setConfirmDelete(null);
    fetchReports();
  }

  async function fetchReports() {
    setLoading(true);
    try {
      var res = await apiFetch(withWorkspace('/api/webhooks/after-call', workspaceId));
      var data = await res.json();
      setReports((data.data || []).filter(Boolean).sort(function(a, b) {
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
  var searchTerm = search.toLowerCase().trim();

  var filtered = reports.filter(function(r) {
    var dt = r.submittedAt ? r.submittedAt.split('T')[0] : '';
    if (dateRange.start && dt < dateRange.start) return false;
    if (dateRange.end && dt > dateRange.end) return false;
    if (filterCloser && (r.closer || '').toLowerCase() !== filterCloser.toLowerCase()) return false;
    if (searchTerm) {
      var haystack = ((r.leadsName || '') + ' ' + (r.leadsPhone || '') + ' ' + (r.callNotes || '')).toLowerCase();
      if (haystack.indexOf(searchTerm) === -1) return false;
    }
    return true;
  });

  var uniqueLeads = [];
  filtered.forEach(function(r) {
    var k = (r.leadsName || '').toLowerCase();
    if (k && uniqueLeads.indexOf(k) === -1) uniqueLeads.push(k);
  });

  var closerNames = [];
  reports.forEach(function(r) {
    if (r.closer && closerNames.indexOf(r.closer) === -1) closerNames.push(r.closer);
  });

  return (
    <div className="min-h-screen">
      <header className="page-header py-4 md:py-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-display font-bold" style={{ color: 'var(--crm-text-bright)' }}>After-Call Reports</h1>
            <p className="text-xs font-mono" style={{ color: 'var(--crm-text-muted)' }}>{filtered.length} reports · {uniqueLeads.length} leads</p>
          </div>
        </div>
      </header>

      <div className="px-4 md:px-8 pb-8">

        {deleteError && (
          <div className="glass-card p-3 mb-4" style={{ borderColor: 'rgba(239,68,68,0.3)' }}>
            <p className="text-xs font-mono" style={{ color: '#ef4444' }}>{deleteError}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 md:gap-4 mb-5">
          <div className="glass-card p-4 md:p-5">
            <p className="text-xs font-mono uppercase mb-1" style={{ color: 'var(--crm-text-muted)' }}>Reports</p>
            <p className="text-xl md:text-2xl font-display font-bold" style={{ color: 'var(--crm-text-bright)' }}>{filtered.length}</p>
          </div>
          <div className="glass-card p-4 md:p-5">
            <p className="text-xs font-mono uppercase mb-1" style={{ color: 'var(--crm-text-muted)' }}>Leads Covered</p>
            <p className="text-xl md:text-2xl font-display font-bold" style={{ color: 'var(--crm-text-bright)' }}>{uniqueLeads.length}</p>
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
          <input
            type="text"
            value={search}
            placeholder="Search lead or notes"
            onChange={function(e) { setSearch(e.target.value); }}
            className="input-field w-auto text-sm"
          />
        </div>

        {loading ? (
          <p className="text-sm font-mono py-8 text-center" style={{ color: 'var(--crm-text-muted)' }}>Loading...</p>
        ) : filtered.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <FileText className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--crm-text-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--crm-text-muted)' }}>No after-call reports in this range</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(function(r) {
              var dt = r.submittedAt ? new Date(r.submittedAt) : null;
              var dateStr = dt ? dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
              var timeStr = dt ? dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : '';

              return (
                <div key={r.id} className="glass-card p-4 md:p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-display font-bold truncate" style={{ color: 'var(--crm-text-bright)' }}>{r.leadsName || 'Unknown Lead'}</h3>
                        {r.outcome && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold flex-shrink-0"
                            style={{ background: 'rgba(var(--accent-rgb),0.15)', color: 'var(--crm-accent)' }}>
                            {r.outcome}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-mono" style={{ color: 'var(--crm-text-muted)' }}>
                        {dateStr} {timeStr && '· ' + timeStr}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono">
                    <div>
                      <span style={{ color: 'var(--crm-text-muted)' }}>Phone: </span>
                      <span style={{ color: 'var(--crm-text-bright)' }}>{r.leadsPhone || 'N/A'}</span>
                    </div>
                    {r.leadsEmail && (
                      <div>
                        <span style={{ color: 'var(--crm-text-muted)' }}>Email: </span>
                        <span style={{ color: 'var(--crm-text-bright)' }}>{r.leadsEmail}</span>
                      </div>
                    )}
                    {r.closer && (
                      <div>
                        <span style={{ color: 'var(--crm-text-muted)' }}>Closer: </span>
                        <span style={{ color: 'var(--crm-text-bright)' }}>{r.closer}</span>
                      </div>
                    )}
                    {r.nextStep && (
                      <div>
                        <span style={{ color: 'var(--crm-text-muted)' }}>Next Step: </span>
                        <span style={{ color: 'var(--crm-text-bright)' }}>{r.nextStep}</span>
                      </div>
                    )}
                  </div>

                  {r.callNotes && (
                    <div className="mt-2">
                      <p className="text-[9px] font-mono uppercase mb-0.5" style={{ color: 'var(--crm-text-muted)' }}>Call Notes</p>
                      <p className="text-xs font-mono whitespace-pre-wrap" style={{ color: 'var(--crm-text-bright)' }}>{r.callNotes}</p>
                    </div>
                  )}

                  <ExtraFields extra={r.extra} />

                  {isAdmin && (
                    <div className="flex justify-end mt-3 pt-2" style={{ borderTop: '0.5px solid var(--crm-divider)' }}>
                      <button
                        onClick={function() { setConfirmDelete({ id: r.id, label: (r.leadsName || 'this report') }); }}
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
        title="Delete After-Call Report?"
        message={confirmDelete ? 'Permanently remove ' + confirmDelete.label + ' from the CRM.' : ''}
        confirmLabel="Delete"
        onConfirm={function() { handleDelete(confirmDelete.id); }}
        onCancel={function() { setConfirmDelete(null); }}
      />
    </div>
  );
}
