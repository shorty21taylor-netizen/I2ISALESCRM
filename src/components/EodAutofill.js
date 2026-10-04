'use client';

import { useState, useEffect, useCallback } from 'react';
import { Wand2, Loader2, RefreshCw, Check } from 'lucide-react';
import { apiFetch, withWorkspace } from '@/lib/workspace-client';
import { formatCurrency } from '@/lib/utils';

// The day, as the CRM already has it, sitting above the end-of-day form.
//
// Two jobs. It shows what has been filed so far — the strip updates every time
// the rep files something, which is the "it keeps track through the day" half —
// and it fills the form's blanks from those records on one press.
//
// It fills BLANKS ONLY. A number the rep already typed is never overwritten;
// where the day's records disagree, the disagreement is shown and the rep picks.
// Quietly replacing somebody's typed figure is how a convenience becomes the
// reason the board is wrong.

function Stat({ label, value }) {
  return (
    <div className="eod-stat">
      <span className="eod-stat-v">{value}</span>
      <span className="eod-stat-l">{label}</span>
    </div>
  );
}

export default function EodAutofill({ role, day, rep, workspaceId, values, onApply }) {
  var s1 = useState(null), draft = s1[0], setDraft = s1[1];
  var s2 = useState(false), loading = s2[0], setLoading = s2[1];
  var s3 = useState(''), err = s3[0], setErr = s3[1];
  // What the last press actually did, so the rep is told rather than left to
  // spot which boxes changed.
  var s4 = useState(null), applied = s4[0], setApplied = s4[1];

  var load = useCallback(function() {
    if (!day) return;
    setLoading(true); setErr('');
    var path = '/api/eod-draft?day=' + encodeURIComponent(day)
      + (role === 'dm' ? '&role=dm' : '')
      + (rep ? '&rep=' + encodeURIComponent(rep) : '');
    apiFetch(withWorkspace(path, workspaceId))
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data && data.success) setDraft(data);
        else setErr((data && data.error) || 'Could not read today.');
        setLoading(false);
      })
      .catch(function() { setErr('Could not reach the server.'); setLoading(false); });
  }, [day, role, rep, workspaceId]);

  useEffect(function() { load(); }, [load]);

  function apply() {
    if (!draft) return;
    var next = {};
    var filled = [];
    var conflicts = [];

    Object.keys(draft.fields).forEach(function(key) {
      var f = draft.fields[key];
      if (!f.derived) return;
      var current = String((values && values[key]) !== undefined && values[key] !== null ? values[key] : '').trim();
      if (!current) {
        next[key] = f.value;
        filled.push({ key: key, value: f.value, from: f.from });
        return;
      }
      // Same number typed by hand — nothing to say about it.
      if (Number(current) === Number(f.value)) return;
      conflicts.push({ key: key, yours: current, records: f.value, from: f.from });
    });

    if (onApply) onApply(next);
    setApplied({ filled: filled, conflicts: conflicts });
  }

  // Replace a single figure with what the records show, when the rep decides the
  // records are right. One field at a time, because "overwrite everything" is the
  // behaviour this component exists to avoid.
  function takeRecords(key, value) {
    var one = {};
    one[key] = String(value);
    if (onApply) onApply(one);
    setApplied(function(prev) {
      if (!prev) return prev;
      return {
        filled: prev.filled.concat([{ key: key, value: String(value), from: 'you took the records’ figure' }]),
        conflicts: prev.conflicts.filter(function(c) { return c.key !== key; }),
      };
    });
  }

  var c = (draft && draft.counts) || {};
  var nothing = draft && !c.booked && !c.deals && !(c.afterCalls || 0) && !(c.onCalendar || 0);

  return (
    <div className="eod-auto">
      <div className="eod-auto-head">
        <div>
          <p className="eod-auto-title">Your day, as the CRM has it</p>
          <p className="eod-auto-sub">
            {day ? day : 'Pick a date'}
            {draft && draft.rep ? ' · ' + draft.rep : ''}
          </p>
        </div>
        <div className="eod-auto-actions">
          <button type="button" onClick={load} className="eod-auto-refresh" title="Re-read today">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          </button>
          <button type="button" onClick={apply} disabled={loading || !draft || nothing}
            className="eod-auto-btn disabled:opacity-40">
            <Wand2 className="w-4 h-4" />
            Fill from today
          </button>
        </div>
      </div>

      {err ? <p className="eod-auto-err">{err}</p> : null}

      {draft ? (
        <div className="eod-stats">
          <Stat label={role === 'dm' ? 'calls set' : 'calls booked'} value={c.booked || 0} />
          {role === 'dm' ? null : <Stat label="on calendar" value={c.onCalendar || 0} />}
          {role === 'dm' ? null : <Stat label="after-call reports" value={c.afterCalls || 0} />}
          <Stat label={role === 'dm' ? 'closed off your sets' : 'deals closed'} value={c.deals || 0} />
          <Stat label="cash" value={formatCurrency(c.cash || 0)} />
        </div>
      ) : null}

      {draft && draft.notes && draft.notes.length ? (
        <ul className="eod-auto-notes">
          {draft.notes.map(function(note, i) { return <li key={i}>{note}</li>; })}
        </ul>
      ) : null}

      {applied ? (
        <div className="eod-auto-result">
          <p className="eod-auto-result-h">
            <Check className="w-3.5 h-3.5" />
            {applied.filled.length
              ? applied.filled.length + (applied.filled.length === 1 ? ' box filled' : ' boxes filled')
              : 'Nothing to fill — every box the records cover already had a number in it'}
          </p>
          {applied.filled.length ? (
            <ul className="eod-auto-list">
              {applied.filled.map(function(f) {
                return <li key={f.key}><b>{f.value}</b> — {f.from}</li>;
              })}
            </ul>
          ) : null}

          {applied.conflicts.length ? (
            <div className="eod-auto-conflicts">
              <p className="eod-auto-result-h eod-auto-warn">
                {applied.conflicts.length === 1
                  ? 'One figure you typed disagrees with the records. Yours was kept.'
                  : applied.conflicts.length + ' figures you typed disagree with the records. Yours were kept.'}
              </p>
              <ul className="eod-auto-list">
                {applied.conflicts.map(function(cf) {
                  return (
                    <li key={cf.key}>
                      You have <b>{cf.yours}</b>, the records show <b>{cf.records}</b> ({cf.from}).{' '}
                      <button type="button" className="eod-auto-take"
                        onClick={function() { takeRecords(cf.key, cf.records); }}>
                        use {cf.records}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          <p className="eod-auto-rest">
            Everything else on the form is still yours to fill in — the CRM does not
            count dials, cancellations or reschedules.
          </p>
        </div>
      ) : null}
    </div>
  );
}
