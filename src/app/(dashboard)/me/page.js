'use client';

import { useState, useEffect, useRef } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Camera, Trophy, Lock, Flame, Crown } from 'lucide-react';
import { useWorkspace, withWorkspace, apiFetch } from '@/lib/workspace-client';
import ClientOnly from '@/components/ClientOnly';
import { formatCurrency } from '@/lib/utils';
import { toReportDay, todayInReportTimezone } from '@/lib/report-date';

// A rep's own page. Every figure is theirs; the only number belonging to anyone
// else is how far ahead the rep above them is, and only as a distance.

var MAX_BYTES = 400 * 1024;
var RANGES = [{ id: '30', label: '30d' }, { id: '90', label: '90d' }, { id: '365', label: 'Year' }];

function pct(v) { return v === null || v === undefined ? '—' : v + '%'; }
function cash(v) { return v === null || v === undefined ? '—' : formatCurrency(v); }
function num(v) { return (v || 0).toLocaleString('en-US'); }
function shortDay(d) {
  if (!d) return '';
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function monthName(m) {
  if (!m) return '';
  return new Date(m + '-01T12:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}
function daysAgo(days) {
  var d = new Date();
  d.setDate(d.getDate() - (parseInt(days, 10) - 1));
  return toReportDay(d);
}

var TIER_STYLE = {
  bronze:   { ring: 'rgba(180,120,70,0.5)',  fill: 'rgba(180,120,70,0.14)',  ink: '#d8a678' },
  silver:   { ring: 'rgba(190,195,210,0.5)', fill: 'rgba(190,195,210,0.14)', ink: '#cfd4e2' },
  gold:     { ring: 'rgba(245,180,60,0.55)', fill: 'rgba(245,180,60,0.15)',  ink: '#f3ce8e' },
  platinum: { ring: 'rgba(var(--accent-rgb),0.6)', fill: 'rgba(var(--accent-rgb),0.16)', ink: 'var(--crm-accent)' },
};

function Award({ a }) {
  var t = TIER_STYLE[a.tier] || TIER_STYLE.bronze;
  var shown = a.unit === 'cash' ? formatCurrency(a.value) : num(a.value);
  var goal = a.unit === 'cash' ? formatCurrency(a.target) : num(a.target) + (a.unit === '%' ? '%' : '');
  return (
    <div className={'me-award' + (a.earned ? ' earned' : '')}
      style={a.earned ? { borderColor: t.ring, background: t.fill } : {}}>
      <div className="me-award-top">
        <span className="me-award-icon" style={{ color: a.earned ? t.ink : 'var(--crm-muted)' }}>
          {a.earned ? <Trophy size={15} /> : <Lock size={13} />}
        </span>
        <span className="me-award-name" style={a.earned ? { color: t.ink } : {}}>{a.name}</span>
      </div>
      <p className="me-award-detail">{a.detail}</p>
      {a.earned
        ? <span className="me-award-done">Earned</span>
        : (
          <div className="me-award-prog">
            <span className="me-award-bar"><i style={{ width: Math.round(a.progress * 100) + '%' }} /></span>
            <span className="me-award-count">{shown} / {goal}</span>
          </div>
        )}
    </div>
  );
}

function Stat({ label, value, sub, tone }) {
  return (
    <div className="me-stat">
      <p className="me-stat-l">{label}</p>
      <p className="me-stat-v" style={tone ? { color: tone } : {}}>{value}</p>
      {sub ? <p className="me-stat-s">{sub}</p> : null}
    </div>
  );
}

function Record({ label, value, sub }) {
  return (
    <div className="me-rec">
      <span className="me-rec-l">{label}</span>
      <span className="me-rec-v">{value}</span>
      {sub ? <span className="me-rec-s">{sub}</span> : null}
    </div>
  );
}

export default function MyDashboardPage() {
  var workspaceId = useWorkspace();
  var fileRef = useRef(null);
  var [data, setData] = useState(null);
  var [loading, setLoading] = useState(true);
  var [error, setError] = useState('');
  var [range, setRange] = useState('30');
  var [showAll, setShowAll] = useState(false);
  var [saving, setSaving] = useState('');

  var start = daysAgo(range);
  var end = todayInReportTimezone();

  function load() {
    if (!workspaceId) return;
    setLoading(true);
    apiFetch(withWorkspace('/api/me?start=' + start + '&end=' + end, workspaceId))
      .then(function(r) { return r.json(); })
      .then(function(json) {
        if (!json.success) setError(json.error || 'Could not load your stats');
        else { setData(json); setError(''); }
        setLoading(false);
      })
      .catch(function() { setError('Could not reach the server'); setLoading(false); });
  }

  useEffect(load, [workspaceId, range, start, end]);

  function onPhoto(e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    if (file.size > MAX_BYTES) { setSaving('That photo is over 400KB — try a smaller one.'); return; }
    var reader = new FileReader();
    reader.onload = function() { savePhoto(String(reader.result)); };
    reader.onerror = function() { setSaving('Could not read that file'); };
    reader.readAsDataURL(file);
  }

  function savePhoto(url) {
    setSaving('Saving…');
    apiFetch('/api/me', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatarUrl: url }),
    })
      .then(function(r) { return r.json(); })
      .then(function(json) {
        if (!json.success) { setSaving(json.error || 'Could not save'); return; }
        setSaving('');
        load();
      })
      .catch(function() { setSaving('Could not reach the server'); });
  }

  if (loading && !data) return <div className="px-4 md:px-8 py-6 text-sm font-mono" style={{ color: 'var(--crm-muted)' }}>Loading your stats…</div>;
  if (error) return <div className="px-4 md:px-8 py-6 text-sm font-mono" style={{ color: '#ef4444' }}>{error}</div>;
  if (!data) return null;

  var p = data.profile;
  var s = data.stats;
  var life = s.lifetime;
  var per = s.period;
  var rec = s.records;
  var stand = data.standing;
  var comm = data.commissions.summary || {};
  var initials = (p.name || '?').split(' ').map(function(w) { return w[0]; }).join('').slice(0, 2).toUpperCase();
  var awards = showAll ? s.awards : s.awards.filter(function(a) { return a.earned; }).concat(s.nextUp);
  var daily = (per.daily || []).map(function(d) { return Object.assign({}, d, { label: shortDay(d.date) }); });

  return (
    <div className="min-h-screen">
      <header className="page-header py-4 md:py-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-display font-bold" style={{ color: 'var(--crm-text-bright)' }}>My Dashboard</h1>
            <p className="text-xs font-mono" style={{ color: 'var(--crm-muted)' }}>
              Everything you have collected, converted and earned
            </p>
          </div>
          <div className="an-seg">
            {RANGES.map(function(r) {
              return (
                <button key={r.id} onClick={function() { setRange(r.id); }}
                  className={'an-seg-i' + (range === r.id ? ' on' : '')}>{r.label}</button>
              );
            })}
          </div>
        </div>
      </header>

      <div className="px-4 md:px-8 pb-10">
        {/* ---- identity ---- */}
        <div className="me-hero glass-card mb-4">
          <div className="me-id">
            <button className="me-avatar" onClick={function() { fileRef.current && fileRef.current.click(); }}
              title="Change your photo">
              {p.avatarUrl
                ? <img src={p.avatarUrl} alt={p.name} />
                : <span className="me-avatar-initials">{initials}</span>}
              <span className="me-avatar-edit"><Camera size={14} /></span>
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={onPhoto} className="hidden" />

            <div className="min-w-0">
              <h2 className="me-name">{p.name}</h2>
              <p className="me-sub">
                {stand.rank
                  ? <>Rank <b>{stand.rank}</b> of {stand.of} this period{stand.behindBy > 0 ? <> · {formatCurrency(stand.behindBy)} behind the rep above</> : null}</>
                  : <>No closes in this range yet</>}
              </p>
              {saving ? <p className="me-saving">{saving}</p> : null}
            </div>

            <div className="me-headline">
              <p className="me-headline-l">Lifetime cash collected</p>
              <p className="me-headline-v">{formatCurrency(life.cash)}</p>
              <p className="me-headline-s">
                {num(life.deals)} deals · {num(s.earnedCount)} of {num(s.totalAwards)} awards
              </p>
            </div>
          </div>
        </div>

        {/* ---- the numbers that matter ---- */}
        <div className="me-stats mb-4">
          <Stat label="Close rate" value={pct(life.closeRate)} sub={num(life.offers) + ' offers made'} />
          <Stat label="Cash per call" value={cash(life.cashPerCall)} sub={num(life.callsTaken) + ' calls held'} />
          <Stat label="Average deal" value={cash(life.avgDeal)} sub="lifetime" />
          <Stat label="Show rate" value={pct(life.showRate)} sub="of your booked calls" />
          <Stat label="This period" value={formatCurrency(per.cash)} sub={num(per.deals) + ' deals · ' + pct(per.closeRate) + ' close rate'} tone="#22c55e" />
          <Stat label="EOD streak" value={num(rec.currentStreak)} sub={'best ' + num(rec.longestStreak) + ' weekdays'} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
          {/* ---- bonuses ---- */}
          <div className="an-card">
            <div className="an-card-h"><h3 className="an-card-t">Bonuses earned</h3>
              {comm.rate ? <span className="an-card-n">{Math.round(comm.rate * 1000) / 10}% of cash collected</span> : null}
            </div>
            <div className="p-4">
              <p className="me-comm-total">{formatCurrency(comm.totalCommission || 0)}</p>
              <p className="me-comm-sub">earned lifetime on {num(comm.totalDeals || 0)} deals</p>
              <div className="me-comm-split">
                <div><span>Paid</span><b style={{ color: '#22c55e' }}>{formatCurrency(comm.paidCommission || 0)}</b></div>
                <div><span>Approved</span><b>{formatCurrency(comm.approvedCommission || 0)}</b></div>
                <div><span>Pending</span><b style={{ color: '#f59e0b' }}>{formatCurrency(comm.pendingCommission || 0)}</b></div>
              </div>
            </div>
          </div>

          {/* ---- personal records ---- */}
          <div className="an-card">
            <div className="an-card-h"><h3 className="an-card-t">Personal records</h3></div>
            <div className="p-4">
              <Record label="Biggest deal" value={formatCurrency(rec.biggestDeal)} sub={rec.biggestDealLead} />
              <Record label="Best day" value={formatCurrency(rec.bestDayCash)} sub={shortDay(rec.bestDay)} />
              <Record label="Best month" value={formatCurrency(rec.bestMonthCash)} sub={monthName(rec.bestMonth)} />
              <Record label="Most closes in a day" value={num(rec.mostClosesInADay)} />
              <Record label="Longest EOD streak" value={num(rec.longestStreak) + ' weekdays'} />
            </div>
          </div>

          {/* ---- your period ---- */}
          <div className="an-card">
            <div className="an-card-h"><h3 className="an-card-t">Your cash, day by day</h3></div>
            <div className="p-4 h-[232px]">
              <ClientOnly>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={daily}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="label" stroke="var(--crm-muted)" tick={{ fontSize: 9, fill: 'var(--crm-muted)' }} />
                    <YAxis stroke="var(--crm-muted)" tick={{ fontSize: 10, fill: 'var(--crm-muted)' }}
                      tickFormatter={function(x) { return x >= 1000 ? '$' + Math.round(x / 1000) + 'k' : '$' + x; }} />
                    <Tooltip contentStyle={{ background: 'var(--tooltip-bg)', border: '1px solid var(--tooltip-border)', borderRadius: '12px', color: 'var(--crm-text-bright)', fontSize: '12px' }}
                      formatter={function(x) { return ['$' + x.toLocaleString(), 'Cash']; }} />
                    <Area type="monotone" dataKey="cash" stroke="#22c55e" fill="rgba(34,197,94,0.14)" name="Cash" />
                  </AreaChart>
                </ResponsiveContainer>
              </ClientOnly>
            </div>
          </div>
        </div>

        {/* ---- awards ---- */}
        <div className="an-card">
          <div className="an-card-h">
            <h3 className="an-card-t">Awards</h3>
            <span className="an-card-n">{s.earnedCount} of {s.totalAwards} earned</span>
            <button className="an-tab on" style={{ marginLeft: 'auto' }}
              onClick={function() { setShowAll(!showAll); }}>
              {showAll ? 'Show earned + next up' : 'Show every award'}
            </button>
          </div>
          <div className="p-4">
            <div className="me-awards">
              {awards.map(function(a) { return <Award key={a.id} a={a} />; })}
            </div>
            {!showAll && s.nextUp.length ? (
              <p className="me-next">
                <Flame size={13} style={{ color: 'var(--crm-warning)' }} />
                Closest to earning: {s.nextUp.map(function(a) { return a.name; }).join(', ')}
              </p>
            ) : null}
          </div>
        </div>

        {s.monthly.length > 1 ? (
          <div className="an-card mt-4">
            <div className="an-card-h"><h3 className="an-card-t">Month by month</h3>
              <span className="an-card-n">your last {s.monthly.length} months</span></div>
            <div className="table-scroll">
              <table className="data-table w-full">
                <thead>
                  <tr>
                    <th className="an-th an-th-name">Month</th>
                    <th className="an-th an-th-n">Deals</th>
                    <th className="an-th an-th-n">Cash collected</th>
                    <th className="an-th an-th-n">Average deal</th>
                  </tr>
                </thead>
                <tbody>
                  {s.monthly.slice().reverse().map(function(m) {
                    return (
                      <tr key={m.month} className="an-tr">
                        <td className="an-td-name">
                          {monthName(m.month)}
                          {m.month === rec.bestMonth
                            ? <span className="me-best"><Crown size={11} /> best</span>
                            : null}
                        </td>
                        <td className="an-td-n">{num(m.closes)}</td>
                        <td className="an-td-n" style={{ color: '#22c55e' }}>{formatCurrency(m.cash)}</td>
                        <td className="an-td-n">{formatCurrency(m.closes ? Math.round(m.cash / m.closes) : 0)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
