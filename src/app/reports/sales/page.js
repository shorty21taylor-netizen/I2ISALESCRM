'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useWorkspace, withWorkspace, apiFetch } from '@/lib/workspace-client';
import { isLoggedIn } from '@/lib/auth';
import { GROUP_LABELS } from '@/lib/rep-groups';

// The printed Summit Closing Group report. It lives outside the dashboard shell
// so the paper is the whole page: what you see here is what lands in the PDF.

function money(v) {
  return '$' + Math.round(v || 0).toLocaleString('en-US');
}
function num(v) {
  return (Math.round((v || 0) * 10) / 10).toLocaleString('en-US');
}
// A rate that could not be measured prints as an em dash, never as 0%.
function pct(v) {
  return v === null || v === undefined ? '—' : v + '%';
}
function pretty(day) {
  if (!day) return '';
  var d = new Date(day + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}
function shortDay(day) {
  if (!day) return '';
  var d = new Date(day + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function Stat({ label, value, sub }) {
  return (
    <div className="rpt-stat">
      <p className="rpt-stat-l">{label}</p>
      <p className="rpt-stat-v">{value}</p>
      {sub ? <p className="rpt-stat-s">{sub}</p> : null}
    </div>
  );
}

function Section({ title, note, children, breakBefore }) {
  return (
    <section className={'rpt-section' + (breakBefore ? ' rpt-break' : '')}>
      <div className="rpt-sec-head">
        <h2 className="rpt-h2">{title}</h2>
        {note ? <span className="rpt-sec-note">{note}</span> : null}
      </div>
      {children}
    </section>
  );
}

function Row({ label, value, sub }) {
  return (
    <div className="rpt-row">
      <span className="rpt-row-l">{label}{sub ? <em className="rpt-row-s"> {sub}</em> : null}</span>
      <span className="rpt-row-v">{value}</span>
    </div>
  );
}

var GROUP_COLUMNS = {
  closers: [
    { k: 'daysReported', h: 'Days', f: num },
    { k: 'onCalendar', h: 'On cal.', f: num },
    { k: 'taken', h: 'Showed', f: num },
    { k: 'noShowed', h: 'No-show', f: num },
    { k: 'pitched', h: 'Offers', f: num },
    { k: 'offeredNoClose', h: 'No close', f: num },
    { k: 'closes', h: 'Closes', f: num },
    { k: 'showRate', h: 'Show %', f: pct },
    { k: 'closeRate', h: 'Close %', f: pct },
    { k: 'cash', h: 'Cash', f: money },
  ],
  setters: [
    { k: 'daysReported', h: 'Days', f: num },
    { k: 'dials', h: 'Dials', f: num },
    { k: 'conversations', h: 'Convos', f: num },
    { k: 'sets', h: 'Sets', f: num },
    { k: 'dialToSet', h: 'Dial→set %', f: pct },
    { k: 'avgDialsPerDay', h: 'Dials/day', f: num },
    { k: 'followUps', h: 'Follow-ups', f: num },
    { k: 'setCredits', h: 'Closed sets', f: num },
  ],
  dmSetters: [
    { k: 'daysReported', h: 'Days', f: num },
    { k: 'conversations', h: 'Convos', f: num },
    { k: 'sets', h: 'Sets', f: num },
    { k: 'followUps', h: 'Follow-ups', f: num },
    { k: 'setCredits', h: 'Closed sets', f: num },
  ],
};

function GroupTable({ group, rows }) {
  var cols = GROUP_COLUMNS[group] || GROUP_COLUMNS.closers;
  if (!rows || !rows.length) {
    return <p className="rpt-empty">No {GROUP_LABELS[group].toLowerCase()} filed a report in this range.</p>;
  }
  return (
    <div className="rpt-tablewrap">
      <table className="rpt-table">
        <thead>
          <tr>
            <th className="rpt-th-name">{GROUP_LABELS[group].replace(/s$/, '')}</th>
            {cols.map(function(c) { return <th key={c.k} className="rpt-th-n">{c.h}</th>; })}
          </tr>
        </thead>
        <tbody>
          {rows.map(function(r) {
            return (
              <tr key={r.name}>
                <td className="rpt-td-name">{r.name}</td>
                {cols.map(function(c) {
                  return <td key={c.k} className="rpt-td-n">{c.f(r[c.k])}</td>;
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ReportBody() {
  var params = useSearchParams();
  var router = useRouter();
  var workspaceId = useWorkspace();
  var [report, setReport] = useState(null);
  var [error, setError] = useState('');
  var [loading, setLoading] = useState(true);

  var start = params.get('start') || '';
  var end = params.get('end') || '';

  useEffect(function() { if (!isLoggedIn()) router.replace('/login'); }, [router]);

  useEffect(function() {
    if (!workspaceId) return;
    var cancelled = false;
    setLoading(true);
    setError('');
    var q = '/api/reports/sales?start=' + encodeURIComponent(start) + '&end=' + encodeURIComponent(end);
    apiFetch(withWorkspace(q, workspaceId))
      .then(function(res) { return res.json(); })
      .then(function(json) {
        if (cancelled) return;
        if (!json.success) { setError(json.error || 'Could not build the report'); }
        else { setReport(json); }
        setLoading(false);
      })
      .catch(function() {
        if (cancelled) return;
        setError('Could not reach the server');
        setLoading(false);
      });
    return function() { cancelled = true; };
  }, [start, end, workspaceId]);

  if (loading) return <div className="rpt-state">Building the report…</div>;
  if (error) return <div className="rpt-state rpt-state-bad">{error}</div>;
  if (!report) return null;

  var m = report.metrics;
  var v = m.volume;
  var r = m.rates;
  var c = m.cash;

  return (
    <div className="rpt-shell">
      <div className="rpt-bar">
        <button className="rpt-btn-ghost" onClick={function() { router.push('/analytics'); }}>← Back to analytics</button>
        <div className="rpt-bar-r">
          {report.summary && report.summary.source === 'computed'
            ? <span className="rpt-bar-note">Summary written by the CRM</span>
            : <span className="rpt-bar-note">Summary written by Claude</span>}
          <button className="rpt-btn" onClick={function() { window.print(); }}>Save as PDF</button>
        </div>
      </div>

      <article className="rpt-paper">
        <header className="rpt-head">
          <div className="rpt-brand">
            <div className="rpt-mark" aria-hidden="true">
              <svg viewBox="0 0 120 120" width="30" height="30">
                <path d="M6 100 L36 56 L64 100 Z" fill="#9aa3b2" />
                <path d="M14 100 L60 26 L106 100 Z" fill="#111827" />
                <path d="M66 40 L48 76 H60 L54 100 L78 64 H64 Z" fill="#ffffff" />
              </svg>
            </div>
            <div>
              <p className="rpt-brand-n">{report.brand.name}</p>
              <p className="rpt-brand-t">{report.brand.tagline}</p>
            </div>
          </div>
          <div className="rpt-head-r">
            <p className="rpt-range">{pretty(m.range.start)} — {pretty(m.range.end)}</p>
            <p className="rpt-gen">
              Generated {new Date(report.generatedAt).toLocaleString('en-US')} ·
              {' '}{m.range.daysReported} reporting {m.range.daysReported === 1 ? 'day' : 'days'} ·
              {' '}{m.range.repsReporting} {m.range.repsReporting === 1 ? 'rep' : 'reps'}
            </p>
          </div>
        </header>

        <Section title="Headline">
          <div className="rpt-stats">
            <Stat label="Cash collected" value={money(c.collected)} sub={c.dealCount + ' deals'} />
            <Stat label="Average deal" value={money(c.avgDeal)} sub={'per closed deal'} />
            <Stat label="Closes" value={num(v.closes)} sub={num(v.pitched) + ' offers made'} />
            <Stat label="Close rate" value={pct(r.closeRateOfOffers)} sub="of offers made" />
            <Stat label="Show rate" value={pct(r.showRate)} sub={num(v.noShowed) + ' no-shows'} />
            <Stat label="Cash per offer" value={money(c.perOffer)} sub="every pitch is worth" />
          </div>
        </Section>

        <Section title="The funnel" note="Each stage as a share of the one above it">
          <div className="rpt-tablewrap">
            <table className="rpt-table">
              <thead>
                <tr><th className="rpt-th-name">Stage</th><th className="rpt-th-n">Count</th><th className="rpt-th-n">Conversion</th><th className="rpt-th-bar" aria-label="Conversion bar" /></tr>
              </thead>
              <tbody>
                {m.funnel.map(function(f) {
                  var conv = f.of ? Math.round((f.value / f.of) * 1000) / 10 : null;
                  var share = conv === null ? 100 : Math.max(1, Math.min(100, conv));
                  return (
                    <tr key={f.stage}>
                      <td className="rpt-td-name">{f.stage}</td>
                      <td className="rpt-td-n">{num(f.value)}</td>
                      <td className="rpt-td-n">{conv === null ? '—' : conv + '%'}</td>
                      <td className="rpt-td-bar">
                        <span className="rpt-meter"><i style={{ width: share + '%' }} /></span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>

        <div className="rpt-cols">
          <Section title="Call outcomes">
            <Row label="Calls booked" value={num(v.sets)} />
            <Row label="On the calendar" value={num(v.onCalendar)} />
            <Row label="Showed" value={num(v.taken)} sub={'· ' + pct(r.showRate)} />
            <Row label="No-showed" value={num(v.noShowed)} sub={'· ' + pct(r.noShowRate)} />
            <Row label="Cancelled" value={num(v.canceled)} sub={'· ' + pct(r.cancelRate)} />
            <Row label="Rescheduled" value={num(v.rescheduled)} sub={'· ' + pct(r.rescheduleRate)} />
            <Row label="Showed, no offer made" value={num(v.showedNotPitched)} />
            <Row label="Offers made" value={num(v.pitched)} sub={'· ' + pct(r.pitchRate) + ' of shows'} />
            <Row label="Offered, did not close" value={num(v.offeredNoClose)} sub={'· ' + pct(r.offerDeclineRate)} />
            <Row label="Closed" value={num(v.closes)} sub={'· ' + pct(r.closeRateOfOffers) + ' of offers'} />
          </Section>

          <Section title="Prospecting">
            <Row label="Outbound dials" value={num(v.dials)} />
            <Row label="Conversations" value={num(v.conversations)} sub={'· ' + pct(r.dialToConversation) + ' of dials'} />
            <Row label="Live calls" value={num(v.liveCalls)} />
            <Row label="Calls booked" value={num(v.sets)} sub={'· ' + pct(r.conversationToSet) + ' of conversations'} />
            <Row label="Dial → booked call" value={pct(r.dialToSet)} />
            <Row label="Dial → close" value={pct(r.dialToClose)} />
            <Row label="Follow-ups scheduled" value={num(v.followUps)} />
            <Row label="Close rate of shows" value={pct(r.closeRateOfShows)} />
            <Row label="Close rate of calendar" value={pct(r.closeRateOfCalendar)} />
          </Section>
        </div>

        <div className="rpt-cols">
          <Section title="What each stage is worth">
            <Row label="Cash collected" value={money(c.collected)} />
            <Row label="Per closed deal" value={money(c.avgDeal)} />
            <Row label="Per offer made" value={money(c.perOffer)} />
            <Row label="Per call held" value={money(c.perShow)} />
            <Row label="Per booked call" value={money(c.perBookedCall)} />
            <Row label="Per dial" value={'$' + c.perDial.toFixed(2)} />
            <Row label="Per reporting day" value={money(c.perDay)} />
            {c.duplicatesRemoved > 0
              ? <Row label="Duplicate deals merged" value={c.duplicatesRemoved + ' · ' + money(c.duplicateCash)} />
              : null}
          </Section>

          <Section title="Where the revenue came from">
            <Row label="Inbound" value={money(m.source.inboundCash)} sub={'· ' + m.source.inboundDeals + ' deals'} />
            <Row label="Outbound" value={money(m.source.outboundCash)} sub={'· ' + m.source.outboundDeals + ' deals'} />
            {m.programs.length
              ? m.programs.map(function(p) {
                  return <Row key={p.name} label={p.name} value={money(p.cash)} sub={'· ' + p.deals + ' @ ' + money(p.avg)} />;
                })
              : <p className="rpt-empty">No program was recorded on the deals in this range.</p>}
          </Section>
        </div>

        <Section title="Reporting activity" note="What the team filed, not what they sold">
          <div className="rpt-cols">
            <div>
              <Row label="EOD reports filed" value={num(m.reporting.eodsFiled)} />
              <Row label="Deal forms filed" value={num(m.reporting.dealsFiled)} />
              <Row label="Deals after dedupe" value={num(m.reporting.dealsAfterDedupe)} />
              <Row label="Booked-call forms" value={num(m.reporting.bookedForms.filed)} />
              <Row label="Qualified on booking" value={num(m.reporting.bookedForms.qualified)} sub={'· ' + pct(m.reporting.bookedForms.qualifiedRate)} />
            </div>
            <div>
              <Row label="After-call reports filed" value={num(m.reporting.afterCallsFiled)} />
              {m.reporting.afterCallOutcomes.length
                ? m.reporting.afterCallOutcomes.map(function(o) {
                    return <Row key={o.outcome} label={o.outcome} value={num(o.count)} sub={'· ' + pct(o.share)} />;
                  })
                : <p className="rpt-empty">No after-call reports were filed in this range.</p>}
            </div>
          </div>
        </Section>

        <Section title="Closers" breakBefore>
          <GroupTable group="closers" rows={m.groups.closers} />
        </Section>

        <Section title="Setters">
          <GroupTable group="setters" rows={m.groups.setters} />
        </Section>

        <Section title="DM setters">
          <GroupTable group="dmSetters" rows={m.groups.dmSetters} />
        </Section>

        <Section title="Day by day" breakBefore>
          <div className="rpt-tablewrap">
            <table className="rpt-table">
              <thead>
                <tr>
                  <th className="rpt-th-name">Day</th>
                  <th className="rpt-th-n">Dials</th>
                  <th className="rpt-th-n">Convos</th>
                  <th className="rpt-th-n">Sets</th>
                  <th className="rpt-th-n">Showed</th>
                  <th className="rpt-th-n">No-show</th>
                  <th className="rpt-th-n">Offers</th>
                  <th className="rpt-th-n">Closes</th>
                  <th className="rpt-th-n">Cash</th>
                </tr>
              </thead>
              <tbody>
                {m.daily.length
                  ? m.daily.map(function(d) {
                      return (
                        <tr key={d.date}>
                          <td className="rpt-td-name">{shortDay(d.date)}</td>
                          <td className="rpt-td-n">{num(d.dials)}</td>
                          <td className="rpt-td-n">{num(d.conversations)}</td>
                          <td className="rpt-td-n">{num(d.sets)}</td>
                          <td className="rpt-td-n">{num(d.taken)}</td>
                          <td className="rpt-td-n">{num(d.noShowed)}</td>
                          <td className="rpt-td-n">{num(d.pitched)}</td>
                          <td className="rpt-td-n">{num(d.closes)}</td>
                          <td className="rpt-td-n">{money(d.cash)}</td>
                        </tr>
                      );
                    })
                  : <tr><td className="rpt-td-name" colSpan={9}>Nothing was filed in this range.</td></tr>}
              </tbody>
            </table>
          </div>
        </Section>

        {report.summary && report.summary.text
          ? (
            <Section title="Summary" note={report.summary.source === 'claude' ? 'Written by Claude from the figures above' : 'Written by the CRM from the figures above'}>
              <div className="rpt-summary">
                {report.summary.text.split(/\n{2,}/).map(function(p, i) {
                  return <p key={i}>{p}</p>;
                })}
              </div>
            </Section>
          )
          : null}

        <footer className="rpt-foot">
          <span>{report.brand.name} · {pretty(m.range.start)} — {pretty(m.range.end)}</span>
          <span>Cash figures are deduplicated across the Closed Deal form and EOD reports.</span>
        </footer>
      </article>
    </div>
  );
}

export default function SalesReportPage() {
  return (
    <Suspense fallback={<div className="rpt-state">Building the report…</div>}>
      <ReportBody />
    </Suspense>
  );
}
