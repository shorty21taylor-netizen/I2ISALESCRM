'use client';

import { useState, useEffect, useCallback } from 'react';
import { MessageCircle, Ghost, RotateCcw, ChevronDown } from 'lucide-react';
import { useWorkspace, withWorkspace, apiFetch } from '@/lib/workspace-client';
import { formatCurrency } from '@/lib/utils';
import DateRangePicker from '@/components/DateRangePicker';
import RepAvatar from '@/components/RepAvatar';
import useRoster from '@/lib/use-roster';

// The DM setters' board. A different funnel from the phone setters': it starts
// at a new lead in the inbox, not a dial, and it ends when the call they booked
// is sat and closed. Every figure here is computed server-side in
// dm-setter-breakdown.js — this page renders what it was handed.

function num(v) {
  return (v === null || v === undefined) ? '—' : Number(v).toLocaleString('en-US');
}
function money(v) {
  return (v === null || v === undefined) ? '—' : formatCurrency(v);
}
// A rate whose denominator was zero is unknowable, not zero.
function pct(v) {
  return (v === null || v === undefined) ? '—' : v + '%';
}

var COLUMNS = [
  { key: 'name', label: 'DM Setter', text: true },
  { key: 'daysReported', label: 'Days' },
  { key: 'newLeads', label: 'New leads' },
  { key: 'conversations', label: 'Convos' },
  { key: 'leadToConversation', label: 'Lead→Convo', rate: true },
  { key: 'booked', label: 'Booked' },
  { key: 'conversationToBooked', label: 'Convo→Booked', rate: true },
  { key: 'showed', label: 'Showed' },
  { key: 'showRate', label: 'Show %', rate: true },
  { key: 'closes', label: 'Closed' },
  { key: 'showToClose', label: 'Show→Close', rate: true },
  { key: 'ghosted', label: 'Ghosted' },
  { key: 'reactivated', label: 'Reactivated' },
  { key: 'cash', label: 'Cash', money: true },
];

export default function DmSetterDashboardPage() {
  var roster = useRoster();
  var workspaceId = useWorkspace();
  var s1 = useState(null), board = s1[0], setBoard = s1[1];
  var s2 = useState({ preset: 'today', start: '', end: '' }), range = s2[0], setRange = s2[1];
  var s3 = useState(true), loading = s3[0], setLoading = s3[1];
  var s4 = useState(''), error = s4[0], setError = s4[1];
  var s5 = useState('cash'), sortKey = s5[0], setSortKey = s5[1];
  var s6 = useState('desc'), sortDir = s6[0], setSortDir = s6[1];
  var s7 = useState(null), openNotes = s7[0], setOpenNotes = s7[1];

  var fetchIt = useCallback(function() {
    if (!workspaceId || !range.start || !range.end) return;
    apiFetch(withWorkspace('/api/dm-setters?start=' + range.start + '&end=' + range.end, workspaceId))
      .then(function(r) { return r.json(); })
      .then(function(d) {
        setLoading(false);
        if (!d || !d.success) { setError((d && d.error) || 'Could not load it.'); return; }
        setError('');
        setBoard(d.board);
      })
      .catch(function(e) { setLoading(false); setError(e.message || 'Could not load it.'); });
  }, [workspaceId, range.start, range.end]);

  useEffect(function() {
    fetchIt();
    var t = setInterval(fetchIt, 30000);
    return function() { clearInterval(t); };
  }, [fetchIt]);

  var team = (board && board.team) || { totals: {}, rates: {} };
  var v = team.totals || {};
  var r = team.rates || {};

  // Flattened so a column can read one object, totals and rates alike.
  var rows = ((board && board.reps) || []).map(function(row) {
    return Object.assign({ name: row.name, daysReported: row.daysReported,
      themes: row.themes, bottlenecks: row.bottlenecks }, row.totals, row.rates);
  });

  var sorted = rows.slice().sort(function(a, b) {
    var col = COLUMNS.filter(function(x) { return x.key === sortKey; })[0] || COLUMNS[0];
    var av = a[col.key], bv = b[col.key];
    if (col.text) {
      var cmp = String(av || '').localeCompare(String(bv || ''));
      return sortDir === 'asc' ? cmp : -cmp;
    }
    // A null rate sorts to the bottom either way — it is missing data, not a low
    // score, and floating it to the top would read as "these reps are the worst".
    var an = (av === null || av === undefined) ? null : Number(av);
    var bn = (bv === null || bv === undefined) ? null : Number(bv);
    if (an === null && bn === null) return 0;
    if (an === null) return 1;
    if (bn === null) return -1;
    return sortDir === 'asc' ? an - bn : bn - an;
  });

  function sortBy(k) {
    if (sortKey === k) { setSortDir(sortDir === 'asc' ? 'desc' : 'asc'); return; }
    setSortKey(k);
    var col = COLUMNS.filter(function(x) { return x.key === k; })[0];
    setSortDir(col && col.text ? 'asc' : 'desc');
  }

  function cell(row, col) {
    var val = row[col.key];
    if (col.text) return val;
    if (col.money) return money(val);
    if (col.rate) return pct(val);
    return num(val);
  }

  // Rates are deliberately absent from the footer: a column of percentages has
  // no meaningful sum, and averaging them would weight a rep with three leads
  // the same as one with three hundred.
  var totals = {};
  COLUMNS.forEach(function(col) {
    if (col.text || col.rate) return;
    totals[col.key] = sorted.reduce(function(s, row) { return s + (Number(row[col.key]) || 0); }, 0);
  });

  var tiles = [
    { label: 'New leads', value: num(v.newLeads) },
    { label: 'Conversations', value: num(v.conversations), sub: pct(r.leadToConversation) + ' of leads' },
    { label: 'Calls booked', value: num(v.booked), sub: pct(r.conversationToBooked) + ' of conversations' },
    { label: 'Showed', value: num(v.showed), sub: pct(r.showRate) + ' show rate' },
    { label: 'Deals closed', value: num(v.closes), sub: pct(r.showToClose) + ' of those that showed' },
    { label: 'Cash collected', value: money(v.cash), tone: 'good' },
    { label: 'Cash per lead', value: money(r.cashPerLead), sub: money(r.avgDealSize) + ' average deal' },
    { label: 'Went ghost', value: num(v.ghosted), sub: pct(r.ghostRate) + ' of conversations', tone: 'warn' },
    { label: 'Reactivated', value: num(v.reactivated), sub: 'dead leads brought back' },
  ];

  return (
    <div className="min-h-screen px-4 md:px-8 py-4 md:py-6 space-y-5">
      <header>
        <h1 className="text-xl md:text-2xl font-display font-bold" style={{ color: 'var(--crm-text-bright)' }}>
          DM Setter Dashboard
        </h1>
        <p className="text-xs font-mono" style={{ color: 'var(--crm-text-muted)' }}>
          The inbox funnel — new leads through to the cash their booked calls collected
          {board && board.daysReported
            ? ' · ' + board.daysReported + ' reporting day' + (board.daysReported === 1 ? '' : 's')
            : ''}
        </p>
      </header>

      <DateRangePicker value={range} onChange={setRange} />

      {error ? (
        <div className="glass-card p-4">
          <p className="text-xs font-mono" style={{ color: '#ef4444' }}>{error}</p>
        </div>
      ) : null}

      {loading && !board ? (
        <p className="text-sm font-mono py-8 text-center" style={{ color: 'var(--crm-text-muted)' }}>Loading…</p>
      ) : (
        <>
          <div className="td-section relative z-10">
            <div className="td-section-h">
              <h3 className="td-section-t"><MessageCircle className="w-4 h-4 inline mr-1.5" /> DM metrics</h3>
              <span className="section-tag">
                {(board && board.repCount) || 0} {((board && board.repCount) === 1) ? 'rep' : 'reps'} reporting
              </span>
            </div>
            <div className="td-grid">
              {tiles.map(function(t) {
                return (
                  <div key={t.label} className="td-tile">
                    <p className="td-tile-l">{t.label}</p>
                    <p className={'td-tile-v' + (t.tone ? ' ' + t.tone : '')}>{t.value}</p>
                    {t.sub ? <p className="td-tile-s">{t.sub}</p> : null}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="td-section relative z-10">
            <div className="td-section-h">
              <h3 className="td-section-t">By DM setter</h3>
              <span className="section-tag">{sorted.length} {sorted.length === 1 ? 'rep' : 'reps'}</span>
            </div>

            {sorted.length === 0 ? (
              <div className="glass-card p-10 text-center">
                <p className="text-sm" style={{ color: 'var(--crm-text-muted)' }}>
                  No DM setter reports in this range.
                </p>
                <p className="text-xs font-mono mt-2" style={{ color: 'var(--crm-text-muted)' }}>
                  A report lands here when its Position says DM Setter.
                </p>
              </div>
            ) : (
              <div className="glass-card eodt-wrap">
                <table className="eodt">
                  <thead>
                    <tr>
                      {COLUMNS.map(function(col) {
                        return (
                          <th key={col.key} onClick={function() { sortBy(col.key); }}
                            className={sortKey === col.key ? 'eodt-sort' : ''}>
                            {col.label}{sortKey === col.key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map(function(row) {
                      var notes = (row.themes || []).length + (row.bottlenecks || []).length;
                      var isOpen = openNotes === row.name;
                      return [
                        <tr key={row.name} className={isOpen ? 'eodt-open' : ''}
                          onClick={function() { if (notes) setOpenNotes(isOpen ? null : row.name); }}
                          style={notes ? { cursor: 'pointer' } : {}}>
                          {COLUMNS.map(function(col) {
                            return (
                              <td key={col.key}>
                                {col.text ? (
                                  <span className="inline-flex items-center gap-2">
                                    {notes ? (
                                      <ChevronDown className="w-3 h-3" style={{ color: 'var(--crm-accent)',
                                        transform: isOpen ? 'none' : 'rotate(-90deg)' }} />
                                    ) : null}
                                    <RepAvatar rep={roster.find(row.name)} name={row.name} size={22} />
                                    {row.name}
                                  </span>
                                ) : cell(row, col)}
                              </td>
                            );
                          })}
                        </tr>,
                        isOpen ? (
                          <tr key={row.name + '-notes'} className="eodt-plan">
                            <td colSpan={COLUMNS.length}>
                              {(row.themes || []).length > 0 && (
                                <>
                                  <span className="text-[9px] font-mono uppercase block mb-1" style={{ color: 'var(--crm-text-muted)' }}>
                                    Common themes and patterns
                                  </span>
                                  {row.themes.map(function(t, i) {
                                    return (
                                      <p key={i} style={{ color: 'var(--crm-text-bright)', marginBottom: 4 }}>
                                        <span style={{ color: 'var(--crm-text-muted)' }}>{t.date} · </span>{t.text}
                                      </p>
                                    );
                                  })}
                                </>
                              )}
                              {(row.bottlenecks || []).length > 0 && (
                                <>
                                  <span className="text-[9px] font-mono uppercase block mb-1 mt-3" style={{ color: '#f59e0b' }}>
                                    Biggest bottleneck
                                  </span>
                                  {row.bottlenecks.map(function(b, i) {
                                    return (
                                      <p key={i} style={{ color: 'var(--crm-text-bright)', marginBottom: 4 }}>
                                        <span style={{ color: 'var(--crm-text-muted)' }}>{b.date} · </span>{b.text}
                                      </p>
                                    );
                                  })}
                                </>
                              )}
                            </td>
                          </tr>
                        ) : null,
                      ];
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      {COLUMNS.map(function(col, i) {
                        if (i === 0) return <td key={col.key}>Total</td>;
                        if (col.rate) return <td key={col.key}>—</td>;
                        return <td key={col.key}>{col.money ? money(totals[col.key]) : num(totals[col.key])}</td>;
                      })}
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
