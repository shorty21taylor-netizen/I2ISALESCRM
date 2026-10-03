'use client';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { useWorkspace, withWorkspace, apiFetch, useAccess } from '@/lib/workspace-client';
import CashProvenance from '@/components/CashProvenance';
import { formatCurrency } from '@/lib/utils';
import { toReportDay, REPORT_TIMEZONE } from '@/lib/report-date';

// A block of plain numbers. No sparklines, no toggles — this page is read at a
// glance before a call, and anything that needs interpreting does not belong.
function num(v) { return (v === null || v === undefined) ? '\u2014' : Number(v).toLocaleString('en-US'); }
function money(v) { return (v === null || v === undefined) ? '\u2014' : formatCurrency(v); }
function pct(v) { return (v === null || v === undefined) ? '\u2014' : v + '%'; }

// The greeting used to read "Good afternoon, Anthony" — a hardcoded name and a
// hardcoded time of day on the first screen of a multi-tenant CRM, so every
// client was greeted by the operator's name at six in the morning. The hour is
// bucketed in the team's timezone like every other time in this product: a rep
// in London opening the Pacific floor's dashboard should read the floor's hour.
function greeting(name) {
  var hour = 12;
  try {
    hour = parseInt(new Intl.DateTimeFormat('en-US', {
      timeZone: REPORT_TIMEZONE, hour: 'numeric', hour12: false,
    }).format(new Date()), 10);
  } catch (e) { /* a browser without the zone data keeps the neutral default */ }
  var part = hour < 12 ? 'Good morning' : (hour < 17 ? 'Good afternoon' : 'Good evening');
  // No name confirmed yet is not a reason to invent one.
  return name ? (part + ', ' + name) : part;
}

function MetricSection({ title, note, tiles, missing }) {
  return (
    <div className="td-section relative z-10">
      <div className="td-section-h">
        <h3 className="td-section-t">{title}</h3>
        <span className="td-section-rule" />
        {note ? <span className="section-tag">{note}</span> : null}
      </div>
      <div className="td-grid">
        {tiles.map(function(t) {
          /* Figure first, label under it. A tile is read for its number; the
             label is what the number turns out to mean. */
          return (
            <div key={t.label} className="td-tile">
              <p className={'td-tile-v' + (t.tone ? ' ' + t.tone : '')}>{t.value}</p>
              <p className="td-tile-l">{t.label}</p>
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
  var workspaceId = useWorkspace();
  var access = useAccess();
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

  // The headline figures are our own offers. Partner business is somebody
  // else's product sold through this floor — real money, but not this
  // company's revenue — and it has its own tile. The overview carries both
  // splits, so nothing here recomputes anything.
  var partnerCash = displayOverview.partnerCash || 0;
  var partnerCloses = displayOverview.partnerCloses || 0;
  var offerCash = displayOverview.offerCash !== undefined
    ? displayOverview.offerCash
    : (displayOverview.totalCash || displayOverview.totalRevenue || 0);
  var offerCloses = displayOverview.offerCloses !== undefined
    ? displayOverview.offerCloses
    : (displayOverview.totalCloses || 0);
  // Revenue is floored at the cash collected against it, the same rule the
  // closer dashboard follows: revenue is the contract, cash is what was paid.
  var offerRevenue = Math.max(
    offerCash,
    Math.max(0, (displayOverview.totalRevenue || 0) - partnerCash)
  );
  var t = displayOverview;
  // The summary pill says the same thing as the tiles under it. It used to read
  // the combined total, so the header claimed cash the Cash Collected tile did
  // not — the two halves of one screen describing different businesses.
  var todayCash = offerCash;
  var todayCloses = offerCloses;
  var todayDials = t.todayDials || t.totalDials || 0;


  // Compute yesterday's date
  var yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  var yesterdayStr = toReportDay(yesterday);

  // Filter EODs to yesterday
  var m = (liveData && liveData.metrics) || null;
  var c = (m && m.closers) || {};
  var st = (m && m.setters) || {};

  // Where the set count came from. Calls booked land as forms during the day and as
  // an EOD self-report at the end of it, and the tile takes whichever is higher — so
  // when the two disagree it says so, rather than showing a number with no account
  // of itself. A setter looking at "0 sets" after booking four calls this morning was
  // the bug this line exists to make impossible to have silently.
  function setsSource(s) {
    var forms = s.setsFromForms;
    var reported = s.setsReported;
    if (forms === undefined || reported === undefined) {
      return pct(s.conversationToSet) + ' of conversations';
    }
    if (forms !== reported) {
      return num(forms) + ' on forms \u00b7 ' + num(reported) + ' on EODs';
    }
    if (s.conversationToSet === null || s.conversationToSet === undefined) {
      return forms ? 'from booked-call forms' : 'nothing booked yet';
    }
    return pct(s.conversationToSet) + ' of conversations';
  }

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
          <h1 className="font-display text-2xl font-bold text-crm-text-bright">
            {greeting(access && access.name)}
          </h1>
          <p className="text-sm text-crm-text-muted mt-1">
            {new Date().toLocaleDateString('en-US', {
              month: 'long', day: 'numeric', year: 'numeric', timeZone: REPORT_TIMEZONE,
            })}
          </p>
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

      {/* Custom date inputs. The labels carry htmlFor so tapping one focuses its
          field — on a phone the label was previously dead space. The inline
          fontSize is gone too: it fought the deliberate 16px !important rule that
          stops mobile Safari zooming the page on focus. */}
      {dateRange === 'custom' && (
        <div className="flex flex-wrap items-center gap-3 relative z-10">
          <div className="flex items-center gap-2">
            <label htmlFor="dash-from" className="text-xs text-crm-text-muted">From</label>
            <input
              id="dash-from"
              type="date"
              value={customStart}
              onChange={function(e) { setCustomStart(e.target.value); }}
              className="input-field"
              style={{ maxWidth: '170px', padding: '6px 10px' }}
            />
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="dash-to" className="text-xs text-crm-text-muted">To</label>
            <input
              id="dash-to"
              type="date"
              value={customEnd}
              onChange={function(e) { setCustomEnd(e.target.value); }}
              className="input-field"
              style={{ maxWidth: '170px', padding: '6px 10px' }}
            />
          </div>
        </div>
      )}

      {/* ===== THE ONE NUMBER =====
          Cash collected is what the floor is judged on, so it takes the hero slot
          and everything else steps down from it. Revenue sits beside it as a
          secondary figure in a different face and a smaller size: the two used to
          be the same green at the same size with the same subtitle, side by side,
          which left the page with no answer to "which of these two matters". */}
      <div className="dh-band relative z-10 stagger-3">
        <div className="dh-main">
          <p className="dh-l">Cash collected</p>
          <p className="dh-fig mt-2">{money(offerCash)}</p>
          <p className="dh-sub">
            Our offers only &middot; {num(offerCloses)} close{offerCloses === 1 ? '' : 's'} &middot; {rangeLabel.toLowerCase()}
          </p>
          {/* Three measures of this money disagree and the highest wins. Saying so
              directly under the figure is the whole product in one line; it used to
              sit below the fold, under the tiles it was explaining. */}
          <div className="dh-prov-slot">
            <CashProvenance
              start={getDateParams().start}
              end={getDateParams().end}
              workspaceId={workspaceId}
            />
          </div>
        </div>

        <div className="dh-side">
          <div>
            <p className="dh-l">Revenue booked</p>
            <p className="dh-sec-fig">{money(offerRevenue)}</p>
            <p className="dh-sub" style={{ marginTop: '4px' }}>Contracted, cash or not</p>
          </div>
          <div>
            <p className="dh-l">Outbound dials</p>
            <p className="dh-sec-fig">{num(todayDials)}</p>
            <p className="dh-sub" style={{ marginTop: '4px' }}>{num(t.activeClosers || 0)} reps active</p>
          </div>
        </div>
      </div>

      {/* Partner business is somebody else's product sold through this floor: real
          money, but not this company's revenue. It gets its own strip, outside the
          totals, dashed so it cannot be mistaken for one more tile among them.
          Rendered only when there is some, so a workspace that sells no partner
          offers is not handed a permanent zero to explain. */}
      {partnerCash > 0 || partnerCloses > 0 ? (
        <div className="dh-partner relative z-10">
          <div>
            <p className="dh-l">Partner sales</p>
            <p className="dh-sub" style={{ marginTop: '3px' }}>
              Not our offers &mdash; excluded from every figure above
            </p>
          </div>
          <div className="flex gap-8 items-baseline">
            <p className="dh-partner-fig">{money(partnerCash)}</p>
            <p className="dh-partner-fig">
              {num(partnerCloses)} <span className="dh-l" style={{ display: 'inline' }}>close{partnerCloses === 1 ? '' : 's'}</span>
            </p>
          </div>
        </div>
      ) : null}

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
          { label: 'Total sets', value: num(st.sets), sub: setsSource(st) },
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
