'use client';

import { useState, useEffect } from 'react';
import { DollarSign, Calendar, Filter, ChevronDown, Trash2 } from 'lucide-react';
import { useWorkspace, withWorkspace, apiFetch } from '@/lib/workspace-client';
import { getUser } from '@/lib/auth';
import { formatCurrency } from '@/lib/utils';
import ConfirmDialog from '@/components/ConfirmDialog';
import ExtraFields from '@/components/ExtraFields';

export default function ClosedDealsPage() {
  var workspaceId = useWorkspace();
  var [deals, setDeals] = useState([]);
  var [loading, setLoading] = useState(true);
  var [range, setRange] = useState('30');
  var [customStart, setCustomStart] = useState('');
  var [customEnd, setCustomEnd] = useState('');
  var [filterCloser, setFilterCloser] = useState('');
  var [filterProgram, setFilterProgram] = useState('');
  var [confirmDelete, setConfirmDelete] = useState(null);
  var [deleteError, setDeleteError] = useState('');

  var user = getUser();
  var isAdmin = user && user.email === 'shorty21taylor@gmail.com';

  useEffect(function() { if (workspaceId) fetchDeals(); }, [workspaceId]);

  async function fetchDeals() {
    setLoading(true);
    try {
      var res = await apiFetch(withWorkspace('/api/webhooks/close-deal', workspaceId));
      var data = await res.json();
      setDeals((data.data || []).filter(Boolean).sort(function(a, b) {
        return (b.submittedAt || '') > (a.submittedAt || '') ? 1 : -1;
      }));
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function handleDelete(id) {
    setDeleteError('');
    try {
      var res = await apiFetch('/api/webhooks/close-deal/' + id, { method: 'DELETE' });
      var out = await res.json().catch(function() { return {}; });
      // A failed delete used to look identical to a successful one — the list simply
      // refetched and the row was still there. Say what went wrong instead.
      if (!res.ok || out.error) setDeleteError(out.error || 'Delete failed (' + res.status + ')');
    } catch (e) {
      setDeleteError(e.message);
    }
    setConfirmDelete(null);
    fetchDeals();
  }

  // Date filtering
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

  var filtered = deals.filter(function(d) {
    var dt = d.submittedAt ? d.submittedAt.split('T')[0] : '';
    if (dateRange.start && dt < dateRange.start) return false;
    if (dateRange.end && dt > dateRange.end) return false;
    if (filterCloser && (d.closer || '').toLowerCase() !== filterCloser.toLowerCase()) return false;
    if (filterProgram && (d.program || '').toLowerCase().indexOf(filterProgram.toLowerCase()) === -1) return false;
    return true;
  });

  // Summary stats
  var totalCash = filtered.reduce(function(s, d) { return s + (parseFloat(d.cashCollected) || 0); }, 0);
  var totalDeals = filtered.length;
  var avgDeal = totalDeals > 0 ? totalCash / totalDeals : 0;

  // Unique closers and programs for filters
  var closerNames = [];
  var programNames = [];
  deals.forEach(function(d) {
    if (d.closer && closerNames.indexOf(d.closer) === -1) closerNames.push(d.closer);
    if (d.program && programNames.indexOf(d.program) === -1) programNames.push(d.program);
  });

  return (
    <div className="min-h-screen">
      <header className="page-header py-4 md:py-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-display font-bold" style={{ color: 'var(--crm-text-bright)' }}>Closed Deals</h1>
            <p className="text-xs font-mono" style={{ color: 'var(--crm-text-muted)' }}>{totalDeals} deals · {formatCurrency(totalCash)} total</p>
          </div>
        </div>
      </header>

      <div className="px-4 md:px-8 pb-8">

        {deleteError && (
          <div className="glass-card p-3 mb-4" style={{ borderColor: 'rgba(239,68,68,0.3)' }}>
            <p className="text-xs font-mono" style={{ color: '#ef4444' }}>{deleteError}</p>
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3 md:gap-4 mb-5">
          <div className="glass-card p-4 md:p-5">
            <p className="text-xs font-mono uppercase mb-1" style={{ color: 'var(--crm-text-muted)' }}>Total Cash</p>
            <p className="text-xl md:text-2xl font-display font-bold" style={{ color: '#22c55e' }}>{formatCurrency(totalCash)}</p>
          </div>
          <div className="glass-card p-4 md:p-5">
            <p className="text-xs font-mono uppercase mb-1" style={{ color: 'var(--crm-text-muted)' }}>Deals</p>
            <p className="text-xl md:text-2xl font-display font-bold" style={{ color: 'var(--crm-text-bright)' }}>{totalDeals}</p>
          </div>
          <div className="glass-card p-4 md:p-5">
            <p className="text-xs font-mono uppercase mb-1" style={{ color: 'var(--crm-text-muted)' }}>Avg Deal</p>
            <p className="text-xl md:text-2xl font-display font-bold" style={{ color: 'var(--crm-text-bright)' }}>{formatCurrency(avgDeal)}</p>
          </div>
        </div>

        {/* Date range pills */}
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

        {/* Custom date inputs */}
        {range === 'custom' && (
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <input type="date" value={customStart} onChange={function(e) { setCustomStart(e.target.value); }} className="input-field w-auto text-sm" />
            <span className="text-xs font-mono" style={{ color: 'var(--crm-text-muted)' }}>to</span>
            <input type="date" value={customEnd} onChange={function(e) { setCustomEnd(e.target.value); }} className="input-field w-auto text-sm" />
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-5">
          <select value={filterCloser} onChange={function(e) { setFilterCloser(e.target.value); }} className="input-field w-auto text-sm">
            <option value="">All Closers</option>
            {closerNames.sort().map(function(c) { return <option key={c} value={c}>{c}</option>; })}
          </select>
          <select value={filterProgram} onChange={function(e) { setFilterProgram(e.target.value); }} className="input-field w-auto text-sm">
            <option value="">All Programs</option>
            {programNames.sort().map(function(p) { return <option key={p} value={p}>{p}</option>; })}
          </select>
        </div>

        {/* Deals list */}
        {loading ? (
          <p className="text-sm font-mono py-8 text-center" style={{ color: 'var(--crm-text-muted)' }}>Loading...</p>
        ) : filtered.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <DollarSign className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--crm-text-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--crm-text-muted)' }}>No closed deals in this range</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(function(deal) {
              var cash = parseFloat(deal.cashCollected) || 0;
              var dt = deal.submittedAt ? new Date(deal.submittedAt) : null;
              var dateStr = dt ? dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
              var timeStr = dt ? dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : '';
              var brand = (deal.program || '').toLowerCase();
              var brandColor = brand.startsWith('myfm') ? '#fafafa' : brand.startsWith('partner') ? '#a3a3a3' : '#d4d4d4';

              return (
                <div key={deal.id} className="glass-card p-4 md:p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-display font-bold truncate" style={{ color: 'var(--crm-text-bright)' }}>{deal.leadsName || 'Unknown Lead'}</h3>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold text-white flex-shrink-0" style={{ background: brandColor }}>
                          {deal.program || 'N/A'}
                        </span>
                      </div>
                      <p className="text-xs font-mono" style={{ color: 'var(--crm-text-muted)' }}>
                        {dateStr} {timeStr && '· ' + timeStr}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0 ml-4">
                      <p className="text-lg font-display font-bold" style={{ color: '#22c55e' }}>{formatCurrency(cash)}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono">
                    <div>
                      <span style={{ color: 'var(--crm-text-muted)' }}>Closer: </span>
                      <span style={{ color: 'var(--crm-text-bright)' }}>{deal.closer || 'N/A'}</span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--crm-text-muted)' }}>Setter: </span>
                      <span style={{ color: 'var(--crm-text-bright)' }}>{deal.setter || 'N/A'}</span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--crm-text-muted)' }}>Payment: </span>
                      <span style={{ color: 'var(--crm-text-bright)' }}>{deal.paymentDetails || 'N/A'}</span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--crm-text-muted)' }}>Source: </span>
                      <span style={{ color: 'var(--crm-text-bright)' }}>{deal.outboundInbound || deal.leadSource || 'N/A'}</span>
                    </div>
                  </div>

                  {(deal.leadsPhone || deal.leadsEmail) && (
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono mt-2">
                      {deal.leadsPhone && (
                        <div>
                          <span style={{ color: 'var(--crm-text-muted)' }}>Phone: </span>
                          <span style={{ color: 'var(--crm-text-bright)' }}>{deal.leadsPhone}</span>
                        </div>
                      )}
                      {deal.leadsEmail && (
                        <div>
                          <span style={{ color: 'var(--crm-text-muted)' }}>Email: </span>
                          <span style={{ color: 'var(--crm-text-bright)' }}>{deal.leadsEmail}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {deal.notes && (
                    <div className="mt-2">
                      <p className="text-[9px] font-mono uppercase mb-0.5" style={{ color: 'var(--crm-text-muted)' }}>Notes</p>
                      <p className="text-xs font-mono whitespace-pre-wrap" style={{ color: 'var(--crm-text-bright)' }}>{deal.notes}</p>
                    </div>
                  )}

                  <ExtraFields extra={deal.extra} />

                  {/* Admin delete */}
                  {isAdmin && (
                    <div className="flex justify-end mt-3 pt-2" style={{ borderTop: '0.5px solid var(--crm-divider)' }}>
                      <button
                        onClick={function() { setConfirmDelete({ id: deal.id, label: deal.leadsName + ' — ' + formatCurrency(cash) }); }}
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
        title="Delete Closed Deal?"
        message={confirmDelete ? 'Permanently delete deal for ' + confirmDelete.label + '. This cannot be undone.' : ''}
        confirmLabel="Delete Deal"
        onConfirm={function() { handleDelete(confirmDelete.id); }}
        onCancel={function() { setConfirmDelete(null); }}
      />
    </div>
  );
}
