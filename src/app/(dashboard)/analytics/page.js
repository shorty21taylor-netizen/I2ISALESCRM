'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { Download, X } from 'lucide-react';
import { useWorkspace, withWorkspace, apiFetch } from '@/lib/workspace-client';
import ClientOnly from '@/components/ClientOnly';
import { formatCurrency } from '@/lib/utils';
import { toReportDay, todayInReportTimezone } from '@/lib/report-date';
import { GROUP_LABELS } from '@/lib/rep-groups';

// Analytics reads the same endpoint the printed report does, so a number on this
// page and the same number in the PDF can never drift apart.

var PRESETS = [
  { id: '7', label: '7d' },
  { id: '14', label: '14d' },
  { id: '30', label: '30d' },
  { id: '60', label: '60d' },
  { id: '90', label: '90d' },
];

function daysAgo(days) {
  var d = new Date();
  d.setDate(d.getDate() - (parseInt(days, 10) - 1));
  return toReportDay(d);
}

function pct(v) { return v === null || v === undefined ? '—' : v + '%'; }
// A per-stage cash figure is null when that stage is not being counted; $0 would
// claim the stage earned nothing, which is a different statement.
function cashOr(v) { return v === null || v === undefined ? '—' : formatCurrency(v); }
function num(v) { return (Math.round((v || 0) * 10) / 10).toLocaleString('en-US'); }
function shortDay(day) {
  if (!day) return '';
  return new Date(day + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// A hero figure earns a sparkline; the rest of the page does not.
function Spark({ series, field, positive }) {
  if (!series || series.length < 2) return null;
  var vals = series.map(function(d) { return d[field] || 0; });
  var max = Math.max.apply(null, vals) || 1;
  var w = 132, h = 30;
  var step = w / (vals.length - 1);
  var pts = vals.map(function(v, i) {
    return [Math.round(i * step * 10) / 10, Math.round((h - (v / max) * (h - 3) - 1.5) * 10) / 10];
  });
  var line = 'M' + pts.map(function(p) { return p[0] + ' ' + p[1]; }).join(' L ');
  var area = line + ' L ' + w + ' ' + h + ' L 0 ' + h + ' Z';
  var stroke = positive ? '#22c55e' : 'var(--crm-accent)';
  return (
    <svg width={w} height={h} viewBox={'0 0 ' + w + ' ' + h} className="mt-2 block" aria-hidden="true">
      <path d={area} fill={positive ? 'rgba(34,197,94,0.10)' : 'rgba(var(--accent-rgb),0.10)'} />
      <path d={line} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.4" fill={stroke} />
    </svg>
  );
}

function Hero({ label, value, sub, series, field, positive }) {
  return (
    <div className="an-hero">
      <p className="an-hero-l">{label}</p>
      <p className="an-hero-v" style={positive ? { color: '#22c55e' } : {}}>{value}</p>
      {sub ? <p className="an-hero-s">{sub}</p> : null}
      <Spark series={series} field={field} positive={positive} />
    </div>
  );
}

function Line2({ label, value, sub, tone }) {
  return (
    <div className="an-line">
      <span className="an-line-l">{label}{sub ? <em className="an-line-s"> {sub}</em> : null}</span>
      <span className="an-line-v" style={tone ? { color: tone } : {}}>{value}</span>
    </div>
  );
}

function Panel({ title, note, children, pad }) {
  return (
    <div className="an-card">
      <div className="an-card-h">
        <h3 className="an-card-t">{title}</h3>
        {note ? <span className="an-card-n">{note}</span> : null}
      </div>
      <div className={pad === false ? '' : 'p-4'}>{children}</div>
    </div>
  );
}

var GROUP_COLS = {
  closers: [
    { k: 'onCalendar', h: 'On cal.' }, { k: 'taken', h: 'Showed' },
    { k: 'noShowed', h: 'No-show', tone: '#ef4444' }, { k: 'pitched', h: 'Offers' },
    { k: 'offeredNoClose', h: 'No close', tone: '#f59e0b' }, { k: 'closes', h: 'Closes', tone: '#22c55e' },
    { k: 'showRate', h: 'Show %', rate: true }, { k: 'closeRate', h: 'Close %', rate: true },
    { k: 'cash', h: 'Cash', cash: true },
  ],
  setters: [
    { k: 'dials', h: 'Dials' }, { k: 'conversations', h: 'Convos' }, { k: 'sets', h: 'Sets', tone: '#22c55e' },
    { k: 'dialToSet', h: 'Dial→set %', rate: true }, { k: 'avgDialsPerDay', h: 'Dials/day' },
    { k: 'followUps', h: 'Follow-ups' }, { k: 'setCredits', h: 'Closed sets', tone: '#22c55e' },
  ],
  dmSetters: [
    { k: 'conversations', h: 'Convos' }, { k: 'sets', h: 'Sets', tone: '#22c55e' },
    { k: 'followUps', h: 'Follow-ups' }, { k: 'setCredits', h: 'Closed sets', tone: '#22c55e' },
  ],
};

function GroupTable({ group, rows }) {
  var cols = GROUP_COLS[group];
  if (!rows || !rows.length) {
    return <p className="an-empty">No {GROUP_LABELS[group].toLowerCase()} filed a report in this range.</p>;
  }
  return (
    <div className="table-scroll">
      <table className="data-table w-full min-w-[680px]">
        <thead>
          <tr>
            <th className="an-th an-th-name">{GROUP_LABELS[group].replace(/s$/, '')}</th>
            <th className="an-th an-th-n">Days</th>
            {cols.map(function(c) { return <th key={c.k} className="an-th an-th-n">{c.h}</th>; })}
          </tr>
        </thead>
        <tbody>
          {rows.map(function(r) {
            return (
              <tr key={r.name} className="an-tr">
                <td className="an-td-name">{r.name}</td>
                <td className="an-td-n">{num(r.daysReported)}</td>
                {cols.map(function(c) {
                  var raw = r[c.k];
                  var text = c.rate ? pct(raw) : c.cash ? formatCurrency(raw) : num(raw);
                  return <td key={c.k} className="an-td-n" style={c.tone && raw ? { color: c.tone } : {}}>{text}</td>;
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ExportDialog({ open, onClose, initialStart, initialEnd }) {
  var [start, setStart] = useState(initialStart);
  var [end, setEnd] = useState(initialEnd);
  var router = useRouter();

  useEffect(function() { setStart(initialStart); setEnd(initialEnd); }, [initialStart, initialEnd]);
  useEffect(function() {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    if (open) document.addEventListener('keydown', onKey);
    return function() { document.removeEventListener('keydown', onKey); };
  }, [open, onClose]);

  if (!open) return null;

  var invalid = !start || !end || start > end;

  function quick(days) {
    setStart(daysAgo(days));
    setEnd(todayInReportTimezone());
  }
  function thisMonth() {
    var now = new Date();
    setStart(toReportDay(new Date(now.getFullYear(), now.getMonth(), 1)));
    setEnd(todayInReportTimezone());
  }
  function lastMonth() {
    var now = new Date();
    setStart(toReportDay(new Date(now.getFullYear(), now.getMonth() - 1, 1)));
    setEnd(toReportDay(new Date(now.getFullYear(), now.getMonth(), 0)));
  }

  return (
    <div className="an-scrim" onClick={onClose}>
      <div className="an-modal" onClick={function(e) { e.stopPropagation(); }} role="dialog" aria-label="Export sales report">
        <div className="an-modal-h">
          <div>
            <h3 className="an-modal-t">Export sales report</h3>
            <p className="an-modal-s">A branded PDF of every metric in the range, with a written summary.</p>
          </div>
          <button className="an-x" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>

        <div className="an-modal-b">
          <div className="grid grid-cols-2 gap-3">
            <label className="an-field">
              <span>From</span>
              <input type="date" value={start} max={end || undefined} onChange={function(e) { setStart(e.target.value); }} />
            </label>
            <label className="an-field">
              <span>To</span>
              <input type="date" value={end} min={start || undefined} onChange={function(e) { setEnd(e.target.value); }} />
            </label>
          </div>

          <div className="an-quick">
            <span className="an-quick-l">Quick ranges</span>
            <button className="an-chip" onClick={function() { quick(7); }}>Last 7 days</button>
            <button className="an-chip" onClick={function() { quick(30); }}>Last 30 days</button>
            <button className="an-chip" onClick={function() { quick(90); }}>Last 90 days</button>
            <button className="an-chip" onClick={thisMonth}>This month</button>
            <button className="an-chip" onClick={lastMonth}>Last month</button>
          </div>

          {invalid ? <p className="an-warn">Pick a start date on or before the end date.</p> : null}
        </div>

        <div className="an-modal-f">
          <button className="an-btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="an-btn"
            disabled={invalid}
            onClick={function() {
              router.push('/reports/sales?start=' + encodeURIComponent(start) + '&end=' + encodeURIComponent(end));
            }}
          >
            Build report
          </button>
        </div>
      </div>
    </div>
  );
}

var DETAIL_TABS = [
  { id: 'calls', label: 'Calls' },
  { id: 'prospecting', label: 'Prospecting' },
  { id: 'rates', label: 'Conversion' },
  { id: 'revenue', label: 'Revenue' },
  { id: 'reporting', label: 'Reporting' },
];

export default function AnalyticsPage() {
  var workspaceId = useWorkspace();
  var [report, setReport] = useState(null);
  var [loading, setLoading] = useState(true);
  var [error, setError] = useState('');
  var [preset, setPreset] = useState('30');
  var [tab, setTab] = useState('calls');
  var [group, setGroup] = useState('closers');
  var [exporting, setExporting] = useState(false);

  var start = daysAgo(preset);
  var end = todayInReportTimezone();

  useEffect(function() {
    if (!workspaceId) return;
    var cancelled = false;
    setLoading(true);
    setError('');
    var q = '/api/reports/sales?start=' + start + '&end=' + end + '&narrative=skip';
    apiFetch(withWorkspace(q, workspaceId))
      .then(function(res) { return res.json(); })
      .then(function(json) {
        if (cancelled) return;
        if (!json.success) setError(json.error || 'Could not load analytics');
        else setReport(json);
        setLoading(false);
      })
      .catch(function() {
        if (cancelled) return;
        setError('Could not reach the server');
        setLoading(false);
      });
    return function() { cancelled = true; };
  }, [preset, workspaceId, start, end]);

  if (loading) return <div className="px-4 md:px-8 py-6 text-sm font-mono" style={{ color: 'var(--crm-muted)' }}>Loading analytics…</div>;
  if (error) return <div className="px-4 md:px-8 py-6 text-sm font-mono" style={{ color: '#ef4444' }}>{error}</div>;
  if (!report) return null;

  var m = report.metrics;
  var v = m.volume;
  var r = m.rates;
  var c = m.cash;
  var daily = m.daily.map(function(d) { return Object.assign({}, d, { label: shortDay(d.date) }); });
  var tooltipStyle = { background: 'var(--tooltip-bg)', border: '1px solid var(--tooltip-border)', borderRadius: '12px', color: 'var(--crm-text-bright)', fontSize: '12px' };

  return (
    <div className="min-h-screen">
      <header className="page-header py-4 md:py-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-display font-bold" style={{ color: 'var(--crm-text-bright)' }}>Analytics</h1>
            <p className="text-xs font-mono" style={{ color: 'var(--crm-muted)' }}>
              {shortDay(m.range.start)} — {shortDay(m.range.end)} · {m.range.daysReported} reporting days · {m.range.repsReporting} reps
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="an-seg">
              {PRESETS.map(function(p) {
                return (
                  <button key={p.id} onClick={function() { setPreset(p.id); }}
                    className={'an-seg-i' + (preset === p.id ? ' on' : '')}>{p.label}</button>
                );
              })}
            </div>
            <button className="an-btn" onClick={function() { setExporting(true); }}>
              <Download size={14} /> Export
            </button>
          </div>
        </div>
      </header>

      <div className="px-4 md:px-8 pb-10">
        {report.scopedToSelf ? (
          <div className="an-scoped mb-4">
            <span className="an-scoped-t">Your numbers only</span>
            <span>This page is reporting on {report.scopedTo || 'you'}, not the floor. Exports carry the same scope.</span>
          </div>
        ) : null}

        {m.quality.clean && !m.quality.untracked.length ? null : (
          <div className="an-quality mb-4">
            <span className="an-quality-t">Data quality</span>
            {m.quality.rejectedCount ? (
              <span>{m.quality.rejectedCount} EOD {m.quality.rejectedCount === 1 ? 'entry is' : 'entries are'} too large to be a call count and {m.quality.rejectedCount === 1 ? 'was' : 'were'} left out.</span>
            ) : null}
            {m.quality.untracked.length ? (
              <span>Not reported by anyone: {m.quality.untracked.map(function(u) { return u.label; }).join(', ')}.</span>
            ) : null}
            <span className="an-quality-n">Anything built on those shows a dash, never a zero. Full breakdown is in the exported report.</span>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <Hero label="Cash collected" value={formatCurrency(c.collected)} sub={c.dealCount + ' deals · ' + formatCurrency(c.avgDeal) + ' average'} series={daily} field="cash" positive />
          <Hero label="Closes" value={num(v.closes)} sub={num(v.pitched) + ' offers made'} series={daily} field="closes" />
          <Hero label="Close rate" value={pct(r.closeRateOfOffers)} sub={num(v.offeredNoClose) + ' offered, did not close'} series={daily} field="pitched" />
          <Hero label="Show rate" value={pct(r.showRate)} sub={num(v.noShowed) + ' no-shows · ' + pct(r.noShowRate)} series={daily} field="taken" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-4">
          <div className="lg:col-span-2">
            <Panel title="The funnel" note="each stage of the one above">
              <div className="an-funnel">
                {m.funnel.map(function(f) {
                  // The bar shows conversion from the stage above, not share of the
                  // top: dials dwarf every later stage and flatten the whole chart.
                  var conv = f.conversion;
                  var share = conv === null ? null : Math.max(1.5, Math.min(100, conv));
                  return (
                    <div className="an-fn" key={f.stage}>
                      <div className="an-fn-top">
                        <span className="an-fn-s">{f.stage}</span>
                        <span className="an-fn-v">{num(f.value)}</span>
                        <span className="an-fn-c">{conv === null ? '' : conv + '%'}</span>
                      </div>
                      <span className="an-fn-bar"><i style={{ width: (share === null ? 0 : share) + '%' }} /></span>
                    </div>
                  );
                })}
              </div>
            </Panel>
          </div>

          <div className="lg:col-span-3">
            <Panel title="Daily activity" pad={false}>
              <div className="p-4 h-[268px]">
                <ClientOnly>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={daily}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="label" stroke="var(--crm-muted)" tick={{ fontSize: 9, fill: "var(--crm-muted)" }} />
                      <YAxis yAxisId="dials" stroke="var(--crm-muted)" tick={{ fontSize: 10, fill: "var(--crm-muted)" }} />
                      <YAxis yAxisId="calls" orientation="right" stroke="var(--crm-muted)" tick={{ fontSize: 10, fill: "var(--crm-muted)" }} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Area yAxisId="dials" type="monotone" dataKey="dials" stroke="var(--crm-muted)" fill="rgba(var(--accent-rgb),0.08)" name="Dials (left)" />
                      <Area yAxisId="calls" type="monotone" dataKey="taken" stroke="var(--crm-accent)" fill="rgba(var(--accent-rgb),0.16)" name="Showed (right)" />
                      <Area yAxisId="calls" type="monotone" dataKey="closes" stroke="#22c55e" fill="rgba(34,197,94,0.12)" name="Closes (right)" />
                      <Legend wrapperStyle={{ fontSize: '10px' }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </ClientOnly>
              </div>
            </Panel>
          </div>
        </div>

        <div className="an-card mb-4">
          <div className="an-card-h">
            <h3 className="an-card-t">Every metric</h3>
            <div className="an-tabs">
              {DETAIL_TABS.map(function(t) {
                return (
                  <button key={t.id} onClick={function() { setTab(t.id); }}
                    className={'an-tab' + (tab === t.id ? ' on' : '')}>{t.label}</button>
                );
              })}
            </div>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
              {tab === 'calls' ? [
                <Line2 key="a" label="Calls booked" value={num(v.sets)} />,
                <Line2 key="b" label="On the calendar" value={num(v.onCalendar)} sub={m.quality.derivedCalendar ? '· derived' : ''} />,
                <Line2 key="c" label="Showed" value={num(v.taken)} sub={'· ' + pct(r.showRate)} />,
                <Line2 key="d" label="No-showed" value={num(v.noShowed)} sub={'· ' + pct(r.noShowRate)} tone="#ef4444" />,
                <Line2 key="e" label="Cancelled" value={num(v.canceled)} sub={'· ' + pct(r.cancelRate)} tone="#f59e0b" />,
                <Line2 key="f" label="Rescheduled" value={num(v.rescheduled)} sub={'· ' + pct(r.rescheduleRate)} tone="#f59e0b" />,
                <Line2 key="g" label="Showed, no offer made" value={num(v.showedNotPitched)} />,
                <Line2 key="h" label="Offers made" value={num(v.pitched)} sub={'· ' + pct(r.pitchRate) + ' of shows'} />,
                <Line2 key="i" label="Offered, did not close" value={num(v.offeredNoClose)} sub={'· ' + pct(r.offerDeclineRate)} tone="#f59e0b" />,
                <Line2 key="j" label="Closed" value={num(v.closes)} tone="#22c55e" />,
              ] : null}

              {tab === 'prospecting' ? [
                <Line2 key="a" label="Outbound dials" value={num(v.dials)} />,
                <Line2 key="b" label="Conversations" value={num(v.conversations)} sub={'· ' + pct(r.dialToConversation) + ' of dials'} />,
                <Line2 key="c" label="Live calls" value={num(v.liveCalls)} />,
                <Line2 key="d" label="Follow-ups scheduled" value={num(v.followUps)} />,
                <Line2 key="e" label="Dials per reporting day" value={num(m.range.daysReported ? Math.round(v.dials / m.range.daysReported) : 0)} />,
                <Line2 key="f" label="Reporting days" value={num(m.range.daysReported)} />,
              ] : null}

              {tab === 'rates' ? [
                <Line2 key="a" label="Dial → conversation" value={pct(r.dialToConversation)} />,
                <Line2 key="b" label="Conversation → booked call" value={pct(r.conversationToSet)} />,
                <Line2 key="c" label="Dial → booked call" value={pct(r.dialToSet)} />,
                <Line2 key="d" label="Show rate" value={pct(r.showRate)} />,
                <Line2 key="e" label="No-show rate" value={pct(r.noShowRate)} tone="#ef4444" />,
                <Line2 key="f" label="Cancel rate" value={pct(r.cancelRate)} tone="#f59e0b" />,
                <Line2 key="g" label="Reschedule rate" value={pct(r.rescheduleRate)} />,
                <Line2 key="h" label="Pitch rate" value={pct(r.pitchRate)} />,
                <Line2 key="i" label="Close rate of offers" value={pct(r.closeRateOfOffers)} tone="#22c55e" />,
                <Line2 key="j" label="Close rate of shows" value={pct(r.closeRateOfShows)} />,
                <Line2 key="k" label="Close rate of calendar" value={pct(r.closeRateOfCalendar)} />,
                <Line2 key="l" label="Dial → close" value={pct(r.dialToClose)} />,
              ] : null}

              {tab === 'revenue' ? [
                <Line2 key="a" label="Cash collected" value={formatCurrency(c.collected)} tone="#22c55e" />,
                <Line2 key="b" label="Average deal" value={formatCurrency(c.avgDeal)} />,
                <Line2 key="c" label="Cash per offer made" value={cashOr(c.perOffer)} />,
                <Line2 key="d" label="Cash per call held" value={cashOr(c.perShow)} />,
                <Line2 key="e" label="Cash per booked call" value={cashOr(c.perBookedCall)} />,
                <Line2 key="f" label="Cash per dial" value={c.perDial === null ? '—' : '$' + c.perDial.toFixed(2)} />,
                <Line2 key="g" label="Cash per reporting day" value={formatCurrency(c.perDay)} />,
                <Line2 key="h" label="Inbound revenue" value={formatCurrency(m.source.inboundCash)} sub={'· ' + m.source.inboundDeals + ' deals'} />,
                <Line2 key="i" label="Outbound revenue" value={formatCurrency(m.source.outboundCash)} sub={'· ' + m.source.outboundDeals + ' deals'} />,
                <Line2 key="j" label="Cash reported on EODs" value={formatCurrency(c.fromEod)} />,
                c.duplicatesRemoved > 0
                  ? <Line2 key="k" label="Duplicate deals merged" value={c.duplicatesRemoved + ' · ' + formatCurrency(c.duplicateCash)} tone="#f59e0b" />
                  : null,
              ] : null}

              {tab === 'reporting' ? [
                <Line2 key="a" label="EOD reports filed" value={num(m.reporting.eodsFiled)} />,
                <Line2 key="b" label="Deal forms filed" value={num(m.reporting.dealsFiled)} />,
                <Line2 key="c" label="Deals after dedupe" value={num(m.reporting.dealsAfterDedupe)} />,
                <Line2 key="d" label="Booked-call forms" value={num(m.reporting.bookedForms.filed)} />,
                <Line2 key="e" label="Qualified on booking" value={num(m.reporting.bookedForms.qualified)} sub={'· ' + pct(m.reporting.bookedForms.qualifiedRate)} />,
                <Line2 key="f" label="After-call reports filed" value={num(m.reporting.afterCallsFiled)} />,
              ].concat(m.reporting.afterCallOutcomes.map(function(o) {
                return <Line2 key={'o-' + o.outcome} label={'After-call: ' + o.outcome} value={num(o.count)} sub={'· ' + pct(o.share)} />;
              })) : null}
            </div>
          </div>
        </div>

        <div className="an-card mb-4">
          <div className="an-card-h">
            <h3 className="an-card-t">Team</h3>
            <div className="an-tabs">
              {['closers', 'setters', 'dmSetters'].map(function(g) {
                return (
                  <button key={g} onClick={function() { setGroup(g); }}
                    className={'an-tab' + (group === g ? ' on' : '')}>
                    {GROUP_LABELS[g]} <span className="an-tab-n">{m.groups[g].length}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <GroupTable group={group} rows={m.groups[group]} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Panel title="Revenue trend" pad={false}>
            <div className="p-4 h-64">
              <ClientOnly>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={daily}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="label" stroke="var(--crm-muted)" tick={{ fontSize: 9, fill: "var(--crm-muted)" }} />
                    <YAxis stroke="var(--crm-muted)" tick={{ fontSize: 10, fill: "var(--crm-muted)" }} tickFormatter={function(x) { return x >= 1000 ? '$' + Math.round(x / 1000) + 'k' : '$' + x; }} />
                    <Tooltip contentStyle={tooltipStyle} formatter={function(x) { return ['$' + x.toLocaleString(), 'Cash']; }} />
                    <Line type="monotone" dataKey="cash" stroke="#22c55e" strokeWidth={2} dot={{ r: 2.5 }} name="Cash" />
                  </LineChart>
                </ResponsiveContainer>
              </ClientOnly>
            </div>
          </Panel>

          <Panel title="Booked against no-shows" pad={false}>
            <div className="p-4 h-64">
              <ClientOnly>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={daily}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="label" stroke="var(--crm-muted)" tick={{ fontSize: 9, fill: "var(--crm-muted)" }} />
                    <YAxis stroke="var(--crm-muted)" tick={{ fontSize: 10, fill: "var(--crm-muted)" }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="sets" fill="#22c55e" radius={[4, 4, 0, 0]} name="Booked" />
                    <Bar dataKey="noShowed" fill="#ef4444" radius={[4, 4, 0, 0]} name="No-shows" />
                    <Legend wrapperStyle={{ fontSize: '10px' }} />
                  </BarChart>
                </ResponsiveContainer>
              </ClientOnly>
            </div>
          </Panel>

          {m.programs.length ? (
            <Panel title="Revenue by program">
              <div className="an-funnel">
                {m.programs.map(function(p) {
                  var top = m.programs[0].cash || 1;
                  return (
                    <div key={p.name}>
                      <div className="an-fn-top">
                        <span className="an-fn-s">{p.name}</span>
                        <span className="an-fn-v">{formatCurrency(p.cash)}</span>
                        <span className="an-fn-c wide">{p.deals} @ {formatCurrency(p.avg)}</span>
                      </div>
                      <span className="an-fn-bar"><i style={{ width: Math.max(2, Math.round((p.cash / top) * 100)) + '%' }} /></span>
                    </div>
                  );
                })}
              </div>
            </Panel>
          ) : null}

          <Panel title="Offers against closes" pad={false}>
            <div className="p-4 h-64">
              <ClientOnly>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={daily}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="label" stroke="var(--crm-muted)" tick={{ fontSize: 9, fill: "var(--crm-muted)" }} />
                    <YAxis stroke="var(--crm-muted)" tick={{ fontSize: 10, fill: "var(--crm-muted)" }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="pitched" fill="var(--crm-accent)" radius={[4, 4, 0, 0]} name="Offers" />
                    <Bar dataKey="closes" fill="#22c55e" radius={[4, 4, 0, 0]} name="Closes" />
                    <Legend wrapperStyle={{ fontSize: '10px' }} />
                  </BarChart>
                </ResponsiveContainer>
              </ClientOnly>
            </div>
          </Panel>
        </div>
      </div>

      <ExportDialog
        open={exporting}
        onClose={function() { setExporting(false); }}
        initialStart={start}
        initialEnd={end}
      />
    </div>
  );
}
