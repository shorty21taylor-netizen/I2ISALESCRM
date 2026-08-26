'use client';

import { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, ChevronLeft, ChevronRight, Calendar, List, Trash2, Clock, AlertTriangle, X } from 'lucide-react';
import { useWorkspace, withWorkspace, apiFetch } from '@/lib/workspace-client';
import { getUser } from '@/lib/auth';
import { formatCurrency } from '@/lib/utils';
import ConfirmDialog from '@/components/ConfirmDialog';
import ExtraFields from '@/components/ExtraFields';

export default function EODLogsPage() {
  var workspaceId = useWorkspace();
  var [eods, setEods] = useState([]);
  var [closers, setClosers] = useState([]);
  var [loading, setLoading] = useState(true);
  var [view, setView] = useState('tracker');
  var [monthOffset, setMonthOffset] = useState(0);
  var [selectedDay, setSelectedDay] = useState(null); // 'YYYY-MM-DD' or null
  var [filterRep, setFilterRep] = useState('');
  var [confirmDelete, setConfirmDelete] = useState(null);

  var user = getUser();
  var isAdmin = user && user.email === 'shorty21taylor@gmail.com';

  useEffect(function() {
    Promise.all([
      apiFetch(withWorkspace('/api/webhooks/eod-report', workspaceId)).then(function(r) { return r.json(); }),
      apiFetch('/api/closers').then(function(r) { return r.json(); }),
    ]).then(function(results) {
      setEods((results[0].data || []).filter(Boolean));
      setClosers((results[1].closers || []).filter(Boolean));
      setLoading(false);
    }).catch(function() { setLoading(false); });
  }, [workspaceId]);

  async function fetchEods() {
    var res = await apiFetch(withWorkspace('/api/webhooks/eod-report', workspaceId));
    var data = await res.json();
    setEods((data.data || []).filter(Boolean));
  }

  async function handleDelete(id) {
    await apiFetch('/api/webhooks/eod-report/' + id, { method: 'DELETE' });
    setConfirmDelete(null);
    fetchEods();
  }

  var now = new Date();
  var viewMonth = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  var monthName = viewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  var daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
  var todayStr = now.toISOString().split('T')[0];

  var workDays = [];
  for (var d = 1; d <= daysInMonth; d++) {
    var dt = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d);
    var dow = dt.getDay();
    if (dow >= 1 && dow <= 5) {
      workDays.push({
        date: dt.toISOString().split('T')[0],
        day: d,
        label: dt.toLocaleDateString('en-US', { weekday: 'short' }),
        fullLabel: dt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
        isPast: dt.toISOString().split('T')[0] < todayStr,
        isToday: dt.toISOString().split('T')[0] === todayStr,
      });
    }
  }

  // Build closer list with emails
  var closerList = closers.map(function(c) {
    return { name: (c.name || '').trim(), email: (c.email || '').toLowerCase().trim() };
  }).filter(function(c) { return c.name; });

  // Combine duplicate closer rows. Two-pass merge:
  //   1) Same normalized email -> merge (the original "only if email matches" rule).
  //   2) Same case-insensitive name -> merge (catches profiles with different/missing emails
  //      but the exact same stored name, like two "Jake Reilly" rows).
  // When merging, keep the longest name and prefer a real email over an empty one.
  var byEmail = {};
  var noEmailRows = [];
  closerList.forEach(function(c) {
    if (c.email) {
      if (!byEmail[c.email]) {
        byEmail[c.email] = { name: c.name, email: c.email };
      } else if (c.name.length > byEmail[c.email].name.length) {
        byEmail[c.email].name = c.name;
      }
    } else {
      noEmailRows.push(c);
    }
  });

  var byName = {};
  Object.values(byEmail).concat(noEmailRows).forEach(function(c) {
    var nk = c.name.toLowerCase().trim();
    if (!byName[nk]) {
      byName[nk] = { name: c.name, email: c.email };
    } else {
      if (c.name.length > byName[nk].name.length) byName[nk].name = c.name;
      if (!byName[nk].email && c.email) byName[nk].email = c.email;
    }
  });
  var dedupedClosers = Object.values(byName)
    .sort(function(a, b) { return a.name > b.name ? 1 : -1; });

  // Build submission map keyed by email (primary) or name (fallback)
  var submissionMap = {};
  dedupedClosers.forEach(function(c) {
    var key = c.email || c.name.toLowerCase();
    submissionMap[key] = { name: c.name, email: c.email, submissions: {} };
  });

  eods.forEach(function(e) {
    var email = (e.closerEmail || '').toLowerCase().trim();
    var name = e.salesRep || e.closerName || '';
    var date = e.date || (e.submittedAt ? e.submittedAt.split('T')[0] : '');
    if (!date) return;

    // Try email match first
    if (email && submissionMap[email]) {
      submissionMap[email].submissions[date] = e;
      return;
    }

    // Fall back to name match (case-insensitive)
    var nameLower = name.toLowerCase().trim();
    var found = false;
    Object.keys(submissionMap).forEach(function(key) {
      if (found) return;
      if (submissionMap[key].name.toLowerCase().trim() === nameLower) {
        submissionMap[key].submissions[date] = e;
        found = true;
      }
    });

    // If no match at all, create a temporary entry (orphaned submission)
    if (!found && name) {
      var tempKey = 'orphan-' + nameLower;
      if (!submissionMap[tempKey]) {
        submissionMap[tempKey] = { name: name + ' (unlinked)', email: '', submissions: {} };
      }
      submissionMap[tempKey].submissions[date] = e;
    }
  });

  // Convert to array for rendering
  var trackerRows = Object.values(submissionMap).sort(function(a, b) {
    // Put orphans at the bottom
    if (a.name.includes('(unlinked)') && !b.name.includes('(unlinked)')) return 1;
    if (!a.name.includes('(unlinked)') && b.name.includes('(unlinked)')) return -1;
    return a.name > b.name ? 1 : -1;
  });

  var monthStart = viewMonth.toISOString().split('T')[0];
  var monthEnd = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).toISOString().split('T')[0];
  var monthEods = eods.filter(function(e) { var date = e.date || ''; return date >= monthStart && date <= monthEnd; });
  var totalSubmissions = monthEods.length;
  var pastWorkDays = workDays.filter(function(d) { return d.isPast; });
  var expectedSubmissions = pastWorkDays.length * dedupedClosers.length;
  var missedSubmissions = Math.max(0, expectedSubmissions - totalSubmissions);
  var complianceRate = expectedSubmissions > 0 ? Math.round((totalSubmissions / expectedSubmissions) * 100) : 0;
  var totalCash = monthEods.reduce(function(s, e) { return s + (parseFloat(e.cashCollectedMYFM) || 0) + (parseFloat(e.cashCollectedI2I) || 0); }, 0);

  // Selected day data
  var selectedDayData = null;
  if (selectedDay) {
    var dayInfo = workDays.find(function(d) { return d.date === selectedDay; });
    var daySubmitted = [];
    var dayMissed = [];

    trackerRows.forEach(function(row) {
      var eod = row.submissions[selectedDay];
      if (eod) {
        daySubmitted.push({ name: row.name, eod: eod });
      } else if (dayInfo && (dayInfo.isPast || dayInfo.isToday) && !row.name.includes('(unlinked)')) {
        dayMissed.push(row.name);
      }
    });

    var dayCash = daySubmitted.reduce(function(s, x) {
      return s + (parseFloat(x.eod.cashCollectedMYFM) || 0) + (parseFloat(x.eod.cashCollectedI2I) || 0);
    }, 0);

    selectedDayData = {
      date: selectedDay,
      info: dayInfo,
      submitted: daySubmitted,
      missed: dayMissed,
      totalCash: dayCash,
    };
  }

  // List view filter
  var filteredEods = eods.filter(function(e) {
    var date = e.date || '';
    if (date < monthStart || date > monthEnd) return false;
    if (filterRep && (e.salesRep || e.closerName || '') !== filterRep) return false;
    return true;
  }).sort(function(a, b) { return (b.date || '') > (a.date || '') ? 1 : -1; });

  function metricTiles(items) {
    return items.map(function(m) {
      return (
        <div key={m.label} className="glass-surface rounded-lg p-2 text-center">
          <p className="text-sm font-display font-bold" style={{ color: m.color || 'var(--crm-text-bright)' }}>{m.value}</p>
          <p className="text-[9px] font-mono uppercase" style={{ color: 'var(--crm-text-muted)' }}>{m.label}</p>
        </div>
      );
    });
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

  // The EOD form branches on Position, so the card has to as well. A setter rendered
  // through the closer tiles is six zeros and none of the work they actually did.
  function renderEODCard(eod, showName) {
    var rep = eod.salesRep || eod.closerName || 'Unknown';
    var initials = rep.split(' ').map(function(w) { return w.charAt(0); }).join('').substring(0, 2).toUpperCase();
    var closes = parseInt(eod.closes) || 0;
    var cashM = parseFloat(eod.cashCollectedMYFM) || 0;
    var cashI = parseFloat(eod.cashCollectedI2I) || 0;
    var totalC = cashM + cashI;
    var role = eod.role || '';
    var isSetter = role === 'setter';

    // Closer metrics
    var dials = parseInt(eod.outboundDials) || 0;
    var taken = parseInt(eod.callsTaken) || 0;
    var pitched = parseInt(eod.callsTakenAndPitched) || 0;
    var booked = parseInt(eod.netNewCallsBooked) || 0;
    var noShows = parseInt(eod.callsNoShowed) || 0;
    var canceled = parseInt(eod.callsCanceled) || 0;
    var rescheduled = parseInt(eod.callsRescheduled) || 0;
    var calendar = parseInt(eod.callsOnCalendar) || 0;
    var closeRate = pitched > 0 ? Math.min(Math.round((closes / pitched) * 100), 100) : 0;

    // Setter metrics
    var conversations = parseInt(eod.conversations) || 0;
    var liveCalls = parseInt(eod.liveCalls) || 0;
    var sets = parseInt(eod.sets) || 0;
    var followUps = parseInt(eod.followUpsScheduled) || 0;
    var contactRate = dials > 0 ? Math.min(Math.round((conversations / dials) * 100), 100) : 0;
    var setRate = conversations > 0 ? Math.min(Math.round((sets / conversations) * 100), 100) : 0;

    return (
      <div key={eod.id} className="glass-card p-4 md:p-5">
        {showName && (
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-display font-bold flex-shrink-0" style={{ background: 'rgba(var(--accent-rgb),0.15)', color: 'var(--crm-accent)' }}>
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-display font-bold truncate" style={{ color: 'var(--crm-text-bright)' }}>{rep}</p>
                {(eod.position || role) && (
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold flex-shrink-0"
                    style={{ background: 'rgba(var(--accent-rgb),0.15)', color: 'var(--crm-accent)' }}>
                    {eod.position || role}
                  </span>
                )}
              </div>
              <p className="text-[10px] font-mono" style={{ color: 'var(--crm-text-muted)' }}>{eod.date}</p>
            </div>
            {totalC > 0 && <span className="text-sm font-display font-bold" style={{ color: '#22c55e' }}>{formatCurrency(totalC)}</span>}
          </div>
        )}

        {isSetter ? (
          <>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-2">
              {metricTiles([
                { label: 'Dials', value: dials },
                { label: 'Convos', value: conversations },
                { label: 'Live Calls', value: liveCalls },
                { label: 'Sets', value: sets, color: sets > 0 ? '#22c55e' : null },
                { label: 'Follow-Ups', value: followUps },
                { label: 'Closes', value: closes, color: closes > 0 ? '#22c55e' : null },
              ])}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {metricTiles([
                { label: 'Talk Time', value: eod.talkTime || '—' },
                { label: 'Contact Rate', value: contactRate + '%', color: contactRate >= 30 ? '#22c55e' : contactRate > 0 ? '#f59e0b' : null },
                { label: 'Set Rate', value: setRate + '%', color: setRate >= 20 ? '#22c55e' : setRate > 0 ? '#f59e0b' : null },
                { label: 'Self Rating', value: eod.selfRating ? eod.selfRating + '/10' : '—' },
              ])}
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-2">
              {metricTiles([
                { label: 'Dials', value: dials },
                { label: 'Booked', value: booked },
                { label: 'Calendar', value: calendar },
                { label: 'Taken', value: taken },
                { label: 'Pitched', value: pitched },
                { label: 'Closes', value: closes, color: closes > 0 ? '#22c55e' : null },
              ])}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
              {metricTiles([
                { label: 'No Shows', value: noShows, color: noShows > 0 ? '#ef4444' : null },
                { label: 'Canceled', value: canceled },
                { label: 'Rescheduled', value: rescheduled },
                { label: 'Close Rate', value: closeRate + '%', color: closeRate >= 30 ? '#22c55e' : closeRate > 0 ? '#f59e0b' : null },
                { label: 'Self Rating', value: eod.selfRating ? eod.selfRating + '/10' : '—' },
                { label: 'Revenue', value: formatCurrency(totalC), color: '#22c55e' },
              ])}
            </div>
          </>
        )}

        {(cashM > 0 || cashI > 0) && (
          <p className="text-xs font-mono mt-2" style={{ color: 'var(--crm-text-muted)' }}>MYFM: {formatCurrency(cashM)} · I2I: {formatCurrency(cashI)}</p>
        )}

        {isSetter && eod.closerName && (
          <p className="text-xs font-mono mt-2" style={{ color: 'var(--crm-text-muted)' }}>Closer: <span style={{ color: 'var(--crm-text-bright)' }}>{eod.closerName}</span></p>
        )}

        {longField('Leads Called', eod.leadsCalled)}
        {longField('Call Outcomes', eod.callOutcomes)}
        {longField(isSetter ? 'Needs Help With' : 'Tomorrow', eod.improvementPlan)}

        <ExtraFields extra={eod.extra} />

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
  }

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
            <div className="glass-surface inline-flex rounded-xl p-1 gap-0.5">
              <button onClick={function() { setView('tracker'); setSelectedDay(null); }}
                className={'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display ' + (view === 'tracker' ? 'bg-crm-accent/15 text-crm-accent font-bold' : 'text-crm-muted')}>
                <Calendar className="w-3.5 h-3.5" /> Tracker
              </button>
              <button onClick={function() { setView('list'); setSelectedDay(null); }}
                className={'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display ' + (view === 'list' ? 'bg-crm-accent/15 text-crm-accent font-bold' : 'text-crm-muted')}>
                <List className="w-3.5 h-3.5" /> Details
              </button>
            </div>
            <div className="glass-surface inline-flex items-center rounded-xl px-2 py-1 gap-2">
              <button onClick={function() { setMonthOffset(monthOffset - 1); setSelectedDay(null); }} className="p-1"><ChevronLeft className="w-3.5 h-3.5" style={{ color: 'var(--crm-text-muted)' }} /></button>
              <span className="text-xs font-mono" style={{ color: 'var(--crm-text-bright)' }}>{viewMonth.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
              <button onClick={function() { setMonthOffset(monthOffset + 1); setSelectedDay(null); }} disabled={monthOffset >= 0} className="p-1 disabled:opacity-30"><ChevronRight className="w-3.5 h-3.5" style={{ color: 'var(--crm-text-muted)' }} /></button>
            </div>
          </div>
        </div>
      </header>

      <div className="px-4 md:px-8 pb-8">

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

        {view === 'tracker' && (
          <>
            {/* GRID */}
            <div className="glass-card overflow-hidden mb-4">
              <div className="table-scroll">
                <table className="w-full" style={{ minWidth: Math.max(400, workDays.length * 40 + 160) + 'px' }}>
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-10 text-left px-3 py-2.5 text-[10px] font-mono uppercase" style={{ color: 'var(--crm-text-muted)', background: 'var(--crm-bg)', minWidth: '140px' }}>Closer</th>
                      {workDays.map(function(day) {
                        var isSelected = selectedDay === day.date;
                        return (
                          <th key={day.date}
                            onClick={function() { setSelectedDay(isSelected ? null : day.date); }}
                            className="text-center px-0.5 py-2 cursor-pointer transition-all hover:bg-white/5"
                            style={isSelected ? { background: 'rgba(var(--accent-rgb),0.15)', borderRadius: '4px' } : {}}
                          >
                            <div className="text-[9px] font-mono" style={{ color: day.isToday ? 'var(--crm-accent)' : isSelected ? 'var(--crm-accent)' : 'var(--crm-text-muted)' }}>{day.label}</div>
                            <div className={'text-xs font-mono font-bold'} style={{ color: isSelected ? 'var(--crm-accent)' : day.isToday ? 'var(--crm-accent)' : 'var(--crm-text-bright)' }}>{day.day}</div>
                          </th>
                        );
                      })}
                      <th className="text-center px-3 py-2.5 text-[10px] font-mono uppercase" style={{ color: 'var(--crm-text-muted)', minWidth: '50px' }}>Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trackerRows.map(function(row) {
                      var submissions = row.submissions;
                      var submitted = 0;
                      var expected = 0;
                      var isOrphan = row.name.includes('(unlinked)');

                      return (
                        <tr key={row.email || row.name} className="border-t" style={{ borderColor: 'var(--crm-divider)' }}>
                          <td className="sticky left-0 z-10 px-3 py-2 text-xs font-display font-medium truncate" style={{
                            color: isOrphan ? '#f59e0b' : 'var(--crm-text-bright)',
                            background: 'var(--crm-bg)',
                            maxWidth: '140px',
                          }}>
                            {row.name}
                            {isOrphan && <span className="text-[9px] font-mono block" style={{ color: '#f59e0b' }}>needs profile link</span>}
                          </td>
                          {workDays.map(function(day) {
                            var eod = submissions[day.date];
                            var didSubmit = !!eod;
                            var isSelected = selectedDay === day.date;

                            if ((day.isPast || day.isToday) && !isOrphan) expected++;
                            if (didSubmit) submitted++;

                            var bg = isSelected ? 'rgba(var(--accent-rgb),0.08)' : 'transparent';
                            var icon = null;

                            if (didSubmit) {
                              bg = isSelected ? 'rgba(34,197,94,0.25)' : 'rgba(34,197,94,0.12)';
                              icon = <CheckCircle2 className="w-3.5 h-3.5" style={{ color: '#22c55e' }} />;
                            } else if (day.isPast && !isOrphan) {
                              bg = isSelected ? 'rgba(239,68,68,0.2)' : 'rgba(239,68,68,0.08)';
                              icon = <XCircle className="w-3.5 h-3.5" style={{ color: '#ef4444' }} />;
                            } else if (day.isToday && !isOrphan) {
                              bg = isSelected ? 'rgba(245,158,11,0.2)' : 'rgba(245,158,11,0.08)';
                              icon = <Clock className="w-3.5 h-3.5" style={{ color: '#f59e0b' }} />;
                            }

                            return (
                              <td key={day.date}
                                onClick={function() { setSelectedDay(isSelected ? null : day.date); }}
                                className="text-center px-0.5 py-2 cursor-pointer transition-all"
                                style={{ background: bg }}
                              >
                                <div className="flex items-center justify-center">{icon}</div>
                              </td>
                            );
                          })}
                          <td className="text-center px-3 py-2">
                            <span className="text-xs font-mono font-bold" style={{ color: expected > 0 && submitted / expected >= 0.9 ? '#22c55e' : expected > 0 && submitted / expected >= 0.7 ? '#f59e0b' : expected > 0 ? '#ef4444' : 'var(--crm-text-muted)' }}>
                              {expected > 0 ? Math.round((submitted / expected) * 100) : isOrphan ? '—' : '0%'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center gap-4 px-4 py-3" style={{ borderTop: '0.5px solid var(--crm-divider)' }}>
                <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3" style={{ color: '#22c55e' }} /><span className="text-[10px] font-mono" style={{ color: 'var(--crm-text-muted)' }}>Submitted</span></div>
                <div className="flex items-center gap-1.5"><XCircle className="w-3 h-3" style={{ color: '#ef4444' }} /><span className="text-[10px] font-mono" style={{ color: 'var(--crm-text-muted)' }}>Missed</span></div>
                <div className="flex items-center gap-1.5"><Clock className="w-3 h-3" style={{ color: '#f59e0b' }} /><span className="text-[10px] font-mono" style={{ color: 'var(--crm-text-muted)' }}>Pending</span></div>
                <span className="text-[10px] font-mono ml-auto" style={{ color: 'var(--crm-text-muted)' }}>Click any day to drill in</span>
              </div>
            </div>

            {/* SELECTED DAY DETAIL PANEL */}
            {selectedDayData && (
              <div className="glass-card overflow-hidden">
                <div className="flex items-center justify-between p-4 md:p-5" style={{ borderBottom: '0.5px solid var(--crm-divider)' }}>
                  <div>
                    <h3 className="text-base font-display font-bold" style={{ color: 'var(--crm-text-bright)' }}>{selectedDayData.info ? selectedDayData.info.fullLabel : selectedDay}</h3>
                    <p className="text-xs font-mono" style={{ color: 'var(--crm-text-muted)' }}>
                      {selectedDayData.submitted.length} submitted · {selectedDayData.missed.length} missed · {formatCurrency(selectedDayData.totalCash)} cash
                    </p>
                  </div>
                  <button onClick={function() { setSelectedDay(null); }} className="p-2 rounded-lg hover:bg-white/5">
                    <X className="w-4 h-4" style={{ color: 'var(--crm-text-muted)' }} />
                  </button>
                </div>

                {/* Who missed */}
                {selectedDayData.missed.length > 0 && (
                  <div className="p-4 md:p-5" style={{ background: 'rgba(239,68,68,0.05)', borderBottom: '0.5px solid var(--crm-divider)' }}>
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle className="w-4 h-4" style={{ color: '#ef4444' }} />
                      <h4 className="text-sm font-display font-bold" style={{ color: '#ef4444' }}>
                        Missing EODs ({selectedDayData.missed.length})
                      </h4>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedDayData.missed.map(function(name) {
                        var initials = name.split(' ').map(function(w) { return w.charAt(0); }).join('').substring(0, 2).toUpperCase();
                        return (
                          <div key={name} className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-display font-bold" style={{ background: 'rgba(239,68,68,0.2)', color: '#ef4444' }}>
                              {initials}
                            </div>
                            <span className="text-xs font-display font-medium" style={{ color: '#ef4444' }}>{name}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Who submitted */}
                {selectedDayData.submitted.length > 0 ? (
                  <div className="p-4 md:p-5 space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle2 className="w-4 h-4" style={{ color: '#22c55e' }} />
                      <h4 className="text-sm font-display font-bold" style={{ color: '#22c55e' }}>
                        Submitted ({selectedDayData.submitted.length})
                      </h4>
                    </div>
                    {selectedDayData.submitted.map(function(item) {
                      return renderEODCard(item.eod, true);
                    })}
                  </div>
                ) : (
                  <div className="p-8 text-center">
                    <p className="text-sm" style={{ color: 'var(--crm-text-muted)' }}>No one submitted an EOD this day</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {view === 'list' && (
          <>
            <div className="flex flex-wrap gap-3 mb-4">
              <select value={filterRep} onChange={function(e) { setFilterRep(e.target.value); }} className="input-field w-auto text-sm">
                <option value="">All Reps</option>
                {dedupedClosers.map(function(c) { return <option key={c.email || c.name} value={c.name}>{c.name}</option>; })}
              </select>
            </div>
            {filteredEods.length === 0 ? (
              <div className="glass-card p-12 text-center">
                <p className="text-sm" style={{ color: 'var(--crm-text-muted)' }}>No EOD reports this month</p>
              </div>
            ) : (
              <div className="space-y-3">{filteredEods.map(function(eod) { return renderEODCard(eod, true); })}</div>
            )}
          </>
        )}
      </div>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete EOD Report?"
        message={confirmDelete ? 'Permanently delete EOD for ' + confirmDelete.label + '.' : ''}
        confirmLabel="Delete EOD"
        onConfirm={function() { handleDelete(confirmDelete.id); }}
        onCancel={function() { setConfirmDelete(null); }}
      />
    </div>
  );
}
