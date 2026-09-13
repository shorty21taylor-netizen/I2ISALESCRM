'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Check, Lock, ChevronRight, PlayCircle, KeyRound, Eye, Copy, ShieldCheck,
  Building2, ExternalLink, PenLine,
} from 'lucide-react';
import { apiFetch } from '@/lib/workspace-client';
import { getUser } from '@/lib/auth';
import { stepDone } from '@/lib/onboarding-plan';

// The gate between a new rep and the rest of the floor.
//
// Everything here is one click deep: the checkpoint opens where it sits, the
// Loom plays in place, the login opens in place. Sending someone to a folder of
// links is how onboarding quietly does not happen.

var KIND_LABEL = {
  owner: 'The company does this',
  access: 'Confirm you can log in',
  task: 'Read it, then tick it',
  demo: 'Do it back live',
  attest: 'Sign it',
};

// Loom share links need /embed/ to play inline; anything else is left as a link.
function loomEmbed(url) {
  var m = /^https:\/\/(?:www\.)?loom\.com\/share\/([a-zA-Z0-9]+)/.exec(url || '');
  return m ? 'https://www.loom.com/embed/' + m[1] : '';
}

function Secret({ slot, login, onReveal }) {
  var [shown, setShown] = useState('');
  var [busy, setBusy] = useState(false);
  var [err, setErr] = useState('');
  var [copied, setCopied] = useState(false);

  if (!login) return null;

  function reveal() {
    setBusy(true); setErr('');
    onReveal(slot)
      .then(function(v) { setShown(v); })
      .catch(function(e) { setErr(e.message || 'Could not open that'); })
      .then(function() { setBusy(false); });
  }

  return (
    <div className="ob-login">
      <div className="ob-login-head">
        <KeyRound size={13} />
        <b>{login.label || slot}</b>
        {login.url ? (
          <a className="ob-login-open" href={login.url} target="_blank" rel="noreferrer">
            Open <ExternalLink size={11} />
          </a>
        ) : null}
      </div>

      {login.username ? (
        <p className="ob-login-row"><span>Username</span><code>{login.username}</code></p>
      ) : null}

      {login.hasSecret ? (
        <p className="ob-login-row">
          <span>Password</span>
          {shown
            ? (
              <span className="ob-secret">
                <code>{shown}</code>
                <button className="an-chip" onClick={function() {
                  if (navigator.clipboard) navigator.clipboard.writeText(shown);
                  setCopied(true);
                  setTimeout(function() { setCopied(false); }, 1600);
                }}>
                  <Copy size={11} /> {copied ? 'Copied' : 'Copy'}
                </button>
              </span>
            )
            : <button className="an-chip" disabled={busy} onClick={reveal}><Eye size={11} /> {busy ? 'Opening…' : 'Reveal'}</button>}
        </p>
      ) : null}

      {login.owner ? <p className="ob-login-row"><span>Ask</span><code>{login.owner}</code></p> : null}
      {login.note ? <p className="ob-login-note">{login.note}</p> : null}
      {err ? <p className="ob-err">{err}</p> : null}
    </div>
  );
}

function Step({ step, record, loom, login, canVerify, viewingSomeoneElse, onAct, onReveal }) {
  var [open, setOpen] = useState(false);
  var [sig, setSig] = useState('');
  var done = stepDone(step, record);
  var embed = loomEmbed(loom);
  var isOwnerStep = step.kind === 'owner';
  var readyForDemo = step.kind === 'demo' && record && record.doneAt && !record.verifiedAt;

  return (
    <div className={'ob-step' + (done ? ' done' : '') + (open ? ' open' : '')}>
      <button className="ob-step-head" onClick={function() { setOpen(!open); }}>
        <span className={'ob-tick' + (done ? ' on' : '') + (isOwnerStep ? ' company' : '')}>
          {done ? <Check size={13} /> : isOwnerStep ? <Building2 size={11} /> : null}
        </span>
        <span className="ob-step-t">
          {step.title}
          {readyForDemo ? <i className="ob-flag">waiting on a manager</i> : null}
          {isOwnerStep && !done ? <i className="ob-flag">not done yet</i> : null}
        </span>
        <ChevronRight size={14} className="ob-step-chev" />
      </button>

      {open ? (
        <div className="ob-step-body">
          <p className="ob-kind">{KIND_LABEL[step.kind]}</p>
          {step.detail ? <p className="ob-detail">{step.detail}</p> : null}
          {step.demo ? <p className="ob-demo"><b>Show it:</b> {step.demo}</p> : null}

          {embed ? (
            <div className="ob-loom"><iframe src={embed} allowFullScreen title={step.title} /></div>
          ) : loom ? (
            <a className="an-chip" href={loom} target="_blank" rel="noreferrer">
              <PlayCircle size={12} /> Watch the walkthrough
            </a>
          ) : null}

          {login ? <Secret slot={step.slot} login={login} onReveal={onReveal} /> : null}

          <div className="ob-actions">
            {step.kind === 'attest' ? (
              record && record.signedAt ? (
                <p className="ob-signed">
                  <ShieldCheck size={13} /> Signed by {record.signature} on{' '}
                  {new Date(record.signedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              ) : (
                <div className="ob-sign">
                  <p className="ob-statement">&ldquo;{step.statement}&rdquo;</p>
                  <div className="ob-sign-row">
                    <input value={sig} placeholder="Type your full name to sign"
                      onChange={function(e) { setSig(e.target.value); }} />
                    <button className="an-btn" disabled={sig.trim().length < 2 || viewingSomeoneElse}
                      onClick={function() { onAct(step, { action: 'sign', signature: sig.trim() }); }}>
                      <PenLine size={12} /> Sign
                    </button>
                  </div>
                  {viewingSomeoneElse ? <p className="ob-err">Only they can sign this.</p> : null}
                </div>
              )
            ) : isOwnerStep ? (
              canVerify ? (
                <button className={'an-btn' + (done ? '-ghost' : '')}
                  onClick={function() { onAct(step, { action: done ? 'unown' : 'own' }); }}>
                  {done ? 'Mark not done' : 'Mark done for them'}
                </button>
              ) : (
                <p className="ob-muted">Your onboarding owner ticks this one.</p>
              )
            ) : (
              <>
                <button className={'an-btn' + (record && record.doneAt ? '-ghost' : '')}
                  disabled={viewingSomeoneElse}
                  onClick={function() { onAct(step, { done: !(record && record.doneAt) }); }}>
                  {record && record.doneAt
                    ? (step.kind === 'demo' ? 'Ready — undo' : 'Done — undo')
                    : (step.kind === 'demo' ? "I'm ready to show this" : 'Mark done')}
                </button>
                {step.kind === 'demo' && canVerify ? (
                  <button className={'an-btn' + (record && record.verifiedAt ? '-ghost' : '')}
                    onClick={function() { onAct(step, { action: record && record.verifiedAt ? 'unverify' : 'verify' }); }}>
                    {record && record.verifiedAt ? 'Withdraw confirmation' : 'I watched them do it'}
                  </button>
                ) : null}
                {step.kind === 'demo' && !canVerify && !(record && record.verifiedAt) ? (
                  <p className="ob-muted">A manager confirms this one once they have seen it.</p>
                ) : null}
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function OnboardingPage() {
  var router = useRouter();
  var params = useSearchParams();
  var viewingRep = params.get('rep') || '';
  var [data, setData] = useState(null);
  var [error, setError] = useState('');

  var load = useCallback(function() {
    apiFetch('/api/onboarding' + (viewingRep ? '?rep=' + encodeURIComponent(viewingRep) : ''))
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (!d.success) { setError(d.error || 'Could not load onboarding'); return; }
        setData(d); setError('');
      })
      .catch(function() { setError('Could not reach the server'); });
  }, [viewingRep]);

  useEffect(function() { load(); }, [load]);

  function act(step, payload) {
    apiFetch('/api/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ step: step.id }, payload, viewingRep ? { rep: viewingRep } : {})),
    })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (!d.success) { setError(d.error || 'Could not save'); return; }
        setError('');
        setData(function(prev) { return Object.assign({}, prev, { steps: d.steps, progress: d.progress }); });
      })
      .catch(function() { setError('Could not reach the server'); });
  }

  function reveal(slot) {
    return apiFetch('/api/onboarding/resources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reveal', slot: slot }),
    })
      .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, d: d }; }); })
      .then(function(res) {
        if (!res.ok || !res.d.success) throw new Error(res.d.error || 'Could not open that');
        return res.d.secret;
      });
  }

  if (error && !data) return <div className="px-4 md:px-8 py-6 text-sm" style={{ color: '#ef4444' }}>{error}</div>;
  if (!data) return <div className="px-4 md:px-8 py-6 text-sm font-mono" style={{ color: 'var(--crm-muted)' }}>Loading…</div>;

  var p = data.progress;

  return (
    <div className="min-h-screen">
      <header className="page-header py-4 md:py-6">
        <h1 className="text-xl md:text-2xl font-display font-bold" style={{ color: 'var(--crm-text-bright)' }}>
          {data.viewingSomeoneElse ? data.rep.name + '’s onboarding' : 'Your onboarding'}
        </h1>
        <p className="text-xs font-mono" style={{ color: 'var(--crm-muted)' }}>
          {p.complete
            ? 'Finished — the floor is fully open to you'
            : 'Finish this and the rest of Summit OS opens up'}
        </p>
      </header>

      <div className="px-4 md:px-8 pb-10">
        <div className="ob-bar-card glass-card mb-4">
          <div className="ob-bar-top">
            <p className="ob-bar-n">{p.done} <span>of {p.total} done</span></p>
            <p className={'ob-bar-pct' + (p.complete ? ' done' : '')}>{p.percent}%</p>
          </div>
          <div className="ob-bar"><i style={{ width: p.percent + '%' }} /></div>
          {!p.complete ? (
            <p className="ob-bar-s">
              The team leaderboard unlocks when this hits 100%. Your dashboard and the submit
              forms are open the whole time — nothing here stops you working.
            </p>
          ) : (
            <p className="ob-bar-s done"><ShieldCheck size={13} /> Everything is unlocked.</p>
          )}
          {error ? <p className="ob-err">{error}</p> : null}
        </div>

        {data.phases.map(function(phase) {
          var steps = phase.steps;
          var doneCount = steps.filter(function(s) { return stepDone(s, data.steps[s.id]); }).length;
          return (
            <div key={phase.id} className="an-card mb-4">
              <div className="an-card-h">
                <h3 className="an-card-t">{phase.title}</h3>
                <span className="section-tag">{phase.when}</span>
                <span className="ob-count">{doneCount}/{steps.length}</span>
              </div>
              <div className="p-4">
                {phase.blurb ? <p className="ob-blurb">{phase.blurb}</p> : null}
                <div className="ob-steps">
                  {steps.map(function(step) {
                    return (
                      <Step
                        key={step.id}
                        step={step}
                        record={data.steps[step.id]}
                        loom={data.looms[step.id]}
                        login={step.slot ? data.logins[step.slot] : null}
                        canVerify={data.canVerify}
                        viewingSomeoneElse={data.viewingSomeoneElse}
                        onAct={act}
                        onReveal={reveal}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
