'use client';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { DollarSign, TrendingUp, Phone, PhoneIncoming, Trophy } from 'lucide-react';
import { useWorkspace, withWorkspace, apiFetch } from '@/lib/workspace-client';
import { formatCurrency } from '@/lib/utils';
import { toReportDay } from '@/lib/report-date';
import RepAvatar from '@/components/RepAvatar';
import useRoster from '@/lib/use-roster';

// A block of plain numbers. No sparklines, no toggles — this page is read at a
// glance before a call, and anything that needs interpreting does not belong.
function num(v) { return (v === null || v === undefined) ? '\u2014' : Number(v).toLocaleString('en-US'); }
function money(v) { return (v === null || v === undefined) ? '\u2014' : formatCurrency(v); }
function pct(v) { return (v === null || v === undefined) ? '\u2014' : v + '%'; }

function MetricSection({ title, note, tiles, missing }) {
  return (
    <div className="td-section relative z-10">
      <div className="td-section-h">
        <h3 className="td-section-t">{title}</h3>
        {note ? <span className="section-tag">{note}</span> : null}
      </div>
      <div className="td-grid">
        {tiles.map(function(t) {
          return (
            <div key={t.label} className="td-tile">
              <p className="td-tile-l">{t.label}</p>
              <p className={'td-tile-v' + (t.tone ? ' ' + t.tone : '')}>{t.value}</p>
              {t.sub ? <p className="td-tile-s">{t.sub}</p> : null}
            </div>
          );
        })}
      </div>
      {missing && missing.length ? (
        <p className="td-missing">
          Not shown: {missing.join(', ')} — no form captures it yet, and a zero here
          would read as &ldquo;nobody was&rdquo; rather than &ldquo;we do not ask&rdquo;.
        </p>
      ) : null}
    </div>
  );
}

export default function DashboardPage() {
  var roster = useRoster();
  var workspaceId = useWorkspace();
  var s2 = useState(null), liveData = s2[0], setLiveData = s2[1];
  var s3 = useState('today'), dateRange = s3[0], setDateRange = s3[1];
  var s4 = useState(''), customStart = s4[0], setCustomStart = s4[1];
  var s5 = useState(''), customEnd = s5[0], setCustomEnd = s5[1];
  var s6 = useState(''), lastFetch = s6[0], setLastFetch = s6[1];

  function getDateParams() {
    var today = new Date();
    var todayStr = toReportDay(today);

    if (dateRange === 'today') {
      return { start: todayStr, end: todayStr };
    }
    if (dateRange === 'yesterday') {
      var y = new Date(today);
      y.setDate(y.getDate() - 1);
      return { start: toReportDay(y), end: toReportDay(y) };
    }
    // This week means the week you are standing in, Monday to today — not the
    // last seven days. A sales week is a thing people plan against.
    if (dateRange === 'week') {
      var w = new Date(today);
      var dow = (w.getDay() + 6) % 7; // Monday = 0
      w.setDate(w.getDate() - dow);
      return { start: toReportDay(w), end: todayStr };
    }
    if (dateRange === 'month') {
      var m = new Date(today);
      m.setDate(m.getDate() - 29);
      return { start: toReportDay(m), end: todayStr };
    }
    if (dateRange === 'quarter') {
      var q = new Date(today);
      q.setDate(q.getDate() - 89);
      return { start: toReportDay(q), end: todayStr };
    }
    if (dateRange === 'year') {
      var y365 = new Date(today);
      y365.setDate(y365.getDate() - 364);
      return { start: toReportDay(y365), end: todayStr };
    }
    if (dateRange === 'custom' && customStart && customEnd) {
      return { start: customStart, end: customEnd };
    }
    return { start: todayStr, end: todayStr };
  }

  var router = useRouter();

  var fetchDashboard = useCallback(function() {
    if (!workspaceId) return; // wait for the active workspace to resolve client-side
    var params = getDateParams();
    var qs = '?start=' + params.start + '&end=' + params.end;
    apiFetch(withWorkspace('/api/dashboard' + qs, workspaceId))
      .then(function(r) { return r.json(); })
      .then(function(data) {
        // The server refuses this payload to reps and names where they belong.
        if (data && data.redirect) { router.replace(data.redirect); return; }
        if (data.success) {
          setLiveData(data);
          setLastFetch(new Date().toISOString());
        }
      })
      .catch(function(e) { console.error('Dashboard fetch error:', e); });

  }, [dateRange, customStart, customEnd, workspaceId]);

  useEffect(function() {
    fetchDashboard();
    var interval = setInterval(fetchDashboard, 30000);
    return function() { clearInterval(interval); };
  }, [fetchDashboard]);

  // No mock fallback — before live data arrives the dashboard shows real zeros
  // rather than invented numbers.
  var displayOverview = (liveData && liveData.overview) ? liveData.overview : {};
  var t = displayOverview;
  var todayCash = t.todayCash || t.totalCash || 0;
  var todayCloses = t.todayCloses || t.totalCloses || 0;
  var todayDials = t.todayDials || t.totalDials || 0;


  // Compute yesterday's date
  var yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  var yesterdayStr = toReportDay(yesterday);

  // Filter EODs to yesterday
  var m = (liveData && liveData.metrics) || null;
  var c = (m && m.closers) || {};
  var st = (m && m.setters) || {};

  var rangeLabel = (function() {
    if (dateRange === 'today') return 'Today';
    if (dateRange === 'yesterday') return 'Yesterday';
    if (dateRange === 'week') return 'This week';
    if (dateRange === 'month') return 'Past month';
    if (dateRange === 'quarter') return 'Past quarter';
    if (dateRange === 'year') return 'Past year';
    return 'Custom';
  })();

  var dateDisplay = (function() {
    var p = getDateParams();
    if (dateRange === 'today') return p.start;
    if (dateRange === 'yesterday') return p.start;
    return p.start + ' → ' + p.end;
  })();

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto bg-orbs relative">
      {/* Header */}
      <div className="flex items-center justify-between stagger-1 relative z-10">
        <div>
          <h1 className="font-display text-2xl font-bold text-crm-text-bright">Good afternoon, Anthony</h1>
          <p className="text-sm text-crm-muted mt-1">{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="live-indicator">
            <div className={liveData ? 'glow-dot-green' : 'w-1.5 h-1.5 rounded-full bg-crm-muted'} />
            <span className={liveData ? 'text-crm-positive' : 'text-crm-muted'}>{liveData ? 'Live' : 'Connecting...'}</span>
          </div>
          <div className="flex items-center gap-4 glass-surface px-4 py-2">
            <span className="text-xs font-mono text-crm-muted">{rangeLabel}: <span className="metric-value-green text-sm">{formatCurrency(todayCash)}</span></span>
            <span className="text-xs font-mono text-crm-muted">{todayCloses} closes</span>
            <span className="text-xs font-mono text-crm-muted">{todayDials} dials</span>
            <span className="text-xs font-mono text-crm-muted">{t.activeClosers || 0} closers</span>
            {liveData && liveData.counts ? (
              <span className="text-xs font-mono text-crm-accent">{liveData.counts.bookedCalls} total bookings</span>
            ) : null}
          </div>
        </div>
      </div>

      {/* ===== DATE RANGE PICKER ===== */}
      <div className="flex items-center justify-between relative z-10 stagger-2">
        <div className="glass-surface inline-flex rounded-xl p-1 gap-0.5">
          {[
            { id: 'today', label: 'Today' },
            { id: 'yesterday', label: 'Yesterday' },
            { id: 'week', label: 'This Week' },
            { id: 'month', label: 'Past Month' },
            { id: 'quarter', label: 'Past Quarter' },
            { id: 'year', label: 'Past Year' },
            { id: 'custom', label: 'Custom' },
          ].map(function(opt) {
            return (
              <button
                key={opt.id}
                onClick={function() { setDateRange(opt.id); }}
                className={dateRange === opt.id
                  ? 'px-3 py-1.5 rounded-lg text-xs font-display font-semibold bg-crm-accent/15 text-crm-accent transition-all duration-200'
                  : 'px-3 py-1.5 rounded-lg text-xs font-display font-medium text-crm-muted hover:text-crm-text transition-all duration-200'}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        <div className="text-xs font-mono text-crm-muted">
          {dateDisplay}
        </div>
      </div>

      {/* Custom date inputs */}
      {dateRange === 'custom' && (
        <div className="flex items-center gap-3 relative z-10">
          <div className="flex items-center gap-2">
            <label className="text-xs font-mono text-crm-muted">From</label>
            <input
              type="date"
              value={customStart}
              onChange={function(e) { setCustomStart(e.target.value); }}
              className="input-field"
              style={{ width: '160px', fontSize: '12px', padding: '6px 10px' }}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-mono text-crm-muted">To</label>
            <input
              type="date"
              value={customEnd}
              onChange={function(e) { setCustomEnd(e.target.value); }}
              className="input-field"
              style={{ width: '160px', fontSize: '12px', padding: '6px 10px' }}
            />
          </div>
        </div>
      )}

      {/* 5 Core KPIs — no toggle, no pages */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-5 mb-6 relative z-10">

        {/* Cash Collected */}
        <div className="glass-card p-6 md:p-8">
          <div className="flex items-start justify-between mb-3 md:mb-4">
            <div className="p-2.5 md:p-3 rounded-xl" style={{ background: 'rgba(34,197,94,0.1)' }}>
              <DollarSign className="w-5 h-5 md:w-6 md:h-6" style={{ color: '#22c55e' }} />
            </div>
          </div>
          <p className="text-3xl md:text-4xl font-display font-bold" style={{ color: '#22c55e' }}>
            {formatCurrency(displayOverview.totalCash || displayOverview.totalRevenue || 0)}
          </p>
          <p className="text-xs md:text-sm font-mono uppercase tracking-wider mt-2" style={{ color: 'var(--crm-text-muted)' }}>
            Cash Collected
          </p>
        </div>

        {/* Revenue */}
        <div className="glass-card p-6 md:p-8">
          <div className="flex items-start justify-between mb-3 md:mb-4">
            <div className="p-2.5 md:p-3 rounded-xl" style={{ background: 'rgba(34,197,94,0.1)' }}>
              <TrendingUp className="w-5 h-5 md:w-6 md:h-6" style={{ color: '#22c55e' }} />
            </div>
          </div>
          <p className="text-3xl md:text-4xl font-display font-bold" style={{ color: '#22c55e' }}>
            {formatCurrency(displayOverview.totalRevenue || 0)}
          </p>
          <p className="text-xs md:text-sm font-mono uppercase tracking-wider mt-2" style={{ color: 'var(--crm-text-muted)' }}>
            Revenue
          </p>
        </div>

        {/* Outbound Dials */}
        <div className="glass-card p-6 md:p-8">
          <div className="flex items-start justify-between mb-3 md:mb-4">
            <div className="p-2.5 md:p-3 rounded-xl" style={{ background: 'rgba(var(--accent-rgb),0.1)' }}>
              <Phone className="w-5 h-5 md:w-6 md:h-6" style={{ color: '#a3a3a3' }} />
            </div>
          </div>
          <p className="text-3xl md:text-4xl font-display font-bold" style={{ color: 'var(--crm-text-bright)' }}>
            {(displayOverview.totalDials || 0).toLocaleString()}
          </p>
          <p className="text-xs md:text-sm font-mono uppercase tracking-wider mt-2" style={{ color: 'var(--crm-text-muted)' }}>
            Outbound Dials
          </p>
        </div>

        {/* Calls Taken */}
        <div className="glass-card p-6 md:p-8">
          <div className="flex items-start justify-between mb-3 md:mb-4">
            <div className="p-2.5 md:p-3 rounded-xl" style={{ background: 'rgba(59,130,246,0.1)' }}>
              <PhoneIncoming className="w-5 h-5 md:w-6 md:h-6" style={{ color: '#fafafa' }} />
            </div>
          </div>
          <p className="text-3xl md:text-4xl font-display font-bold" style={{ color: 'var(--crm-text-bright)' }}>
            {displayOverview.totalCallsTaken || 0}
          </p>
          <p className="text-xs md:text-sm font-mono uppercase tracking-wider mt-2" style={{ color: 'var(--crm-text-muted)' }}>
            Calls Taken
          </p>
        </div>

        {/* Deals Closed */}
        <div className="glass-card p-6 md:p-8 col-span-2 md:col-span-1">
          <div className="flex items-start justify-between mb-3 md:mb-4">
            <div className="p-2.5 md:p-3 rounded-xl" style={{ background: 'rgba(245,158,11,0.1)' }}>
              <Trophy className="w-5 h-5 md:w-6 md:h-6" style={{ color: 'var(--crm-text-bright)' }} />
            </div>
          </div>
          <p className="text-3xl md:text-4xl font-display font-bold" style={{ color: 'var(--crm-text-bright)' }}>
            {displayOverview.totalCloses || 0}
          </p>
          <p className="text-xs md:text-sm font-mono uppercase tracking-wider mt-2" style={{ color: 'var(--crm-text-muted)' }}>
            Deals Closed
          </p>
        </div>

      </div>

      {/* ===== CLOSER METRICS ===== */}
      <MetricSection
        title="Closer metrics"
        note={m ? m.daysReported + ' reporting ' + (m.daysReported === 1 ? 'day' : 'days') : ''}
        tiles={[
          { label: 'Live calls taken', value: num(c.taken), sub: num(c.onCalendar) + ' on the calendar' },
          { label: 'Total calls booked', value: num(c.sets) },
          { label: 'No shows', value: num(c.noShowed), sub: pct(c.showRate) + ' show rate', tone: 'warn' },
          { label: 'Calls pitched', value: num(c.pitched), sub: num(c.offeredNoClose) + ' offered, no close' },
          { label: 'Deals closed', value: num(c.closes), sub: pct(c.closeRate) + ' of offers' },
          { label: 'Cash collected', value: money(c.cashCollected), tone: 'good' },
          { label: 'Revenue', value: money(c.revenue), sub: 'reported on the day' },
          { label: 'Cash per call', value: money(c.cashPerCall), sub: money(c.cashPerOffer) + ' per offer' },
        ]}
        missing={m && m.missing}
      />

      {/* ===== SETTER METRICS ===== */}
      <MetricSection
        title="Setter metrics"
        note={m ? m.repsReporting + ' ' + (m.repsReporting === 1 ? 'rep' : 'reps') + ' reporting' : ''}
        tiles={[
          { label: 'Outbound dials', value: num(st.dials) },
          { label: 'Conversations', value: num(st.conversations), sub: pct(st.dialToConversation) + ' of dials' },
          { label: 'Live calls', value: num(st.liveCalls) },
          { label: 'Total sets', value: num(st.sets), sub: pct(st.conversationToSet) + ' of conversations' },
          { label: 'Sets that showed', value: num(st.shows) },
          { label: 'No showed', value: num(st.noShowed), tone: 'warn' },
          { label: 'Sets closed', value: num(st.closed), sub: pct(st.setToClose) + ' of sets' },
          { label: 'Cash from sets', value: money(st.cash), tone: 'good' },
          { label: 'Follow-ups booked', value: num(st.followUps) },
        ]}
      />

      {/* Footer */}
      <hr className="divider" />
      <div className="text-center text-xs text-crm-muted py-4">
        Summit OS v1.0 &middot; Data refreshes every 30s
        {liveData && liveData.counts ? (
          <span className="ml-3 text-crm-muted/50">
            ({liveData.counts.bookedCalls} bookings, {liveData.counts.closedDeals} deals, {liveData.counts.eodReports} EODs)
          </span>
        ) : null}
      </div>
    </div>
  );
}
