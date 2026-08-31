'use client';

import { useState, useEffect } from 'react';
import { MessageSquare, CheckCircle2, XCircle, MinusCircle, ExternalLink, RefreshCw, Flame, Phone, DollarSign, ClipboardCheck, FileText, Clock, Zap, TrendingUp, TrendingDown } from 'lucide-react';
import { useWorkspace, withWorkspace, apiFetch } from '@/lib/workspace-client';
import { toReportDay, todayInReportTimezone } from '@/lib/report-date';

// Identity comes from the icon and the written label on every row and every bar.
// Colour is never the only thing telling two things apart here — under deuteranopia
// the sent-green and failed-red sit at ΔE 7.4, which is only legible because the
// tick, the cross and the words are there too.
var KIND_META = {
  'book-call': { label: 'Booked Call', icon: Phone },
  'close-deal': { label: 'Closed Deal', icon: DollarSign },
  'eod-report': { label: 'EOD Report', icon: ClipboardCheck },
  'after-call': { label: 'After-Call', icon: FileText },
  'scheduled': { label: 'Scheduled', icon: Clock },
  'manual': { label: 'Manual', icon: MessageSquare },
};

var STATUS_META = {
  sent: { label: 'Sent', icon: CheckCircle2, color: '#22c55e' },
  failed: { label: 'Failed', icon: XCircle, color: '#ef4444' },
  skipped: { label: 'Not sent', icon: MinusCircle, color: 'var(--crm-text-muted)' },
  external: { label: 'Sent by n8n', icon: ExternalLink, color: 'var(--crm-accent)' },
};

var SOURCE_LABEL = { n8n: 'n8n form', scheduler: 'scheduler', crm: 'CRM form' };

function kindMeta(kind) {
  return KIND_META[kind] || { label: kind || 'Other', icon: MessageSquare };
}

function timeOf(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

// "Today" and "Yesterday" carry more than a date does; older days keep the date.
function dayHeading(day) {
  var today = todayInReportTimezone();
  if (day === today) return 'Today';
  var y = new Date(today + 'T12:00:00Z');
  y.setUTCDate(y.getUTCDate() - 1);
  if (day === y.toISOString().split('T')[0]) return 'Yesterday';
  return new Date(day + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

export default function MessageLogPage() {
  var workspaceId = useWorkspace();
  var [rows, setRows] = useState([]);
  var [counts, setCounts] = useState({ sent: 0, failed: 0, skipped: 0, external: 0 });
  var [stats, setStats] = useState(null);
  var [loading, setLoading] = useState(true);
  var [kind, setKind] = useState('');
  var [status, setStatus] = useState('');
  var [open, setOpen] = useState(null);

  function load() {
    setLoading(true);
    var path = '/api/message-log?limit=200'
      + (kind ? '&kind=' + kind : '')
      + (status ? '&status=' + status : '');
    apiFetch(withWorkspace(path, workspaceId))
      .then(function(r) { return r.json(); })
      .then(function(d) {
        setRows(d.data || []);
        setCounts(d.counts || { sent: 0, failed: 0, skipped: 0, external: 0 });
        setStats(d.stats || null);
        setLoading(false);
      })
      .catch(function() { setLoading(false); });
  }

  useEffect(function() {
    if (workspaceId === null) return;
    load();
  }, [workspaceId, kind, status]);

  var daily = (stats && stats.daily) || [];
  var peak = daily.reduce(function(m, d) { return Math.max(m, d.count); }, 0);
  var todayCount = stats ? stats.today : 0;
  var delta = stats ? stats.today - stats.yesterday : 0;

  // One hue for magnitude, direct labels for identity — the app is monochrome and a
  // four-colour key here would fight it and fail CVD anyway.
  var kindRows = Object.keys(KIND_META)
    .map(function(k) { return { kind: k, count: (stats && stats.byKind && stats.byKind[k]) || 0, meta: KIND_META[k] }; })
    .filter(function(r) { return r.count > 0; })
    .sort(function(a, b) { return b.count - a.count; });
  var kindPeak = kindRows.reduce(function(m, r) { return Math.max(m, r.count); }, 0);

  // Group the feed by day so the page reads as activity rather than a flat table.
  var groups = [];
  var groupIndex = {};
  rows.forEach(function(r) {
    var day = toReportDay(r.sentAt);
    if (groupIndex[day] === undefined) {
      groupIndex[day] = groups.length;
      groups.push({ day: day, rows: [] });
    }
    groups[groupIndex[day]].rows.push(r);
  });

  return (
    <div className="min-h-screen">
      <header className="page-header py-4 md:py-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-display font-bold flex items-center gap-2" style={{ color: 'var(--crm-text-bright)' }}>
              <MessageSquare className="w-5 h-5" /> Message Log
            </h1>
            <p className="text-xs font-mono" style={{ color: 'var(--crm-text-muted)' }}>
              Every WhatsApp notification a form has fired
            </p>
          </div>
          <button onClick={load} className="btn-ghost flex items-center gap-2 text-xs self-start">
            <RefreshCw className={'w-3.5 h-3.5 ' + (loading ? 'animate-spin' : '')} /> Refresh
          </button>
        </div>
      </header>

      <div className="px-4 md:px-8 pb-8 space-y-5">

        {/* ===== HEADLINE ===== */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">

          <div className="glass-card p-5">
            <p className="text-[10px] font-mono uppercase tracking-[0.15em] mb-1" style={{ color: 'var(--crm-text-muted)' }}>Fired today</p>
            <div className="flex items-end gap-2">
              <p className="text-4xl font-display font-bold leading-none" style={{ color: 'var(--crm-text-bright)' }}>{todayCount}</p>
              {stats && (delta !== 0) && (
                <span className="flex items-center gap-0.5 text-xs font-mono mb-1" style={{ color: delta > 0 ? '#22c55e' : 'var(--crm-text-muted)' }}>
                  {delta > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                  {(delta > 0 ? '+' : '') + delta}
                </span>
              )}
            </div>
            <p className="text-[11px] font-mono mt-1" style={{ color: 'var(--crm-text-muted)' }}>
              {stats ? stats.yesterday + ' yesterday' : ''}
            </p>
          </div>

          <div className="glass-card p-5">
            <p className="text-[10px] font-mono uppercase tracking-[0.15em] mb-1" style={{ color: 'var(--crm-text-muted)' }}>Delivered</p>
            <p className="text-4xl font-display font-bold leading-none" style={{ color: stats && stats.deliveryRate === 100 ? '#22c55e' : 'var(--crm-text-bright)' }}>
              {stats ? stats.deliveryRate : 0}<span className="text-xl">%</span>
            </p>
            {/* A ratio against a limit: a meter on the same hue, not a two-slice pie. */}
            <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(var(--accent-rgb),0.12)' }}>
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: (stats ? stats.deliveryRate : 0) + '%', background: stats && stats.deliveryRate === 100 ? '#22c55e' : 'var(--crm-accent)' }} />
            </div>
            <p className="text-[11px] font-mono mt-1.5" style={{ color: 'var(--crm-text-muted)' }}>
              {stats ? stats.attempted + ' attempted' : ''}
            </p>
          </div>

          <div className="glass-card p-5">
            <p className="text-[10px] font-mono uppercase tracking-[0.15em] mb-1" style={{ color: 'var(--crm-text-muted)' }}>Streak</p>
            <div className="flex items-end gap-1.5">
              <p className="text-4xl font-display font-bold leading-none" style={{ color: stats && stats.streak > 0 ? '#f59e0b' : 'var(--crm-text-bright)' }}>
                {stats ? stats.streak : 0}
              </p>
              {stats && stats.streak > 0 && <Flame className="w-5 h-5 mb-0.5" style={{ color: '#f59e0b' }} />}
            </div>
            <p className="text-[11px] font-mono mt-1" style={{ color: 'var(--crm-text-muted)' }}>
              {stats && stats.streak === 1 ? 'day running' : 'days running'}
            </p>
          </div>

          <div className="glass-card p-5">
            <p className="text-[10px] font-mono uppercase tracking-[0.15em] mb-1" style={{ color: 'var(--crm-text-muted)' }}>Best day</p>
            <p className="text-4xl font-display font-bold leading-none" style={{ color: 'var(--crm-text-bright)' }}>
              {stats && stats.bestDay ? stats.bestDay.count : 0}
            </p>
            <p className="text-[11px] font-mono mt-1" style={{ color: 'var(--crm-text-muted)' }}>
              {stats && stats.bestDay && stats.bestDay.date
                ? new Date(stats.bestDay.date + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                : 'last 14 days'}
            </p>
          </div>
        </div>

        {/* ===== 14-DAY ACTIVITY ===== */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-display font-bold flex items-center gap-2" style={{ color: 'var(--crm-text-bright)' }}>
              <Zap className="w-4 h-4" style={{ color: 'var(--crm-accent)' }} /> Last 14 days
            </h3>
            <span className="text-[11px] font-mono" style={{ color: 'var(--crm-text-muted)' }}>peak {peak}</span>
          </div>
          <div className="flex items-end gap-1.5" style={{ height: '96px' }}>
            {daily.map(function(d) {
              var isToday = stats && d.date === stats.todayDate;
              var pct = peak > 0 ? Math.round((d.count / peak) * 100) : 0;
              return (
                <div key={d.date} className="flex-1 flex flex-col items-center justify-end h-full group relative" title={d.count + ' on ' + dayHeading(d.date)}>
                  {d.count > 0 && (
                    <span className="text-[10px] font-mono mb-1" style={{ color: isToday ? 'var(--crm-accent)' : 'var(--crm-text-muted)' }}>{d.count}</span>
                  )}
                  <div
                    className="w-full transition-all duration-500"
                    style={{
                      // 4px rounded data-end, anchored to the baseline.
                      height: Math.max(d.count > 0 ? 6 : 3, pct * 0.62) + 'px',
                      borderRadius: '4px 4px 0 0',
                      background: d.count === 0
                        ? 'rgba(var(--accent-rgb),0.10)'
                        : (isToday ? 'var(--crm-accent-glow)' : 'var(--crm-accent)'),
                      opacity: d.count === 0 ? 1 : (isToday ? 1 : 0.75),
                    }}
                  />
                  <span className="text-[9px] font-mono mt-1.5" style={{ color: isToday ? 'var(--crm-accent)' : 'var(--crm-text-muted)' }}>
                    {new Date(d.date + 'T12:00:00Z').getUTCDate()}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ===== BY FORM + DELIVERY ===== */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          <div className="glass-card p-5">
            <h3 className="text-sm font-display font-bold mb-4" style={{ color: 'var(--crm-text-bright)' }}>By form</h3>
            {kindRows.length === 0 ? (
              <p className="text-xs font-mono" style={{ color: 'var(--crm-text-muted)' }}>Nothing logged yet.</p>
            ) : (
              <div className="space-y-2.5">
                {kindRows.map(function(r, i) {
                  var Icon = r.meta.icon;
                  var pct = kindPeak > 0 ? Math.round((r.count / kindPeak) * 100) : 0;
                  return (
                    <button
                      key={r.kind}
                      onClick={function() { setKind(kind === r.kind ? '' : r.kind); }}
                      className="w-full text-left group"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: kind === r.kind ? 'var(--crm-accent)' : 'var(--crm-text-muted)' }} />
                        <span className="text-xs font-display font-medium" style={{ color: kind === r.kind ? 'var(--crm-accent)' : 'var(--crm-text-bright)' }}>
                          {r.meta.label}
                        </span>
                        {i === 0 && <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'rgba(var(--accent-rgb),0.12)', color: 'var(--crm-text-muted)' }}>most</span>}
                        <span className="ml-auto text-xs font-mono" style={{ color: 'var(--crm-text-bright)' }}>{r.count}</span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(var(--accent-rgb),0.08)' }}>
                        <div className="h-full transition-all duration-700"
                          style={{ width: pct + '%', borderRadius: '4px', background: kind === r.kind ? 'var(--crm-accent-glow)' : 'var(--crm-accent)', opacity: kind === r.kind ? 1 : 0.7 }} />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="glass-card p-5">
            <h3 className="text-sm font-display font-bold mb-4" style={{ color: 'var(--crm-text-bright)' }}>Delivery</h3>
            <div className="grid grid-cols-2 gap-2.5">
              {['sent', 'external', 'failed', 'skipped'].map(function(k) {
                var meta = STATUS_META[k];
                var Icon = meta.icon;
                var active = status === k;
                return (
                  <button
                    key={k}
                    onClick={function() { setStatus(active ? '' : k); }}
                    className="glass-surface p-3 rounded-xl text-left transition-all"
                    style={active ? { boxShadow: 'inset 0 0 0 1px rgba(var(--accent-rgb),0.35)' } : {}}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: meta.color }} />
                      <span className="text-[10px] font-mono uppercase truncate" style={{ color: 'var(--crm-text-muted)' }}>{meta.label}</span>
                    </div>
                    <p className="text-xl font-display font-bold" style={{ color: k === 'failed' && counts[k] > 0 ? '#ef4444' : 'var(--crm-text-bright)' }}>
                      {counts[k] || 0}
                    </p>
                  </button>
                );
              })}
            </div>
            {(kind || status) && (
              <button
                onClick={function() { setKind(''); setStatus(''); }}
                className="mt-3 text-[11px] font-mono transition-colors"
                style={{ color: 'var(--crm-accent)' }}
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* ===== FEED ===== */}
        <div className="space-y-4">
          {loading && <p className="text-sm font-mono py-6 text-center" style={{ color: 'var(--crm-text-muted)' }}>Loading…</p>}

          {!loading && groups.length === 0 && (
            <div className="glass-card p-12 text-center">
              <MessageSquare className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--crm-text-muted)' }} />
              <p className="text-sm" style={{ color: 'var(--crm-text-muted)' }}>
                {kind || status ? 'Nothing matches this filter.' : 'No messages logged yet. Submit a form to see one appear.'}
              </p>
            </div>
          )}

          {groups.map(function(group) {
            var groupCount = group.rows.length;
            return (
              <div key={group.day}>
                <div className="flex items-center gap-3 mb-2 px-1">
                  <span className="text-[11px] font-mono uppercase tracking-[0.15em]" style={{ color: 'var(--crm-text-muted)' }}>
                    {dayHeading(group.day)}
                  </span>
                  <span className="text-[11px] font-mono" style={{ color: 'var(--crm-text-muted)' }}>· {groupCount}</span>
                  <div className="flex-1 h-px" style={{ background: 'var(--crm-divider)' }} />
                </div>

                <div className="glass-card overflow-hidden">
                  {group.rows.map(function(r, idx) {
                    var meta = kindMeta(r.kind);
                    var KindIcon = meta.icon;
                    var sMeta = STATUS_META[r.status] || STATUS_META.skipped;
                    var SIcon = sMeta.icon;
                    var isOpen = open === r.id;

                    return (
                      <div key={r.id} style={idx > 0 ? { borderTop: '0.5px solid var(--crm-divider)' } : {}}>
                        <button
                          onClick={function() { setOpen(isOpen ? null : r.id); }}
                          className="w-full text-left px-4 py-3 flex items-center gap-3 transition-colors hover:bg-white/[0.02]"
                        >
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background: 'rgba(var(--accent-rgb),0.10)' }}>
                            <KindIcon className="w-4 h-4" style={{ color: 'var(--crm-accent)' }} />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-display font-semibold" style={{ color: 'var(--crm-text-bright)' }}>{meta.label}</span>
                              {r.recordLabel && (
                                <span className="text-sm truncate" style={{ color: 'var(--crm-text-muted)' }}>· {r.recordLabel}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className="flex items-center gap-1 text-[11px] font-mono" style={{ color: sMeta.color }}>
                                <SIcon className="w-3 h-3" /> {sMeta.label}
                              </span>
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'rgba(var(--accent-rgb),0.08)', color: 'var(--crm-text-muted)' }}>
                                {SOURCE_LABEL[r.source] || r.source}
                              </span>
                              {r.error && (
                                <span className="text-[11px] font-mono truncate" style={{ color: '#ef4444' }}>{r.error}</span>
                              )}
                            </div>
                          </div>

                          <span className="text-[11px] font-mono flex-shrink-0" style={{ color: 'var(--crm-text-muted)' }}>{timeOf(r.sentAt)}</span>
                        </button>

                        {isOpen && (
                          <div className="px-4 pb-4 pl-14 space-y-2">
                            <p className="text-[11px] font-mono" style={{ color: 'var(--crm-text-muted)' }}>
                              Destination: {r.destination || '—'}
                            </p>
                            <pre className="text-xs whitespace-pre-wrap rounded-lg p-3 overflow-x-auto"
                              style={{ background: 'rgba(0,0,0,0.25)', border: '0.5px solid var(--crm-divider)', color: 'var(--crm-text-bright)' }}>
                              {r.message}
                            </pre>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
