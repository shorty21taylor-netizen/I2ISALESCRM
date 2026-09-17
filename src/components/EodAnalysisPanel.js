'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Zap, Loader2, AlertTriangle, RefreshCw, Send, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useWorkspace, withWorkspace, apiFetch } from '@/lib/workspace-client';
import ClientOnly from '@/components/ClientOnly';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

// Summit Sales AI over the EOD reports. Deliberately the same shape as the
// after-call panel so the two pages read as one product.
//
// Every figure shown here was computed in eod-analyst.js, server-side. The model
// only interprets them, so nothing on this page needs to recalculate anything
// either — it renders what it was handed.

var STAGES = [
  'Aggregating the reports…',
  'Measuring funnel drop-off…',
  'Checking rep consistency…',
  'Reading the improvement plans…',
  'Writing it up…',
];

// The model may omit an array entirely. Every list goes through this.
function list(v) {
  return Array.isArray(v) ? v.filter(Boolean) : [];
}

// A null rate is unknowable, not zero. It prints as an em dash everywhere.
function rate(v) {
  return (v === null || v === undefined) ? '—' : v + '%';
}

function money(v) {
  if (v === null || v === undefined) return '—';
  return '$' + Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function Confidence({ level }) {
  var tone = level === 'high' ? '#22c55e' : level === 'medium' ? '#f59e0b' : 'var(--crm-text-muted)';
  return (
    <span className="aiap-pill" style={{ color: tone, borderColor: tone }}>
      {(level || 'unknown') + ' confidence'}
    </span>
  );
}

function Arrow({ direction }) {
  if (direction === 'up') return <TrendingUp className="w-3.5 h-3.5" style={{ color: '#22c55e' }} />;
  if (direction === 'down') return <TrendingDown className="w-3.5 h-3.5" style={{ color: '#ef4444' }} />;
  return <Minus className="w-3.5 h-3.5" style={{ color: 'var(--crm-text-muted)' }} />;
}

// The funnel, drawn from the aggregate rather than from anything the model said.
// The stage with the worst conversion INTO it is the one painted red.
function funnelStages(aggregate) {
  if (!aggregate || !aggregate.team) return [];
  var t = aggregate.team.totals, r = aggregate.team.rates;
  return [
    { name: 'Dials', value: t.dials, into: null },
    { name: 'Booked', value: t.booked, into: r.dialsToBooked },
    { name: 'Taken', value: t.taken, into: r.bookedToTaken },
    { name: 'Pitched', value: t.pitched, into: r.takenToPitched },
    { name: 'Closed', value: t.closes, into: r.pitchedToClosed },
  ];
}

function worstStageName(stages) {
  var worst = null;
  stages.forEach(function(s) {
    if (s.into === null || s.into === undefined) return;
    if (!worst || s.into < worst.into) worst = s;
  });
  return worst ? worst.name : '';
}

export default function EodAnalysisPanel({ from, to, isAdmin }) {
  var workspaceId = useWorkspace();
  var s1 = useState(null), data = s1[0], setData = s1[1];
  var s2 = useState(false), loading = s2[0], setLoading = s2[1];
  var s3 = useState(''), error = s3[0], setError = s3[1];
  var s4 = useState(0), stage = s4[0], setStage = s4[1];
  var s5 = useState(''), note = s5[0], setNote = s5[1];
  var s6 = useState(null), aggregate = s6[0], setAggregate = s6[1];
  var timer = useRef(null);

  var qs = useCallback(function(path) {
    var p = path + (path.indexOf('?') === -1 ? '?' : '&')
      + 'from=' + encodeURIComponent(from || '') + '&to=' + encodeURIComponent(to || '');
    return withWorkspace(p, workspaceId);
  }, [from, to, workspaceId]);

  // Look for a cached answer whenever the range changes. No model call here, and
  // the aggregate comes back either way so the button can count what it would read.
  useEffect(function() {
    if (workspaceId === null) return;
    var cancelled = false;
    setError('');
    apiFetch(qs('/api/ai/eod-analysis'))
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (cancelled || !d || !d.success) return;
        setAggregate(d.aggregate || null);
        setData(d.cached ? d : null);
      })
      .catch(function() {});
    return function() { cancelled = true; };
  }, [qs, workspaceId]);

  useEffect(function() {
    if (!loading) { if (timer.current) clearInterval(timer.current); return; }
    timer.current = setInterval(function() { setStage(function(n) { return (n + 1) % STAGES.length; }); }, 3500);
    return function() { if (timer.current) clearInterval(timer.current); };
  }, [loading]);

  function run(force) {
    setLoading(true); setError(''); setStage(0);
    apiFetch('/api/ai/eod-analysis' + (workspaceId ? '?workspace=' + encodeURIComponent(workspaceId) : ''), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: from || '', to: to || '', force: !!force }),
    })
      .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, d: d }; }); })
      .then(function(res) {
        setLoading(false);
        if (res.d && res.d.aggregate) setAggregate(res.d.aggregate);
        if (!res.ok || res.d.error) { setError(res.d.error || 'The analysis failed.'); return; }
        setData(res.d);
      })
      .catch(function(e) { setLoading(false); setError(e.message || 'The analysis could not run.'); });
  }

  function toWhatsApp() {
    setNote('');
    apiFetch('/api/ai/eod-analysis/share', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: from || '', to: to || '', workspace: workspaceId || '' }),
    })
      .then(function(r) { return r.json(); })
      .then(function(d) { setNote(d && d.error ? d.error : 'Sent to the team group.'); })
      .catch(function() { setNote('Could not send it.'); })
      .then(function() { setTimeout(function() { setNote(''); }, 5000); });
  }

  var result = data && data.result;
  var reportCount = aggregate ? aggregate.reportCount : 0;
  var repCount = aggregate ? aggregate.repCount : 0;
  var dayCount = aggregate ? aggregate.range.businessDays : 0;
  var tooThin = reportCount < 3;

  var stages = funnelStages(aggregate);
  var worst = worstStageName(stages);
  var chartRows = stages.map(function(s) {
    return { name: s.name, value: s.value, label: s.into === null ? '—' : s.into + '%', worst: s.name === worst };
  });

  return (
    <div className="aiap eodp">
      {!result && (
        <button className="aiap-cta" onClick={function() { run(false); }} disabled={loading || tooThin}>
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
          <span className="aiap-cta-main">
            {loading ? STAGES[stage] : 'Analyze with Summit Sales AI'}
          </span>
          <span className="aiap-cta-sub">
            {tooThin
              ? 'Needs at least 3 EOD reports in this range — there ' + (reportCount === 1 ? 'is 1' : 'are ' + reportCount)
              : reportCount + ' EOD report' + (reportCount === 1 ? '' : 's') + ' · '
                + repCount + ' rep' + (repCount === 1 ? '' : 's') + ' · '
                + dayCount + ' day' + (dayCount === 1 ? '' : 's')}
          </span>
        </button>
      )}

      {error && (
        <div className="aiap-error">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div className="aiap-out">
          {/* 1. Headline */}
          <div className="aiap-headline">
            <div className="aiap-headline-top">
              <span className="aiap-by"><Zap className="w-3 h-3" /> Summit Sales AI</span>
              <Confidence level={result.confidence} />
              <span className="aiap-meta">
                {(data.businessDays || dayCount)} day{(data.businessDays || dayCount) === 1 ? '' : 's'} ·{' '}
                {(data.repsAnalyzed || repCount)} rep{(data.repsAnalyzed || repCount) === 1 ? '' : 's'} ·{' '}
                {(data.reportsAnalyzed || reportCount)} report{(data.reportsAnalyzed || reportCount) === 1 ? '' : 's'}
                {aggregate && aggregate.setterReportCount
                  ? ' · ' + aggregate.setterReportCount + ' setter report'
                    + (aggregate.setterReportCount === 1 ? '' : 's') + ' not in the funnel'
                  : ''}
              </span>
            </div>
            <p className="aiap-headline-text">{result.headline}</p>
          </div>

          {/* 2. The funnel, drawn from the computed aggregate */}
          {stages.length > 0 && (
            <section className="aiap-sec">
              <h3 className="aiap-h">Funnel</h3>
              <div className="eodp-funnel">
                <ClientOnly>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={chartRows} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                      <XAxis dataKey="name" tick={{ fill: 'var(--crm-text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: 'var(--crm-text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
                      <Tooltip
                        cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                        contentStyle={{ background: 'var(--crm-surface, #16181d)', border: '0.5px solid var(--crm-divider)',
                          borderRadius: 10, fontSize: 12 }}
                        labelStyle={{ color: 'var(--crm-text-bright)' }}
                      />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                        {chartRows.map(function(row, i) {
                          return <Cell key={i} fill={row.worst ? '#ef4444' : 'var(--crm-accent)'} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ClientOnly>
                <div className="eodp-conv">
                  {chartRows.map(function(row, i) {
                    return (
                      <div key={row.name} className={'eodp-conv-cell' + (row.worst ? ' eodp-conv-worst' : '')}>
                        <span className="eodp-conv-stage">{row.name}</span>
                        <span className="eodp-conv-value">{Number(row.value || 0).toLocaleString('en-US')}</span>
                        <span className="eodp-conv-rate">{i === 0 ? '' : row.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          )}

          {/* 3. Funnel leaks */}
          {list(result.funnelLeaks).length > 0 && (
            <section className="aiap-sec">
              <h3 className="aiap-h">💸 Funnel leaks</h3>
              {list(result.funnelLeaks).map(function(leak, i) {
                return (
                  <div key={i} className="aiap-card">
                    <div className="aiap-card-title">
                      <span>{leak.stage}</span>
                      {leak.metric ? <span className="aiap-meta">{leak.metric}</span> : null}
                    </div>
                    <p className="aiap-card-body">{leak.observation}</p>
                    {list(leak.evidence).map(function(ev, j) {
                      return <p key={j} className="aiap-quote">{ev}</p>;
                    })}
                    {leak.fix ? <p className="aiap-rebuttal"><strong>Fix:</strong> {leak.fix}</p> : null}
                  </div>
                );
              })}
            </section>
          )}

          {/* 4. Trends */}
          {list(result.trends).length > 0 && (
            <section className="aiap-sec">
              <h3 className="aiap-h">📈 Trends</h3>
              {list(result.trends).map(function(t, i) {
                return (
                  <div key={i} className="aiap-card">
                    <div className="aiap-card-title">
                      <Arrow direction={t.direction} />
                      <span>{t.title}</span>
                    </div>
                    <p className="aiap-card-body">{t.observation}</p>
                    {list(t.evidence).map(function(ev, j) {
                      return <p key={j} className="aiap-quote">{ev}</p>;
                    })}
                  </div>
                );
              })}
            </section>
          )}

          {/* 5. Red flags — admin only, and stripped server-side for everyone else */}
          {isAdmin && list(result.repFlags).length > 0 && (
            <section className="aiap-sec">
              <h3 className="aiap-h">🚩 Red flags</h3>
              {list(result.repFlags).map(function(f, i) {
                return (
                  <div key={i} className="aiap-card aiap-card-red">
                    <div className="aiap-card-title">
                      <span className={'aiap-sev aiap-sev-' + (f.severity || 'low')}>{f.severity || 'low'}</span>
                      <span>{f.rep}</span>
                    </div>
                    <p className="aiap-card-body">{f.issue}</p>
                    {list(f.evidence).map(function(ev, j) {
                      return <p key={j} className="aiap-quote">{ev}</p>;
                    })}
                    {f.coachingAction ? <p className="aiap-rebuttal"><strong>Coach:</strong> {f.coachingAction}</p> : null}
                  </div>
                );
              })}
            </section>
          )}

          {/* 6. Improvement plan review — the repeating badge is the point */}
          {list(result.planReview).length > 0 && (
            <section className="aiap-sec">
              <h3 className="aiap-h">📝 Improvement plan review</h3>
              {list(result.planReview).map(function(p, i) {
                return (
                  <div key={i} className={'aiap-card' + (p.repeating ? ' aiap-card-amber' : '')}>
                    <div className="aiap-card-title">
                      <span>{p.rep}</span>
                      {p.repeating ? <span className="eodp-repeating">repeating</span> : null}
                    </div>
                    <p className="aiap-card-body">{p.pattern}</p>
                    {p.note ? <p className="aiap-card-foot">{p.note}</p> : null}
                  </div>
                );
              })}
            </section>
          )}

          {/* 7. Data integrity — admin only */}
          {isAdmin && list(result.dataIntegrity).length > 0 && (
            <section className="aiap-sec">
              <h3 className="aiap-h">⚠️ Data integrity</h3>
              {list(result.dataIntegrity).map(function(d, i) {
                return (
                  <div key={i} className="aiap-card aiap-card-amber">
                    <div className="aiap-card-title"><span>{d.issue}</span></div>
                    {list(d.reps).length > 0 && (
                      <p className="aiap-card-body">{list(d.reps).join(', ')}</p>
                    )}
                    {d.note ? <p className="aiap-card-foot">{d.note}</p> : null}
                  </div>
                );
              })}
            </section>
          )}

          {/* 8. The one fix */}
          {result.topFix ? (
            <div className="aiap-topfix">
              <p className="aiap-topfix-label">This week’s one fix</p>
              <p className="aiap-topfix-text">{result.topFix}</p>
            </div>
          ) : null}

          <div className="aiap-foot">
            <span className="aiap-meta">
              {data.createdAt ? 'Last analyzed ' + new Date(data.createdAt).toLocaleString('en-US', {
                month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
              }) : ''}
              {data.cached ? <span className="eodp-cached">cached</span> : null}
            </span>
            <span className="aiap-foot-actions">
              {note ? <span className="aiap-meta">{note}</span> : null}
              <button className="btn-ghost text-xs" onClick={function() { run(true); }} disabled={loading}>
                <RefreshCw className="w-3 h-3" /> Re-run
              </button>
              {isAdmin && (
                <button className="btn-ghost text-xs" onClick={toWhatsApp} disabled={loading}>
                  <Send className="w-3 h-3" /> Send to WhatsApp
                </button>
              )}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
