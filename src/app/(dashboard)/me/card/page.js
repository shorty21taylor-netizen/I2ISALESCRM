'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Trophy, ArrowLeft, Check, Copy, TrendingUp, TrendingDown, Sparkles } from 'lucide-react';
import { useWorkspace, withWorkspace, apiFetch } from '@/lib/workspace-client';
import { formatCurrency } from '@/lib/utils';
import { todayInReportTimezone, toReportDay } from '@/lib/report-date';

// The card a rep screenshots into the team chat. Deliberately one screen, no
// scrolling, and nothing on it that belongs to anyone else.

function pct(v) { return v === null || v === undefined ? '—' : v + '%'; }

export default function StatCardPage() {
  var workspaceId = useWorkspace();
  var router = useRouter();
  var [data, setData] = useState(null);
  var [copied, setCopied] = useState(false);
  var [style, setStyle] = useState('pnl');
  var [days, setDays] = useState('30');

  useEffect(function() {
    if (!workspaceId) return;
    var end = todayInReportTimezone();
    var d = new Date(end + 'T12:00:00');
    d.setDate(d.getDate() - (parseInt(days, 10) - 1));
    apiFetch(withWorkspace('/api/me?start=' + toReportDay(d) + '&end=' + end, workspaceId))
      .then(function(r) { return r.json(); })
      .then(function(json) { if (json.success) setData(json); })
      .catch(function() {});
  }, [workspaceId, days]);

  if (!data) return <div className="card-stage" style={{ color: 'var(--crm-muted)' }}>Building your card…</div>;

  var p = data.profile;
  var life = data.stats.lifetime;
  var rec = data.stats.records;
  var earned = data.stats.awards.filter(function(a) { return a.earned; });
  var top = earned.slice(-3).reverse();
  var initials = (p.name || '?').split(' ').map(function(w) { return w[0]; }).join('').slice(0, 2).toUpperCase();

  var pnl = data.pnl;
  var PERIODS = [{ id: '7', label: '7D' }, { id: '30', label: '30D' }, { id: '90', label: '90D' }, { id: '365', label: '1Y' }];
  var up = pnl && pnl.direction !== 'down';

  function copyText() {
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
        </div>

        {style === 'pnl' && pnl ? (
          <div className={'pnl-card ' + (up ? 'up' : 'down')}>
            <div className="pnl-glow" />
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
        ) : (
        <div className="stat-card">
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
        )}

        <div className="card-actions">
          <button className="an-btn-ghost" onClick={function() { router.push('/me'); }}>
            <ArrowLeft size={14} /> Back
          </button>
          <button className="an-btn" onClick={copyText}>
            {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy as text</>}
          </button>
        </div>
        <p className="text-center text-xs mt-3" style={{ color: 'var(--crm-muted)' }}>
          Screenshot the card, or copy it as text for chat.
        </p>
      </div>
    </div>
  );
}
