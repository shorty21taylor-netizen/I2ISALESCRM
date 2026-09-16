'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Zap, Loader2, AlertTriangle, RefreshCw, Send, ChevronDown, ChevronRight } from 'lucide-react';
import { apiFetch, withWorkspace, useWorkspace } from '@/lib/workspace-client';

// Summit Sales AI over the after-call reports. The reading happens server-side;
// this asks and renders. Every array is guarded — the model may legitimately omit
// a section when it has nothing honest to put in it, and a missing array must not
// take the page down.

var STAGES = [
  'Reading the reports…',
  'Clustering objections…',
  'Looking for repeated behaviour…',
  'Checking for upstream leaks…',
];

function list(v) {
  return Array.isArray(v) ? v.filter(Boolean) : [];
}

function Confidence({ level }) {
  var tone = level === 'high' ? '#22c55e' : (level === 'medium' ? '#f59e0b' : 'var(--crm-text-muted)');
  return (
    <span className="aiap-pill" style={{ color: tone, borderColor: tone }}>
      {level || 'unknown'} confidence
    </span>
  );
}

function Objection({ o, top }) {
  var s = useState(false), open = s[0], setOpen = s[1];
  var pct = Math.max(0, Math.min(100, Number(o.pct) || 0));
  var width = top > 0 ? Math.max(4, Math.round((Number(o.count) || 0) / top * 100)) : 4;
  return (
    <div className="aiap-obj">
      <button className="aiap-obj-head" onClick={function() { setOpen(!open); }}>
        {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        <span className="aiap-obj-name">{o.name}</span>
        <span className="aiap-obj-count">{o.count} · {pct}%</span>
      </button>
      <div className="aiap-bar"><div className="aiap-bar-fill" style={{ width: width + '%' }} /></div>
      {open && (
        <div className="aiap-obj-body">
          {list(o.quotes).map(function(q, i) {
            return <p key={i} className="aiap-quote">“{q}”</p>;
          })}
          {o.rebuttal ? <p className="aiap-rebuttal"><strong>Rebuttal:</strong> {o.rebuttal}</p> : null}
        </div>
      )}
    </div>
  );
}

export default function AiAnalysisPanel({ from, to, reportCount }) {
  var workspaceId = useWorkspace();
  var s1 = useState(null), data = s1[0], setData = s1[1];
  var s2 = useState(false), loading = s2[0], setLoading = s2[1];
  var s3 = useState(''), error = s3[0], setError = s3[1];
  var s4 = useState(0), stage = s4[0], setStage = s4[1];
  var s5 = useState(''), note = s5[0], setNote = s5[1];
  var s6 = useState(null), meta = s6[0], setMeta = s6[1];
  var timer = useRef(null);

  var qs = useCallback(function(path) {
    var p = path + (path.indexOf('?') === -1 ? '?' : '&')
      + 'from=' + encodeURIComponent(from || '') + '&to=' + encodeURIComponent(to || '');
    return withWorkspace(p, workspaceId);
  }, [from, to, workspaceId]);

  // Look for a cached answer whenever the range changes. No model call here.
  useEffect(function() {
    if (workspaceId === null) return;
    var cancelled = false;
    setError('');
    apiFetch(qs('/api/ai/after-call-analysis'))
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (cancelled || !d || !d.success) return;
        setMeta({ available: d.available, withoutNotes: d.withoutNotes, isAdmin: d.isAdmin });
        setData(d.cached ? d : null);
      })
      .catch(function() {});
    return function() { cancelled = true; };
  }, [qs, workspaceId]);

  useEffect(function() {
    if (!loading) { if (timer.current) clearInterval(timer.current); return; }
    timer.current = setInterval(function() { setStage(function(n) { return (n + 1) % STAGES.length; }); }, 4000);
    return function() { if (timer.current) clearInterval(timer.current); };
  }, [loading]);

  function run(force) {
    setLoading(true); setError(''); setStage(0);
    apiFetch('/api/ai/after-call-analysis' + (workspaceId ? '?workspace=' + encodeURIComponent(workspaceId) : ''), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: from || '', to: to || '', force: !!force }),
    })
      .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, d: d }; }); })
      .then(function(res) {
        setLoading(false);
        if (!res.ok || res.d.error) { setError(res.d.error || 'The analysis failed.'); return; }
        setData(res.d);
      })
      .catch(function(e) { setLoading(false); setError(e.message || 'The analysis could not run.'); });
  }

  function toWhatsApp() {
    setNote('');
    apiFetch('/api/ai/after-call-analysis/share', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      // The workspace is named explicitly; the server still decides, but a share
      // must never fall back to "whichever workspace the session guessed".
      body: JSON.stringify({ from: from || '', to: to || '', workspace: workspaceId || '' }),
    })
      .then(function(r) { return r.json(); })
      .then(function(d) { setNote(d && d.error ? d.error : 'Sent to the team group.'); })
      .catch(function() { setNote('Could not send it.'); })
      .then(function() { setTimeout(function() { setNote(''); }, 4000); });
  }

  var result = data && data.result;
  var count = (meta && meta.available !== undefined) ? meta.available : (reportCount || 0);
  var tooThin = count < 3;

  return (
    <div className="aiap">
      {!result && (
        <button className="aiap-cta" onClick={function() { run(false); }} disabled={loading || tooThin}>
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
          <span className="aiap-cta-main">
            {loading ? STAGES[stage] : 'Analyze with Summit Sales AI'}
          </span>
          <span className="aiap-cta-sub">
            {tooThin
              ? 'Needs at least 3 reports with written notes in this range'
              : count + ' after-call report' + (count === 1 ? '' : 's') + ' in this range'}
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
          <div className="aiap-headline">
            <div className="aiap-headline-top">
              {/* Whose reading this is, said on the result and not only on the
                  button that is no longer there once a result replaces it. */}
              <span className="aiap-by"><Zap className="w-3 h-3" /> Summit Sales AI</span>
              <Confidence level={result.confidence} />
              <span className="aiap-meta">
                {data.callsAnalyzed} call{data.callsAnalyzed === 1 ? '' : 's'} analysed
                {data.sampled ? ' · sampled from ' + data.totalInRange : ''}
                {data.withoutNotes ? ' · ' + data.withoutNotes + ' had no notes' : ''}
              </span>
            </div>
            <p className="aiap-headline-text">{result.headline}</p>
          </div>

          {list(result.objections).length > 0 && (
            <section className="aiap-sec">
              <h3 className="aiap-h">Top objections</h3>
              {(function() {
                var rows = list(result.objections);
                var top = rows.reduce(function(m, o) { return Math.max(m, Number(o.count) || 0); }, 0);
                return rows.map(function(o, i) { return <Objection key={i} o={o} top={top} />; });
              })()}
            </section>
          )}

          {list(result.patterns).length > 0 && (
            <section className="aiap-sec">
              <h3 className="aiap-h">Patterns</h3>
              {list(result.patterns).map(function(p, i) {
                return (
                  <div key={i} className="aiap-card">
                    <p className="aiap-card-title">{p.title}</p>
                    <p className="aiap-card-body">{p.observation}</p>
                    {list(p.evidence).map(function(e, j) { return <p key={j} className="aiap-quote">“{e}”</p>; })}
                    {p.impact ? <p className="aiap-card-foot">{p.impact}</p> : null}
                  </div>
                );
              })}
            </section>
          )}

          {list(result.repFlags).length > 0 && (
            <section className="aiap-sec">
              <h3 className="aiap-h">🚩 Red flags</h3>
              {list(result.repFlags).map(function(f, i) {
                return (
                  <div key={i} className="aiap-card aiap-card-red">
                    <p className="aiap-card-title">
                      {f.rep} <span className={'aiap-sev aiap-sev-' + (f.severity || 'low')}>{f.severity}</span>
                    </p>
                    <p className="aiap-card-body">{f.issue}</p>
                    {list(f.evidence).map(function(e, j) { return <p key={j} className="aiap-quote">“{e}”</p>; })}
                    {f.coachingAction ? <p className="aiap-card-foot"><strong>Coach:</strong> {f.coachingAction}</p> : null}
                  </div>
                );
              })}
            </section>
          )}

          {list(result.upstreamFlags).length > 0 && (
            <section className="aiap-sec">
              <h3 className="aiap-h">⬆️ Upstream fixes</h3>
              {list(result.upstreamFlags).map(function(u, i) {
                return (
                  <div key={i} className="aiap-card aiap-card-amber">
                    <p className="aiap-card-title">{u.area}</p>
                    <p className="aiap-card-body">{u.issue}</p>
                    {list(u.evidence).map(function(e, j) { return <p key={j} className="aiap-quote">“{e}”</p>; })}
                    {u.fix ? <p className="aiap-card-foot"><strong>Fix:</strong> {u.fix}</p> : null}
                  </div>
                );
              })}
            </section>
          )}

          {result.topFix && (
            <div className="aiap-topfix">
              <p className="aiap-topfix-label">This week&rsquo;s one fix</p>
              <p className="aiap-topfix-text">{result.topFix}</p>
            </div>
          )}

          <div className="aiap-foot">
            <span className="aiap-meta">
              {data.cached ? 'Cached · ' : ''}
              {data.createdAt ? 'Analysed ' + new Date(data.createdAt).toLocaleString() : ''}
            </span>
            <div className="aiap-foot-actions">
              {note ? <span className="aiap-meta">{note}</span> : null}
              {meta && meta.isAdmin ? (
                <button className="btn-ghost text-xs flex items-center gap-1.5" onClick={toWhatsApp}>
                  <Send className="w-3.5 h-3.5" /> Send to WhatsApp
                </button>
              ) : null}
              <button className="btn-ghost text-xs flex items-center gap-1.5" disabled={loading}
                onClick={function() { run(true); }}>
                <RefreshCw className="w-3.5 h-3.5" /> Re-run
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
