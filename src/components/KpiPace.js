'use client';

import { formatCurrency } from '@/lib/utils';

// The KPI scorecard: what this rep was asked for this month, and exactly what it
// takes to hit it today.
//
// Every figure comes off computeKpiProgress — nothing is recomputed here — so a
// manager opening a rep's card and the rep opening their own read the same
// numbers off the same call. That is the whole reason this is one component
// rather than two: the pair that disagree are the pair nobody trusts.
//
// The pace notch marks where the month is, so "behind" is something you can SEE
// against the bar rather than something the card asserts. A rate is never paced —
// half a month gone does not mean half a close rate — so it is compared flat.

function fmt(kpi, v) {
  if (v === null || v === undefined) return '—';
  if (kpi.kind === 'money') return formatCurrency(v);
  if (kpi.kind === 'rate') return v + '%';
  return Number(v).toLocaleString('en-US');
}

export default function KpiPace({ kpis, title, voice, name, canSetTargets, onSetTargets, className }) {
  if (!kpis || !kpis.kpis || !kpis.kpis.length) return null;

  // Whose card this is changes every sentence on it. A manager reading "you are
  // at 40%" on somebody else's card is the kind of small wrongness that makes a
  // screen feel untrustworthy.
  var other = voice === 'other';
  var they = other ? 'they are' : 'you are';
  var finish = other ? 'they finish' : 'you finish';
  var heading = title || (other
    ? (name ? name + '’s targets this month' : 'Their targets this month')
    : 'Your targets this month');

  var rows = kpis.kpis;
  var paced = rows.filter(function(r) { return r.target !== null; });
  var onPace = paced.filter(function(r) { return r.onTrack === true; }).length;

  return (
    <div className={'glass-card no-lift mek ' + (className || 'mb-4')}>
      <div className="mek-h">
        <h3 className="mek-h-t">{heading}</h3>
        <span className="mek-h-rule" />
        <span className="mek-h-n">
          {paced.length > 0
            ? onPace + ' of ' + paced.length + ' on pace · ' + kpis.weekdaysLeft
              + ' working ' + (kpis.weekdaysLeft === 1 ? 'day' : 'days') + ' left'
            : kpis.weekdaysLeft + ' working ' + (kpis.weekdaysLeft === 1 ? 'day' : 'days') + ' left'}
        </span>
      </div>

      {paced.length === 0 ? (
        <p className="mek-empty">
          No targets set yet.{' '}
          {canSetTargets
            ? <>Set them and this card paces {other ? (name || 'them') : 'you'} against them every day.</>
            : other
              ? <>Nobody has set targets for {name || 'this rep'} yet.</>
              : <>Your manager sets these, and this page will then show exactly what it takes to hit them.</>}
          {canSetTargets && onSetTargets ? (
            <><br /><button className="an-chip mt-3" onClick={onSetTargets}>Set targets</button></>
          ) : null}
        </p>
      ) : (
        <div className="mek-rows">
          {rows.map(function(r) {
            var has = r.target !== null;
            var tone = !has ? 'none' : (r.onTrack === false ? 'behind' : 'good');
            var pct = (r.percent === null) ? 0 : Math.max(0, Math.min(100, r.percent));
            var pacePct = (kpis.weekdaysTotal > 0 && r.kind !== 'rate')
              ? Math.min(100, Math.round((kpis.weekdaysElapsed / kpis.weekdaysTotal) * 100))
              : null;
            return (
              <div className="mek-row" key={r.key}>
                <div className="mek-row-top">
                  <span className="mek-l">{r.label}</span>
                  <span className="mek-v">
                    {fmt(r, r.actual)}
                    {has ? <span className="of"> of {fmt(r, r.target)}</span> : null}
                  </span>
                </div>

                <div className="mek-bar">
                  <span className={'mek-fill ' + tone} style={{ width: pct + '%' }} />
                  {has && pacePct !== null ? (
                    <span className="mek-pace" style={{ left: pacePct + '%' }} />
                  ) : null}
                </div>

                <div className="mek-math">
                  {!has ? (
                    <span className="mek-chip none">No target set</span>
                  ) : r.kind === 'rate' ? (
                    <>
                      <span className={'mek-chip ' + tone}>
                        {r.onTrack ? 'At target' : 'Under target'}
                      </span>{' '}
                      {r.actual === null
                        ? <>nothing to measure it over yet</>
                        : <>{they} at <b>{r.actual}%</b> against a <b>{r.target}%</b> target</>}
                    </>
                  ) : r.remaining === 0 ? (
                    <><span className="mek-chip good">Hit</span> target met with {' '}
                      <b>{kpis.weekdaysLeft}</b> {kpis.weekdaysLeft === 1 ? 'day' : 'days'} to spare</>
                  ) : (
                    <>
                      <span className={'mek-chip ' + tone}>
                        {r.onTrack ? 'On pace' : 'Behind'}
                      </span>{' '}
                      <b>{fmt(r, r.remaining)}</b> to go
                      {r.expectedByNow !== null
                        ? <> · should be at <b>{fmt(r, r.expectedByNow)}</b> by today</>
                        : null}
                      {r.neededPerDay !== null
                        ? <> · <b>{fmt(r, r.neededPerDay)}</b> a day for the last <b>{kpis.weekdaysLeft}</b></>
                        : null}
                      {r.projected !== null
                        ? <> · on this pace {finish} at <b>{fmt(r, r.projected)}</b></>
                        : null}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
