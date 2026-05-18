'use client';

import { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, ChevronLeft, ChevronRight, Calendar, List, Trash2, Clock } from 'lucide-react';
import { getUser } from '@/lib/auth';
import { formatCurrency } from '@/lib/utils';
import ConfirmDialog from '@/components/ConfirmDialog';

export default function EODLogsPage() {
  var [eods, setEods] = useState([]);
  var [closers, setClosers] = useState([]);
  var [loading, setLoading] = useState(true);
  var [view, setView] = useState('tracker'); // 'tracker' or 'list'
  var [monthOffset, setMonthOffset] = useState(0);
  var [filterRep, setFilterRep] = useState('');
  var [confirmDelete, setConfirmDelete] = useState(null);

  var user = getUser();
  var isAdmin = user && user.email === 'shorty21taylor@gmail.com';

  useEffect(function() {
    Promise.all([
      fetch('/api/webhooks/eod-report').then(function(r) { return r.json(); }),
      fetch('/api/closers').then(function(r) { return r.json(); }),
    ]).then(function(results) {
      setEods((results[0].data || []).filter(Boolean));
      setClosers((results[1].closers || []).filter(Boolean));
      setLoading(false);
    }).catch(function() { setLoading(false); });
  }, []);

  async function fetchEods() {
    var res = await fetch('/api/webhooks/eod-report');
    var data = await res.json();
    setEods((data.data || []).filter(Boolean));
  }

  async function handleDelete(id) {
    await fetch('/api/webhooks/eod-report/' + id, { method: 'DELETE' });
    setConfirmDelete(null);
    fetchEods();
  }

  // Month navigation
  var now = new Date();
  var viewMonth = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  var monthName = viewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  var daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
  var today = new Date();
  var todayStr = today.toISOString().split('T')[0];

  // Build array of working days (Mon-Fri) in this month
  var workDays = [];
  for (var d = 1; d <= daysInMonth; d++) {
    var dt = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d);
    var dayOfWeek = dt.getDay();
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      workDays.push({
        date: dt.toISOString().split('T')[0],
        day: d,
        label: dt.toLocaleDateString('en-US', { weekday: 'short' }),
        isPast: dt.toISOString().split('T')[0] < todayStr,
        isToday: dt.toISOString().split('T')[0] === todayStr,
      });
    }
  }

  // Get active closer names
  var closerNames = closers.map(function(c) { return c.name; }).filter(Boolean).sort();

  // Build submission map: { "closerName": { "2026-04-07": eodObject, ... } }
  var submissionMap = {};
  closerNames.forEach(function(name) { submissionMap[name] = {}; });

  eods.forEach(function(e) {
    var name = e.salesRep || e.closerName || '';
    var date = e.date || (e.submittedAt ? e.submittedAt.split('T')[0] : '');
    if (name && date) {
      if (!submissionMap[name]) submissionMap[name] = {};
      submissionMap[name][date] = e;
    }
  });

  // Summary stats for the month
  var monthStart = viewMonth.toISOString().split('T')[0];
  var monthEnd = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).toISOString().split('T')[0];
  var monthEods = eods.filter(function(e) {
    var date = e.date || '';
    return date >= monthStart && date <= monthEnd;
  });

  var totalSubmissions = monthEods.length;
  var pastWorkDays = workDays.filter(function(d) { return d.isPast; });
  var expectedSubmissions = pastWorkDays.length * closerNames.length;
  var missedSubmissions = expectedSubmissions - totalSubmissions;
  if (missedSubmissions < 0) missedSubmissions = 0;
  var complianceRate = expectedSubmissions > 0 ? Math.round((totalSubmissions / expectedSubmissions) * 100) : 0;

  var totalCash = monthEods.reduce(function(s, e) {
    return s + (parseFloat(e.cashCollectedMYFM) || 0) + (parseFloat(e.cashCollectedI2I) || 0);
  }, 0);

  // List view: filter and sort EODs
  var filteredEods = eods.filter(function(e) {
    var date = e.date || '';
    if (date < monthStart || date > monthEnd) return false;
    if (filterRep && (e.salesRep || e.closerName || '') !== filterRep) return false;
    return true;
  }).sort(function(a, b) { return (b.date || '') > (a.date || '') ? 1 : -1; });

  if (loading) return <div className="px-4 md:px-8 py-8 text-sm font-mono" style={{ color: 'var(--crm-text-muted)' }}>Loading...</div>;

  return (
    <div className="min-h-screen">
      <header className="page-header py-4 md:py-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-display font-bold" style={{ color: 'var(--crm-text-bright)' }}>EOD Logs</h1>
            <p className="text-xs font-mono" style={{ color: 'var(--crm-text-muted)' }}>{monthName}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="glass-surface inline-flex rounded-xl p-1 gap-0.5">
              <button onClick={function() { setView('tracker'); }}
                className={'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display ' + (view === 'tracker' ? 'bg-crm-accent/15 text-crm-accent font-bold' : 'text-crm-muted')}>
                <Calendar className="w-3.5 h-3.5" /> Tracker
              </button>
              <button onClick={function() { setView('list'); }}
                className={'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display ' + (view === 'list' ? 'bg-crm-accent/15 text-crm-accent font-bold' : 'text-crm-muted')}>
                <List className="w-3.5 h-3.5" /> Details
              </button>
            </div>

            {/* Month nav */}
            <div className="glass-surface inline-flex items-center rounded-xl px-2 py-1 gap-2">
              <button onClick={function() { setMonthOffset(monthOffset - 1); }} className="p-1 hover:text-crm-text-bright">
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs font-mono" style={{ color: 'var(--crm-text-bright)' }}>
                {viewMonth.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
              </span>
              <button onClick={function() { setMonthOffset(monthOffset + 1); }} disabled={monthOffset >= 0} className="p-1 hover:text-crm-text-bright disabled:opacity-30">
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="px-4 md:px-8 pb-8">

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <div className="glass-card p-4">
            <p className="text-xs font-mono uppercase mb-1" style={{ color: 'var(--crm-text-muted)' }}>Total Cash</p>
            <p className="text-xl font-display font-bold" style={{ color: '#22c55e' }}>{formatCurrency(totalCash)}</p>
          </div>
          <div className="glass-card p-4">
            <p className="text-xs font-mono uppercase mb-1" style={{ color: 'var(--crm-text-muted)' }}>Submitted</p>
            <p className="text-xl font-display font-bold" style={{ color: 'var(--crm-text-bright)' }}>{totalSubmissions}</p>
          </div>
          <div className="glass-card p-4">
            <p className="text-xs font-mono uppercase mb-1" style={{ color: 'var(--crm-text-muted)' }}>Missed</p>
            <p className="text-xl font-display font-bold" style={{ color: missedSubmissions > 0 ? '#ef4444' : 'var(--crm-text-bright)' }}>{missedSubmissions}</p>
          </div>
          <div className="glass-card p-4">
            <p className="text-xs font-mono uppercase mb-1" style={{ color: 'var(--crm-text-muted)' }}>Compliance</p>
            <p className="text-xl font-display font-bold" style={{ color: complianceRate >= 90 ? '#22c55e' : complianceRate >= 70 ? '#f59e0b' : '#ef4444' }}>{complianceRate}%</p>
          </div>
        </div>

        {/* TRACKER VIEW */}
        {view === 'tracker' && (
          <div className="glass-card overflow-hidden">
            <div className="table-scroll">
              <table className="w-full" style={{ minWidth: Math.max(400, workDays.length * 36 + 160) + 'px' }}>
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 text-left px-3 py-2.5 text-[10px] font-mono uppercase" style={{ color: 'var(--crm-text-muted)', background: 'var(--crm-bg)', minWidth: '140px' }}>
                      Closer
                    </th>
                    {workDays.map(function(day) {
                      return (
                        <th key={day.date} className="text-center px-0.5 py-2.5" style={{ minWidth: '32px' }}>
                          <div className="text-[9px] font-mono" style={{ color: day.isToday ? 'var(--crm-accent)' : 'var(--crm-text-muted)' }}>{day.label}</div>
                          <div className={'text-[10px] font-mono font-bold ' + (day.isToday ? 'text-crm-accent' : '')} style={{ color: day.isToday ? undefined : 'var(--crm-text-bright)' }}>{day.day}</div>
                        </th>
                      );
                    })}
                    <th className="text-center px-3 py-2.5 text-[10px] font-mono uppercase" style={{ color: 'var(--crm-text-muted)', minWidth: '50px' }}>
                      Rate
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {closerNames.map(function(name) {
                    var submissions = submissionMap[name] || {};
                    var submitted = 0;
                    var expected = 0;

                    return (
                      <tr key={name} className="border-t" style={{ borderColor: 'var(--crm-divider)' }}>
                        <td className="sticky left-0 z-10 px-3 py-2 text-xs font-display font-medium truncate" style={{ color: 'var(--crm-text-bright)', background: 'var(--crm-bg)', maxWidth: '140px' }}>
                          {name}
                        </td>
                        {workDays.map(function(day) {
                          var eod = submissions[day.date];
                          var isPast = day.isPast;
                          var isToday = day.isToday;
                          var didSubmit = !!eod;

                          if (isPast || isToday) expected++;
                          if (didSubmit) submitted++;

                          var bg = 'transparent';
                          var icon = null;

                          if (didSubmit) {
                            bg = 'rgba(34,197,94,0.15)';
                            icon = <CheckCircle2 className="w-3.5 h-3.5" style={{ color: '#22c55e' }} />;
                          } else if (isPast) {
                            bg = 'rgba(239,68,68,0.1)';
                            icon = <XCircle className="w-3.5 h-3.5" style={{ color: '#ef4444' }} />;
                          } else if (isToday) {
                            bg = 'rgba(245,158,11,0.1)';
                            icon = <Clock className="w-3.5 h-3.5" style={{ color: '#f59e0b' }} />;
                          }

                          return (
                            <td key={day.date} className="text-center px-0.5 py-2" style={{ background: bg }}>
                              <div className="flex items-center justify-center" title={didSubmit ? name + ' submitted ' + day.date : isPast ? name + ' MISSED ' + day.date : isToday ? 'Pending today' : 'Future'}>
                                {icon}
                              </div>
                            </td>
                          );
                        })}
                        <td className="text-center px-3 py-2">
                          <span className="text-xs font-mono font-bold" style={{ color: expected > 0 && submitted / expected >= 0.9 ? '#22c55e' : expected > 0 && submitted / expected >= 0.7 ? '#f59e0b' : '#ef4444' }}>
                            {expected > 0 ? Math.round((submitted / expected) * 100) : 0}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 px-4 py-3" style={{ borderTop: '0.5px solid var(--crm-divider)' }}>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3" style={{ color: '#22c55e' }} />
                <span className="text-[10px] font-mono" style={{ color: 'var(--crm-text-muted)' }}>Submitted</span>
              </div>
              <div className="flex items-center gap-1.5">
                <XCircle className="w-3 h-3" style={{ color: '#ef4444' }} />
                <span className="text-[10px] font-mono" style={{ color: 'var(--crm-text-muted)' }}>Missed</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-3 h-3" style={{ color: '#f59e0b' }} />
                <span className="text-[10px] font-mono" style={{ color: 'var(--crm-text-muted)' }}>Pending Today</span>
              </div>
            </div>
          </div>
        )}

        {/* LIST VIEW — existing EOD detail cards */}
        {view === 'list' && (
          <>
            <div className="flex flex-wrap gap-3 mb-4">
              <select value={filterRep} onChange={function(e) { setFilterRep(e.target.value); }} className="input-field w-auto text-sm">
                <option value="">All Reps</option>
                {closerNames.map(function(c) { return <option key={c} value={c}>{c}</option>; })}
              </select>
            </div>

            {filteredEods.length === 0 ? (
              <div className="glass-card p-12 text-center">
                <p className="text-sm" style={{ color: 'var(--crm-text-muted)' }}>No EOD reports for this month</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredEods.map(function(eod) {
                  var rep = eod.salesRep || eod.closerName || 'Unknown';
                  var initials = rep.split(' ').map(function(w) { return w.charAt(0); }).join('').substring(0, 2).toUpperCase();
                  var dials = parseInt(eod.outboundDials) || 0;
                  var taken = parseInt(eod.callsTaken) || 0;
                  var pitched = parseInt(eod.callsTakenAndPitched) || 0;
                  var closes = parseInt(eod.closes) || 0;
                  var booked = parseInt(eod.netNewCallsBooked) || 0;
                  var noShows = parseInt(eod.callsNoShowed) || 0;
                  var canceled = parseInt(eod.callsCanceled) || 0;
                  var rescheduled = parseInt(eod.callsRescheduled) || 0;
                  var calendar = parseInt(eod.callsOnCalendar) || 0;
                  var cashM = parseFloat(eod.cashCollectedMYFM) || 0;
                  var cashI = parseFloat(eod.cashCollectedI2I) || 0;
                  var totalCashEod = cashM + cashI;

                  return (
                    <div key={eod.id} className="glass-card p-4 md:p-5">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-display font-bold flex-shrink-0" style={{ background: 'rgba(220,38,38,0.15)', color: 'var(--crm-accent)' }}>
                          {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-display font-bold truncate" style={{ color: 'var(--crm-text-bright)' }}>{rep}</p>
                          <p className="text-[10px] font-mono" style={{ color: 'var(--crm-text-muted)' }}>{eod.date}</p>
                        </div>
                        {totalCashEod > 0 && (
                          <span className="text-sm font-display font-bold" style={{ color: '#22c55e' }}>{formatCurrency(totalCashEod)}</span>
                        )}
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-green-400/10 text-green-400">submitted</span>
                      </div>

                      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-2">
                        <div className="glass-surface rounded-lg p-2 text-center">
                          <p className="text-sm font-display font-bold" style={{ color: 'var(--crm-text-bright)' }}>{dials}</p>
                          <p className="text-[9px] font-mono uppercase" style={{ color: 'var(--crm-text-muted)' }}>Dials</p>
                        </div>
                        <div className="glass-surface rounded-lg p-2 text-center">
                          <p className="text-sm font-display font-bold" style={{ color: 'var(--crm-text-bright)' }}>{booked}</p>
                          <p className="text-[9px] font-mono uppercase" style={{ color: 'var(--crm-text-muted)' }}>Booked</p>
                        </div>
                        <div className="glass-surface rounded-lg p-2 text-center">
                          <p className="text-sm font-display font-bold" style={{ color: 'var(--crm-text-bright)' }}>{calendar}</p>
                          <p className="text-[9px] font-mono uppercase" style={{ color: 'var(--crm-text-muted)' }}>Calendar</p>
                        </div>
                        <div className="glass-surface rounded-lg p-2 text-center">
                          <p className="text-sm font-display font-bold" style={{ color: 'var(--crm-text-bright)' }}>{taken}</p>
                          <p className="text-[9px] font-mono uppercase" style={{ color: 'var(--crm-text-muted)' }}>Taken</p>
                        </div>
                        <div className="glass-surface rounded-lg p-2 text-center">
                          <p className="text-sm font-display font-bold" style={{ color: 'var(--crm-text-bright)' }}>{pitched}</p>
                          <p className="text-[9px] font-mono uppercase" style={{ color: 'var(--crm-text-muted)' }}>Pitched</p>
                        </div>
                        <div className="glass-surface rounded-lg p-2 text-center">
                          <p className="text-sm font-display font-bold" style={{ color: closes > 0 ? '#22c55e' : 'var(--crm-text-bright)' }}>{closes}</p>
                          <p className="text-[9px] font-mono uppercase" style={{ color: 'var(--crm-text-muted)' }}>Closes</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-2 mb-2">
                        <div className="glass-surface rounded-lg p-2 text-center">
                          <p className="text-sm font-display font-bold" style={{ color: noShows > 0 ? '#ef4444' : 'var(--crm-text-bright)' }}>{noShows}</p>
                          <p className="text-[9px] font-mono uppercase" style={{ color: 'var(--crm-text-muted)' }}>No Shows</p>
                        </div>
                        <div className="glass-surface rounded-lg p-2 text-center">
                          <p className="text-sm font-display font-bold" style={{ color: 'var(--crm-text-bright)' }}>{canceled}</p>
                          <p className="text-[9px] font-mono uppercase" style={{ color: 'var(--crm-text-muted)' }}>Canceled</p>
                        </div>
                        <div className="glass-surface rounded-lg p-2 text-center">
                          <p className="text-sm font-display font-bold" style={{ color: 'var(--crm-text-bright)' }}>{rescheduled}</p>
                          <p className="text-[9px] font-mono uppercase" style={{ color: 'var(--crm-text-muted)' }}>Rescheduled</p>
                        </div>
                        <div className="glass-surface rounded-lg p-2 text-center">
                          <p className="text-sm font-display font-bold" style={{ color: '#22c55e' }}>{formatCurrency(totalCashEod)}</p>
                          <p className="text-[9px] font-mono uppercase" style={{ color: 'var(--crm-text-muted)' }}>Revenue</p>
                        </div>
                      </div>

                      {(cashM > 0 || cashI > 0) && (
                        <p className="text-xs font-mono" style={{ color: 'var(--crm-text-muted)' }}>
                          MYFM: {formatCurrency(cashM)} · I2I: {formatCurrency(cashI)}
                        </p>
                      )}

                      {eod.improvementPlan && (
                        <p className="text-xs font-mono mt-2" style={{ color: 'var(--crm-text-muted)' }}>
                          Tomorrow: {eod.improvementPlan}
                        </p>
                      )}

                      {isAdmin && (
                        <div className="flex justify-end mt-3 pt-2" style={{ borderTop: '0.5px solid var(--crm-divider)' }}>
                          <button onClick={function() { setConfirmDelete({ id: eod.id, label: rep + ' — ' + eod.date }); }}
                            className="flex items-center gap-1.5 text-xs font-mono px-2 py-1 rounded-lg hover:bg-white/5"
                            style={{ color: 'var(--crm-text-muted)' }}>
                            <Trash2 className="w-3 h-3" /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete EOD Report?"
        message={confirmDelete ? 'Permanently delete EOD for ' + confirmDelete.label + '. This cannot be undone.' : ''}
        confirmLabel="Delete EOD"
        onConfirm={function() { handleDelete(confirmDelete.id); }}
        onCancel={function() { setConfirmDelete(null); }}
      />
    </div>
  );
}
