'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Trophy, ArrowLeft, Check, Copy, Image as ImageIcon, Download, Loader2, TrendingUp, TrendingDown, Sparkles } from 'lucide-react';
import { toBlob } from 'html-to-image';
import { useWorkspace, withWorkspace, apiFetch } from '@/lib/workspace-client';
import { formatCurrency } from '@/lib/utils';
import { todayInReportTimezone, toReportDay } from '@/lib/report-date';

// The card a rep screenshots into the team chat. Deliberately one screen, no
// scrolling, and nothing on it that belongs to anyone else.

// The product's own brand, which every card carries alongside the client's.
var PLATFORM = 'Summit Closing Group';

function pct(v) { return v === null || v === undefined ? '—' : v + '%'; }

// One KPI: the number, the target, and a bar that is honest about pace.
//
// Green is "where you should be TODAY", not "you finished". Halfway through the
// month on half the target is on track, and colouring that amber because it is
// not 100% yet is how a board stops being read.
// The crest every card wears at the top: the mark, whose floor it came off, and
// which of the three cards this is. A workspace that uploaded its own logo gets
// that file here, the same rule the sidebar mark follows — only a workspace with
// none falls back to the Summit ridge.
function CardCrest({ brand, label }) {
  var logo = brand && brand.logoUrl;
  // The workspace's own name, then the platform's. A workspace that IS the
  // platform is named once rather than crossed with itself.
  var company = (brand && brand.name) || '';
  if (company.trim().toLowerCase() === PLATFORM.toLowerCase()) company = '';
  return (
    <div className="sc-crest">
      <span className="sc-crest-mark">
        {logo ? (
          <img src={logo} alt="" />
        ) : (
          <svg viewBox="0 0 384.3 285.7" fill="currentColor" aria-hidden="true">
            <path d="M0 285.7L191.8 0L384.3 285.7L275.5 285.7L240.5 238.7L226.5 256.7L184.5 199.7L124.5 285.7Z" />
          </svg>
        )}
      </span>
      <span className="sc-crest-name">
        {company ? <><b>{company}</b><i>&times;</i></> : null}
        <em>{PLATFORM}</em>
      </span>
      <span className="sc-crest-kind">{label}</span>
    </div>
  );
}

function KpiRow({ row }) {
  function shown(v) {
    if (v === null || v === undefined) return '—';
    if (row.kind === 'money') return formatCurrency(v);
    if (row.kind === 'rate') return v + '%';
    return Number(v).toLocaleString('en-US');
  }

  var width = row.percent === null ? 0 : Math.max(0, Math.min(100, row.percent));
  var tone = row.onTrack === null ? 'none' : (row.onTrack ? 'good' : 'behind');
  // Where the month says they should be, drawn as a notch on the bar.
  var pace = (row.target && row.expectedByNow !== null && row.target > 0)
    ? Math.max(0, Math.min(100, Math.round((row.expectedByNow / row.target) * 100)))
    : null;

  return (
    <div className="kpi-row">
      <div className="kpi-row-top">
        <span className="kpi-row-label">{row.label}</span>
        <span className="kpi-row-value">
          {shown(row.actual)}
          {row.target !== null ? <span className="kpi-row-target"> / {shown(row.target)}</span> : null}
        </span>
      </div>
      <div className="kpi-bar">
        <div className={'kpi-bar-fill ' + tone} style={{ width: width + '%' }} />
        {pace !== null && pace > 0 && pace < 100 ? (
          <div className="kpi-bar-pace" style={{ left: pace + '%' }} />
        ) : null}
      </div>
      <div className="kpi-row-foot">
        {row.target === null ? (
          <span>No target set</span>
        ) : row.percent !== null && row.percent >= 100 ? (
          <span className="kpi-hit">Hit</span>
        ) : row.kind === 'rate' ? (
          <span>{row.percent === null ? 'Nothing to measure yet' : row.percent + '% of target'}</span>
        ) : (
          <span>
            {row.percent === null ? '—' : row.percent + '%'}
            {row.neededPerDay ? ' · ' + shown(row.neededPerDay) + ' a day to finish' : ''}
          </span>
        )}
      </div>
    </div>
  );
}

function KpiCard({ data, initials }) {
  var p = data.profile;
  var k = data.kpis;
  if (!k) {
    return (
      <div className="kpi-card sc-card">
        <p className="kpi-empty">No KPIs to show yet — file an EOD and they appear here.</p>
      </div>
    );
  }
  var rows = (k.kpis || []).filter(Boolean);
  var ROLE_LABEL = { closer: 'Closer', setter: 'Setter', 'dm-setter': 'DM Setter' };

  return (
    <div className="kpi-card sc-card">
      <CardCrest brand={data.brand} label="KPIs" />
      <div className="kpi-top">
        <div className="stat-card-avatar">
          {p.avatarUrl ? <img src={p.avatarUrl} alt={p.name} /> : <span>{initials}</span>}
        </div>
        <div className="min-w-0">
          <h1 className="stat-card-name">{p.name}</h1>
          <p className="stat-card-sub">{(ROLE_LABEL[k.role] || 'Sales floor') + ' · ' + k.month}</p>
        </div>
        <div className="kpi-score">
          {k.completion === null ? (
            <>
              <span className="kpi-score-v">—</span>
              <span className="kpi-score-l">no targets</span>
            </>
          ) : (
            <>
              <span className="kpi-score-v">{k.hitCount}<span className="kpi-score-of">/{k.targetsSet}</span></span>
              <span className="kpi-score-l">targets hit</span>
            </>
          )}
        </div>
      </div>

      <div className="kpi-rows">
        {rows.map(function(row) { return <KpiRow key={row.key} row={row} />; })}
      </div>

      <div className="kpi-foot">
        <span>
          {k.weekdaysLeft > 0
            ? k.weekdaysLeft + ' working ' + (k.weekdaysLeft === 1 ? 'day' : 'days') + ' left this month'
            : 'Last working day of the month'}
        </span>
      </div>
    </div>
  );
}

export default function StatCardPage() {
  var workspaceId = useWorkspace();
  var router = useRouter();
  var [data, setData] = useState(null);
  var [copied, setCopied] = useState(false);
  var [style, setStyle] = useState('pnl');
  var [days, setDays] = useState('30');
  // Whose card. Empty means the signed-in person's own.
  var [rep, setRep] = useState(null);
  // The node the picture is taken of: the card itself, never the switch above it
  // or the buttons below, which are controls and have no business in a screenshot
  // posted to a group.
  var shotRef = useRef(null);
  var [shooting, setShooting] = useState(false);
  var [shot, setShot] = useState('');
  var [shotErr, setShotErr] = useState('');

  // ?style=kpi so the button on the dashboard can land straight on this card, and
  // ?rep= so a manager can build a REP's card to post in the group. Without the
  // second one this page could only ever render the person holding the session,
  // which meant a manager had no way to show the floor how one of their closers
  // was tracking. /api/me decides whether they may: a rep who asks for somebody
  // else gets their own card back.
  useEffect(function() {
    try {
      var q = new URLSearchParams(window.location.search);
      var wanted = q.get('style');
      if (wanted === 'kpi' || wanted === 'stat' || wanted === 'pnl') setStyle(wanted);
      setRep((q.get('rep') || '').trim());
    } catch (e) { /* nothing worth breaking a card over */ }
  }, []);

  useEffect(function() {
    // null until the query string has been read, so the card is never built for
    // the wrong person on the first pass and then swapped underneath a screenshot.
    if (!workspaceId || rep === null) return;
    var end = todayInReportTimezone();
    var d = new Date(end + 'T12:00:00');
    d.setDate(d.getDate() - (parseInt(days, 10) - 1));
    var path = '/api/me?start=' + toReportDay(d) + '&end=' + end
      + (rep ? '&rep=' + encodeURIComponent(rep) : '');
    apiFetch(withWorkspace(path, workspaceId))
      .then(function(r) { return r.json(); })
      .then(function(json) { if (json.success) setData(json); })
      .catch(function() {});
  }, [workspaceId, days, rep]);

  if (!data) return <div className="card-stage" style={{ color: 'var(--crm-muted)' }}>Building the card…</div>;

  var p = data.profile;
  var life = data.stats.lifetime;
  var rec = data.stats.records;
  var earned = data.stats.awards.filter(function(a) { return a.earned; });
  var top = earned.slice(-3).reverse();
  var initials = (p.name || '?').split(' ').map(function(w) { return w[0]; }).join('').slice(0, 2).toUpperCase();

  var pnl = data.pnl;
  var PERIODS = [{ id: '7', label: '7D' }, { id: '30', label: '30D' }, { id: '90', label: '90D' }, { id: '365', label: '1Y' }];
  var up = pnl && pnl.direction !== 'down';

  // The card as a PNG, on the clipboard.
  //
  // Rendered from the live DOM rather than drawn a second time, so what lands in
  // the group is exactly what is on screen — one card to keep right instead of
  // two that drift apart.
  //
  // The background is painted in rather than left transparent: every chat client
  // flattens a PNG onto white, and a transparent card arrives with four white
  // corners cut out of its rounded edges.
  async function shoot() {
    var node = shotRef.current;
    if (!node) return null;
    var ground = '';
    try {
      ground = getComputedStyle(document.body).backgroundColor || '';
    } catch (e) { ground = ''; }
    return await toBlob(node, {
      // Retina, so the card is still sharp when somebody opens it full-screen on
      // a phone. Above 2 the file gets large enough that pasting stalls.
      pixelRatio: 2,
      backgroundColor: ground || '#0a0a0b',
      cacheBust: true,
      // The avatar is served from /api/avatar and must be fetched and inlined; a
      // picture of the card with a broken face on it is worse than no picture.
      skipFonts: false,
    });
  }

  function say(kind) {
    setShot(kind);
    setTimeout(function() { setShot(''); }, 2600);
  }

  function download(blob) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = (p.name || 'card').replace(/[^a-z0-9]+/gi, '-').toLowerCase()
      + '-' + style + '.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Freed on the next tick; revoking immediately cancels the download in Safari.
    setTimeout(function() { URL.revokeObjectURL(url); }, 4000);
  }

  async function copyImage() {
    if (shooting) return;
    setShooting(true);
    setShotErr('');
    try {
      var blob = await shoot();
      if (!blob) throw new Error('nothing to capture');

      // Writing an image to the clipboard needs a secure context and a browser
      // that supports it — Firefox does not, and neither does any browser over
      // plain http. Rather than fail, the card is downloaded instead and the
      // button says so, because a file in Downloads can still be dragged into the
      // chat and an error message cannot.
      var canWrite = typeof window !== 'undefined'
        && window.isSecureContext
        && navigator.clipboard
        && typeof navigator.clipboard.write === 'function'
        && typeof window.ClipboardItem === 'function';

      if (!canWrite) { download(blob); say('saved'); setShooting(false); return; }

      try {
        await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blob })]);
        say('copied');
      } catch (e) {
        // Permission refused, or a browser that advertises write() and then
        // rejects image types. The picture already exists either way.
        download(blob);
        say('saved');
      }
    } catch (e) {
      setShotErr('Could not build the image. Screenshot the card instead.');
    }
    setShooting(false);
  }

  async function downloadImage() {
    if (shooting) return;
    setShooting(true);
    setShotErr('');
    try {
      var blob = await shoot();
      if (!blob) throw new Error('nothing to capture');
      download(blob);
      say('saved');
    } catch (e) {
      setShotErr('Could not build the image. Screenshot the card instead.');
    }
    setShooting(false);
  }

  function copyText() {
    if (style === 'kpi' && data.kpis) {
      var k = data.kpis;
      var kpiLines = [p.name + ' — ' + k.month + ' KPIs'];
      (k.kpis || []).forEach(function(row) {
        if (row.actual === null && row.target === null) return;
        var shown = row.kind === 'money' ? formatCurrency(row.actual)
          : row.kind === 'rate' ? pct(row.actual) : (row.actual || 0);
        var of = row.target === null ? ''
          : ' / ' + (row.kind === 'money' ? formatCurrency(row.target)
            : row.kind === 'rate' ? pct(row.target) : row.target)
            + (row.percent === null ? '' : ' (' + row.percent + '%)');
        kpiLines.push(row.label + ': ' + shown + of);
      });
      if (k.completion !== null) kpiLines.push(k.hitCount + ' of ' + k.targetsSet + ' targets hit');
      if (navigator.clipboard) {
        navigator.clipboard.writeText(kpiLines.join('\n')).then(function() {
          setCopied(true);
          setTimeout(function() { setCopied(false); }, 2200);
        });
      }
      return;
    }
    if (style === 'pnl' && pnl) {
      var pnlLines = [
        p.name + ' — last ' + pnl.days + ' days',
        formatCurrency(pnl.cash) + ' collected across ' + pnl.closes + ' closes',
        pnl.changePercent === null
          ? 'First period on the board'
          : (pnl.changePercent >= 0 ? '+' : '') + pnl.changePercent + '% vs the ' + pnl.days + ' days before',
      ].join('\n');
      if (navigator.clipboard) {
        navigator.clipboard.writeText(pnlLines).then(function() {
          setCopied(true);
          setTimeout(function() { setCopied(false); }, 2200);
        });
      }
      return;
    }
    var lines = [
      p.name,
      formatCurrency(life.cash) + ' collected lifetime',
      life.closes + ' closes · ' + pct(life.closeRate) + ' close rate · ' + formatCurrency(life.cashPerCall) + ' per call',
      'Biggest deal ' + formatCurrency(rec.biggestDeal) + ' · best day ' + formatCurrency(rec.bestDayCash),
    ].join('\n');
    if (navigator.clipboard) {
      navigator.clipboard.writeText(lines).then(function() {
        setCopied(true);
        setTimeout(function() { setCopied(false); }, 2200);
      });
    }
  }

  return (
    <div className="card-stage">
      <div className="card-wrap">
        <div className="card-switch">
          <button className={'card-switch-i' + (style === 'pnl' ? ' on' : '')}
            onClick={function() { setStyle('pnl'); }}>P&L</button>
          <button className={'card-switch-i' + (style === 'stat' ? ' on' : '')}
            onClick={function() { setStyle('stat'); }}>Career</button>
          <button className={'card-switch-i' + (style === 'kpi' ? ' on' : '')}
            onClick={function() { setStyle('kpi'); }}>KPIs</button>
        </div>

        <div className="card-shot" ref={shotRef}>
        {style === 'kpi' ? <KpiCard data={data} initials={initials} /> : null}

        {style === 'pnl' && pnl ? (
          <div className={'pnl-card sc-card ' + (up ? 'up' : 'down')}>
            <div className="pnl-glow" />
            <CardCrest brand={data.brand} label="P&L" />
            <div className="pnl-top">
              <div className="stat-card-avatar">
                {p.avatarUrl ? <img src={p.avatarUrl} alt={p.name} /> : <span>{initials}</span>}
              </div>
              <div className="min-w-0">
                <h1 className="stat-card-name">{p.name}</h1>
                <p className="stat-card-sub">{p.tagline || 'Sales floor'}</p>
              </div>
              <div className="pnl-periods">
                {PERIODS.map(function(x) {
                  return (
                    <button key={x.id} className={'pnl-period' + (days === x.id ? ' on' : '')}
                      onClick={function() { setDays(x.id); }}>{x.label}</button>
                  );
                })}
              </div>
            </div>

            <p className="pnl-label">Cash collected · last {pnl.days} days</p>
            <p className="pnl-change">
              {pnl.changePercent === null
                ? <><Sparkles size={30} /> First period</>
                : <>{up ? <TrendingUp size={34} /> : <TrendingDown size={34} />}
                   {pnl.changePercent >= 0 ? '+' : ''}{pnl.changePercent}%</>}
            </p>
            <p className="pnl-cash">{formatCurrency(pnl.cash)}</p>
            <p className="pnl-prev">
              {pnl.changePercent === null
                ? <>nothing to compare against yet</>
                : <>from {formatCurrency(pnl.previousCash)} the {pnl.days} days before
                    · {pnl.changeCash >= 0 ? '+' : ''}{formatCurrency(pnl.changeCash)}</>}
            </p>

            <div className="pnl-grid">
              <div><span>Closes</span><b>{pnl.closes}</b></div>
              <div><span>Close rate</span><b>{pct(life.closeRate)}</b></div>
              <div><span>Per call</span><b>{life.cashPerCall === null ? '—' : formatCurrency(life.cashPerCall)}</b></div>
            </div>

            <p className="stat-card-foot">
              <span>{p.email.split('@')[0]}</span>
              <b>{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</b>
            </p>
          </div>
        ) : null}

        {style === 'stat' ? (
        <div className="stat-card sc-card">
          <CardCrest brand={data.brand} label="Career" />
          <div className="stat-card-top">
            <div className="stat-card-avatar">
              {p.avatarUrl ? <img src={p.avatarUrl} alt={p.name} /> : <span>{initials}</span>}
            </div>
            <div className="min-w-0">
              <h1 className="stat-card-name">{p.name}</h1>
              <p className="stat-card-sub">{p.tagline || 'Sales floor'}</p>
            </div>
          </div>

          <div className="stat-card-hero">
            <p className="stat-card-hero-l">Lifetime cash collected</p>
            <p className="stat-card-hero-v">{formatCurrency(life.cash)}</p>
          </div>

          <div className="stat-card-grid">
            <div><span>Closes</span><b>{life.closes}</b></div>
            <div><span>Close rate</span><b>{pct(life.closeRate)}</b></div>
            <div><span>Per call</span><b>{life.cashPerCall === null ? '—' : formatCurrency(life.cashPerCall)}</b></div>
            <div><span>Biggest deal</span><b>{formatCurrency(rec.biggestDeal)}</b></div>
            <div><span>Best day</span><b>{formatCurrency(rec.bestDayCash)}</b></div>
            <div><span>EOD streak</span><b>{rec.longestStreak}</b></div>
          </div>

          {top.length ? (
            <div className="stat-card-badges">
              {top.map(function(a) {
                return <span className="stat-card-badge" key={a.id}><Trophy size={11} /> {a.name}</span>;
              })}
            </div>
          ) : null}

          <p className="stat-card-foot">
            <span>{data.stats.earnedCount} of {data.stats.totalAwards} awards earned</span>
            <b>{new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</b>
          </p>
        </div>
        ) : null}

        </div>

        <div className="card-actions">
          <button className="an-btn-ghost" onClick={function() {
            router.push(rep ? '/me?rep=' + encodeURIComponent(rep) : '/me');
          }}>
            <ArrowLeft size={14} /> Back
          </button>
          <button className="an-btn-ghost" onClick={copyText}>
            {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy as text</>}
          </button>
          {/* Saving is the escape hatch for a browser that will not take an image
              on the clipboard, and it is also just what some people want, so it is
              a button of its own rather than only a silent fallback. */}
          <button className="an-btn-ghost" onClick={downloadImage} disabled={shooting} title="Save the card as a PNG">
            <Download size={14} /> Save
          </button>
          <button className="an-btn" onClick={copyImage} disabled={shooting}>
            {shooting ? <><Loader2 size={14} className="animate-spin" /> Building…</>
              : shot === 'copied' ? <><Check size={14} /> Image copied</>
              : shot === 'saved' ? <><Check size={14} /> Saved as PNG</>
              : <><ImageIcon size={14} /> Copy image</>}
          </button>
        </div>
        <p className="text-center text-xs mt-3" style={{ color: shotErr ? 'var(--crm-negative)' : 'var(--crm-muted)' }}>
          {shotErr
            ? shotErr
            : shot === 'saved'
              ? 'Your browser will not put an image on the clipboard, so the card was saved instead — drag it into the chat.'
              : 'Copy the card as an image and paste it straight into the group.'}
        </p>
      </div>
    </div>
  );
}
