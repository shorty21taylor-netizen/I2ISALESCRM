'use client';

import { useState, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import { apiFetch, withWorkspace } from '@/lib/workspace-client';
import { todayInReportTimezone } from '@/lib/report-date';
import { PROGRAMS, PAYMENT_PLATFORMS } from '@/lib/i2i-forms';
import RepPicker from '@/components/RepPicker';

// Log a sale by hand.
//
// This exists because the CRM does not see every sale a rep is paid on: a renewal,
// an upsell taken in the DMs, a deal closed off a call nobody filed. The alternative
// was to let those through the closed-deal form, which would move the floor's
// revenue, booked-to-close rate and leaderboard on a figure that never came off a
// call. A logged sale is its own row instead, and it is never added into the
// derived totals — see the ledger in store.js.
//
// The commission figure fills itself in from the rep's rate and is then editable,
// because a tiered or flat-fee split is a real thing on this floor and a rep knows
// what they are owed better than one stored percentage does.

function money(v) {
  var n = parseFloat(String(v === null || v === undefined ? '' : v).replace(/[$,\s]/g, ''));
  return isFinite(n) && n > 0 ? n : 0;
}

export default function CommissionLogger({ workspaceId, defaultRate, canFileForOthers, myName, onLogged }) {
  var s1 = useState(false), open = s1[0], setOpen = s1[1];
  var s2 = useState(''), leadName = s2[0], setLeadName = s2[1];
  var s3 = useState(''), program = s3[0], setProgram = s3[1];
  var s4 = useState(''), cash = s4[0], setCash = s4[1];
  var s5 = useState(''), rate = s5[0], setRate = s5[1];
  var s6 = useState(''), amount = s6[0], setAmount = s6[1];
  var s7 = useState(todayInReportTimezone()), day = s7[0], setDay = s7[1];
  var s8 = useState(''), processor = s8[0], setProcessor = s8[1];
  var s9 = useState(''), notes = s9[0], setNotes = s9[1];
  var sa = useState(''), closer = sa[0], setCloser = sa[1];
  var sb = useState(false), busy = sb[0], setBusy = sb[1];
  var sc = useState(''), error = sc[0], setError = sc[1];
  var sd = useState([]), reps = sd[0], setReps = sd[1];
  var se = useState(false), rosterReady = se[0], setRosterReady = se[1];
  // The rep typed their own commission figure, so stop recomputing it under them.
  var sf = useState(false), amountTouched = sf[0], setAmountTouched = sf[1];

  // Shown as a percentage, because that is how a split is talked about on the
  // floor. The server reads anything above 1 as a percentage for the same reason.
  var ratePct = defaultRate ? String(Math.round(defaultRate * 10000) / 100) : '';

  useEffect(function() {
    if (!open || !canFileForOthers || rosterReady) return;
    apiFetch(withWorkspace('/api/roster', workspaceId))
      .then(function(r) { return r.json(); })
      .then(function(d) {
        setReps((d && d.reps) || []);
        setRosterReady(true);
      })
      .catch(function() { setRosterReady(true); });
  }, [open, canFileForOthers, rosterReady, workspaceId]);

  // Fill the commission in as the cash is typed, until the rep overrides it.
  useEffect(function() {
    if (amountTouched) return;
    var r = parseFloat(String(rate || ratePct).replace(/[%\s]/g, ''));
    if (!isFinite(r) || r <= 0) { setAmount(''); return; }
    if (r > 1) r = r / 100;
    var c = money(cash);
    setAmount(c > 0 ? String(Math.round(c * r * 100) / 100) : '');
  }, [cash, rate, ratePct, amountTouched]);

  function reset() {
    setLeadName(''); setProgram(''); setCash(''); setRate('');
    setAmount(''); setAmountTouched(false);
    setDay(todayInReportTimezone()); setProcessor(''); setNotes(''); setCloser('');
    setError('');
  }

  function submit(e) {
    e.preventDefault();
    setError('');
    if (!leadName.trim()) { setError('Who was the sale to?'); return; }
    if (money(cash) <= 0) { setError('How much was collected?'); return; }

    setBusy(true);
    apiFetch(withWorkspace('/api/commissions/log', workspaceId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leadName: leadName,
        program: program,
        cashCollected: money(cash),
        commissionRate: rate || ratePct,
        commissionAmount: money(amount),
        day: day,
        paymentProcessor: processor,
        notes: notes,
        // Only honoured for somebody who runs the workspace. A rep's own name is
        // decided server-side whatever this field holds.
        closer: canFileForOthers ? closer : '',
      }),
    })
      .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, d: d }; }); })
      .then(function(res) {
        setBusy(false);
        if (!res.ok || res.d.error) { setError(res.d.error || 'That did not save'); return; }
        reset();
        setOpen(false);
        if (onLogged) onLogged();
      })
      .catch(function() { setBusy(false); setError('That did not save — try again'); });
  }

  if (!open) {
    return (
      <div className="cm-log-cta">
        <div>
          <p className="cm-log-cta-t">Sold something the CRM never saw?</p>
          <p className="cl-hint">
            A renewal, an upsell, a deal closed off a call nobody filed — log it here and
            it joins the ledger above. It is kept apart from your closed deals, and a row
            that looks like one you already filed gets flagged, so nothing is counted twice
            without you seeing it.
          </p>
        </div>
        <button type="button" className="btn-primary cm-log-open"
          onClick={function() { setOpen(true); }}>
          <Plus className="w-4 h-4" /> Log a sale
        </button>
      </div>
    );
  }

  return (
    <div className="glass-card no-lift overflow-hidden">
      <div className="section-header">
        <h3>Log a sale</h3>
        <button type="button" className="cm-log-close" aria-label="Close"
          onClick={function() { setOpen(false); setError(''); }}>
          <X className="w-4 h-4" />
        </button>
      </div>
      <form onSubmit={submit} className="p-6 space-y-5">
        {canFileForOthers ? (
          <div>
            <label htmlFor="cm-closer" className="form-label">Whose commission is this?</label>
            <RepPicker id="cm-closer" value={closer} onChange={setCloser} reps={reps}
              ready={rosterReady} placeholder={myName || 'Pick the rep'} allowOther />
            <p className="cl-hint mt-1">
              Leave it alone and it lands on your own ledger.
            </p>
          </div>
        ) : null}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="cm-lead" className="form-label form-label-required">Who was the sale to?</label>
            <input id="cm-lead" type="text" value={leadName} required
              onChange={function(e) { setLeadName(e.target.value); }}
              className="input-field" placeholder="John Smith" />
          </div>
          <div>
            <label htmlFor="cm-program" className="form-label">Program / service</label>
            <select id="cm-program" value={program} className="input-field"
              onChange={function(e) { setProgram(e.target.value); }}>
              <option value="">Not sure / other</option>
              {PROGRAMS.map(function(x) { return <option key={x} value={x}>{x}</option>; })}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="cm-cash" className="form-label form-label-required">Cash collected</label>
            <input id="cm-cash" type="text" inputMode="decimal" value={cash} required
              onChange={function(e) { setCash(e.target.value); }}
              className="input-field" placeholder="3000" />
          </div>
          <div>
            <label htmlFor="cm-rate" className="form-label">Your split</label>
            <input id="cm-rate" type="text" inputMode="decimal" value={rate}
              onChange={function(e) { setRate(e.target.value); }}
              className="input-field" placeholder={ratePct ? ratePct + '%' : '10%'} />
          </div>
          <div>
            <label htmlFor="cm-amount" className="form-label">Commission</label>
            <input id="cm-amount" type="text" inputMode="decimal" value={amount}
              onChange={function(e) { setAmountTouched(true); setAmount(e.target.value); }}
              className="input-field" placeholder="300" />
            <p className="cl-hint mt-1">
              {amountTouched ? 'Yours — the split above is ignored.' : 'Filled in from your split. Change it if the deal was different.'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="cm-day" className="form-label form-label-required">Day of the sale</label>
            <input id="cm-day" type="date" value={day} required
              onChange={function(e) { setDay(e.target.value); }} className="input-field" />
          </div>
          <div>
            <label htmlFor="cm-proc" className="form-label">Paid through</label>
            <select id="cm-proc" value={processor} className="input-field"
              onChange={function(e) { setProcessor(e.target.value); }}>
              <option value="">—</option>
              {PAYMENT_PLATFORMS.map(function(x) { return <option key={x} value={x}>{x}</option>; })}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="cm-notes" className="form-label">Notes</label>
          <textarea id="cm-notes" value={notes} rows={2} className="input-field"
            onChange={function(e) { setNotes(e.target.value); }}
            placeholder="Anything whoever runs the commission needs to know." />
        </div>

        {error ? <p className="cm-log-err">{error}</p> : null}

        <div className="flex items-center gap-3">
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Log it'}
          </button>
          <button type="button" className="an-chip"
            onClick={function() { reset(); setOpen(false); }}>Cancel</button>
          <p className="cl-hint" style={{ flex: 1 }}>
            It lands as <strong>pending</strong>. Whoever runs the commission approves and
            marks it paid.
          </p>
        </div>
      </form>
    </div>
  );
}
