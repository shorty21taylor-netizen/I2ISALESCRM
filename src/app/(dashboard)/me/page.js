'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Camera, Trophy, Lock, Flame, Crown, Target, Share2, Check, Clock, CalendarDays } from 'lucide-react';
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
  var params = useSearchParams();
  var router = useRouter();
  var viewingRep = params.get('rep') || '';
  var fileRef = useRef(null);
  var [data, setData] = useState(null);
  var [loading, setLoading] = useState(true);
  var [error, setError] = useState('');
  var [range, setRange] = useState('30');
  var [showAll, setShowAll] = useState(false);
  var [saving, setSaving] = useState('');
  var [editing, setEditing] = useState(false);
  var [form, setForm] = useState({ displayName: '', tagline: '', monthlyGoal: '' });

  var start = daysAgo(range);
  var end = todayInReportTimezone();

  function load() {
    if (!workspaceId) return;
    setLoading(true);
    var q = '/api/me?start=' + start + '&end=' + end + (viewingRep ? '&rep=' + encodeURIComponent(viewingRep) : '');
    apiFetch(withWorkspace(q, workspaceId))
      .then(function(r) { return r.json(); })
      .then(function(json) {
        if (!json.success) setError(json.error || 'Could not load your stats');
        else {
          setData(json);
          setForm({
            displayName: json.profile.name || '',
            tagline: json.profile.tagline || '',
            monthlyGoal: json.profile.monthlyGoal ? String(json.profile.monthlyGoal) : '',
          });
          setError('');
        }
        setLoading(false);
      })
      .catch(function() { setError('Could not reach the server'); setLoading(false); });
  }

  useEffect(load, [workspaceId, range, start, end, viewingRep]);

  function onPhoto(e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    if (file.size > MAX_BYTES) { setSaving('That photo is over 400KB — try a smaller one.'); return; }
    var reader = new FileReader();
    reader.onload = function() { savePhoto(String(reader.result)); };
    reader.onerror = function() { setSaving('Could not read that file'); };
    reader.readAsDataURL(file);
  }

  function saveProfile(patch, done) {
    setSaving('Saving…');
    apiFetch('/api/me', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({}, patch, viewingRep ? { rep: viewingRep } : {})),
    })
      .then(function(r) { return r.json(); })
      .then(function(json) {
        if (!json.success) { setSaving(json.error || 'Could not save'); return; }
        setSaving('');
        if (done) done();
        load();
      })
      .catch(function() { setSaving('Could not reach the server'); });
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
  var goal = data.goal;
  var canEdit = data.canEdit;
  var needsSetup = canEdit && !p.onboarded && !p.avatarUrl && !p.monthlyGoal;
  var today = data.today;
  var expect = today ? today.expect : null;
  var longDay = today ? new Date(today.date + 'T12:00:00').toLocaleDateString('en-US',
    { weekday: 'long', month: 'long', day: 'numeric' }) : '';

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
        {data.viewingSomeoneElse ? (
          <div className="an-scoped mb-4">
            <span className="an-scoped-t">Manager view</span>
            <span>You are looking at {p.name}. You can set their monthly target; their photo and bio are theirs.</span>
            <button className="an-chip" style={{ marginLeft: 'auto' }} onClick={function() { router.push('/me'); }}>
              Back to mine
            </button>
          </div>
        ) : null}

        {needsSetup ? (
          <div className="me-setup mb-4">
            <div>
              <h3 className="me-setup-t">Welcome. Make this yours.</h3>
              <p className="me-setup-s">
                Add a photo, say how you want to be introduced, and set the number you are chasing
                this month. It takes about thirty seconds and it is the difference between a page of
                numbers and your page.
              </p>
            </div>
            <button className="an-btn" onClick={function() { setEditing(true); }}>Set up my profile</button>
            <button className="an-btn-ghost" onClick={function() { saveProfile({ onboarded: true }); }}>
              Later
            </button>
          </div>
        ) : null}

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
              {p.tagline ? <p className="me-tagline">{p.tagline}</p> : null}
              {canEdit ? (
                <div className="me-id-actions">
                  <button className="an-chip" onClick={function() { setEditing(!editing); }}>Edit profile</button>
                  <button className="an-chip" onClick={function() { router.push('/me/card'); }}>
                    <Share2 size={12} /> Stat card
                  </button>
                </div>
              ) : null}
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

        {editing ? (
          <div className="an-card mb-4">
            <div className="an-card-h"><h3 className="an-card-t">Your profile</h3></div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="an-field">
                <span>Display name</span>
                <input value={form.displayName}
                  onChange={function(e) { setForm(Object.assign({}, form, { displayName: e.target.value })); }} />
              </label>
              <label className="an-field">
                <span>How you introduce yourself</span>
                <input value={form.tagline} placeholder="Closer · third year on the floor"
                  onChange={function(e) { setForm(Object.assign({}, form, { tagline: e.target.value })); }} />
              </label>
              <label className="an-field">
                <span>Monthly cash target ($)</span>
                <input value={form.monthlyGoal} inputMode="numeric" placeholder="50000"
                  onChange={function(e) { setForm(Object.assign({}, form, { monthlyGoal: e.target.value.replace(/[^0-9]/g, '') })); }} />
              </label>
              <div className="md:col-span-3 flex items-center gap-2">
                <button className="an-btn" onClick={function() {
                  saveProfile({
                    displayName: form.displayName,
                    tagline: form.tagline,
                    monthlyGoal: form.monthlyGoal || 0,
                    onboarded: true,
                  }, function() { setEditing(false); });
                }}>Save profile</button>
                <button className="an-btn-ghost" onClick={function() { setEditing(false); }}>Cancel</button>
                <span className="text-xs" style={{ color: 'var(--crm-muted)' }}>
                  Your name here is for display only — your records stay linked by email.
                </span>
              </div>
            </div>
          </div>
        ) : null}

        {today ? (
          <div className="an-card mb-4">
            <div className="an-card-h">
              <h3 className="an-card-t">Today on your calendar</h3>
              <span className="an-card-n">{longDay}</span>
              {today.count > 0 ? (
                <span className="me-today-count">{today.count} {today.count === 1 ? 'call' : 'calls'}</span>
              ) : null}
            </div>

            {today.count > 0 ? (
              <div>
                <div className="me-today-list">
                  {today.calls.map(function(c) {
                    return (
                      <div className="me-call" key={c.id}>
                        <div className="me-call-time">
                          <Clock size={12} />
                          {c.time || 'No time set'}
                        </div>
                        <div className="me-call-body">
                          <div className="me-call-head">
                            <span className="me-call-lead">{c.lead}</span>
                            {c.program ? <span className="me-call-tag">{c.program}</span> : null}
                            <span className={'me-call-qual ' + (c.qualified ? 'yes' : 'no')}>
                              {c.qualified ? 'Qualified' : 'Not qualified'}
                            </span>
                            {c.intentScore ? <span className="me-call-tag">Intent {c.intentScore}</span> : null}
                          </div>
                          {c.goal || c.pain ? (
                            <p className="me-call-brief">
                              {c.goal ? <><b>Wants:</b> {c.goal}</> : null}
                              {c.goal && c.pain ? ' · ' : null}
                              {c.pain ? <><b>Pain:</b> {c.pain}</> : null}
                            </p>
                          ) : null}
                          {c.notes ? <p className="me-call-notes">{c.notes}</p> : null}
                        </div>
                        <div className="me-call-setter">{c.setter ? 'Set by ' + c.setter : 'No setter'}</div>
                      </div>
                    );
                  })}
                </div>

                {expect && expect.shows !== null ? (
                  <p className="me-expect">
                    <CalendarDays size={13} />
                    On your own numbers, {today.count} booked usually means{' '}
                    <b>{expect.shows}</b> held
                    {expect.offers !== null ? <>, <b>{expect.offers}</b> offered</> : null}
                    {expect.closes !== null ? <> and <b>{expect.closes}</b> closed</> : null}
                    {expect.cash ? <> — about <b>{formatCurrency(expect.cash)}</b></> : null}.
                  </p>
                ) : (
                  <p className="me-expect">
                    <CalendarDays size={13} />
                    Not enough of your own history yet to say what to expect from these.
                  </p>
                )}
              </div>
            ) : (
              <div className="p-4">
                <p className="me-empty-t">Nothing on your calendar today.</p>
                {today.unscheduled > 0 ? (
                  <p className="me-empty-s">
                    {today.unscheduled} of your bookings have no call date on them, so they cannot be
                    placed on a day. Adding a <b>Call Date</b> and <b>Call Time</b> question to the
                    booking form fills this in from then on.
                  </p>
                ) : null}
              </div>
            )}
          </div>
        ) : null}

        {goal && goal.goal > 0 ? (
          <div className="me-goal glass-card mb-4">
            <div className="me-goal-head">
              <span className="me-goal-icon"><Target size={15} /></span>
              <div>
                <p className="me-goal-l">{monthName(goal.month)} target</p>
                <p className="me-goal-v">
                  {formatCurrency(goal.collected)} <span>of {formatCurrency(goal.goal)}</span>
                </p>
              </div>
              <div className="me-goal-verdict">
                <span className={'me-goal-pill ' + (goal.onTrack ? 'ok' : 'behind')}>
                  {goal.onTrack ? 'On pace' : 'Behind pace'}
                </span>
                <p className="me-goal-proj">
                  {goal.weekdaysLeft > 0
                    ? <>on this pace you finish at <b>{formatCurrency(goal.projected)}</b></>
                    : <>month closed</>}
                </p>
              </div>
            </div>
            <span className="me-goal-bar">
              <i style={{ width: Math.min(100, goal.percent || 0) + '%' }} />
              {goal.weekdaysTotal > 0 ? (
                <em className="me-goal-now"
                  style={{ left: Math.min(100, Math.round((goal.weekdaysElapsed / goal.weekdaysTotal) * 100)) + '%' }} />
              ) : null}
            </span>
            <p className="me-goal-foot">
              {goal.percent}% of target · {goal.weekdaysLeft} working {goal.weekdaysLeft === 1 ? 'day' : 'days'} left
              {goal.shortfall > 0 && goal.weekdaysLeft > 0
                ? <> · {formatCurrency(goal.neededPerDay)} a day to close the gap</>
                : null}
              {goal.shortfall === 0 ? <> · target hit</> : null}
            </p>
          </div>
        ) : canEdit && !needsSetup ? (
          <button className="me-goal-empty glass-card mb-4" onClick={function() { setEditing(true); }}>
            <Target size={15} /> Set a monthly cash target and this page will pace you against it.
          </button>
        ) : null}

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
