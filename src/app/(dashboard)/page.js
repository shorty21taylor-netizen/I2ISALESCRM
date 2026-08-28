'use client';
import { useState, useEffect, useCallback } from 'react';
import { DollarSign, TrendingUp, Phone, PhoneIncoming, Trophy } from 'lucide-react';
import { useWorkspace, withWorkspace, apiFetch } from '@/lib/workspace-client';
import { formatCurrency } from '@/lib/utils';
import { toReportDay } from '@/lib/report-date';

export default function DashboardPage() {
  var workspaceId = useWorkspace();
  var s2 = useState(null), liveData = s2[0], setLiveData = s2[1];
  var s3 = useState('today'), dateRange = s3[0], setDateRange = s3[1];
  var s4 = useState(''), customStart = s4[0], setCustomStart = s4[1];
  var s5 = useState(''), customEnd = s5[0], setCustomEnd = s5[1];
  var s6 = useState(''), lastFetch = s6[0], setLastFetch = s6[1];
  var s7 = useState([]), allEODs = s7[0], setAllEODs = s7[1];

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
    if (dateRange === '7d') {
      var d7 = new Date(today);
      d7.setDate(d7.getDate() - 6);
      return { start: toReportDay(d7), end: todayStr };
    }
    if (dateRange === '30d') {
      var d30 = new Date(today);
      d30.setDate(d30.getDate() - 29);
      return { start: toReportDay(d30), end: todayStr };
    }
    if (dateRange === '365d') {
      var d365 = new Date(today);
      d365.setDate(d365.getDate() - 364);
      return { start: toReportDay(d365), end: todayStr };
    }
    if (dateRange === 'custom' && customStart && customEnd) {
      return { start: customStart, end: customEnd };
    }
    return { start: todayStr, end: todayStr };
  }

  var fetchDashboard = useCallback(function() {
    if (!workspaceId) return; // wait for the active workspace to resolve client-side
    var params = getDateParams();
    var qs = '?start=' + params.start + '&end=' + params.end;
    apiFetch(withWorkspace('/api/dashboard' + qs, workspaceId))
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.success) {
          setLiveData(data);
          setLastFetch(new Date().toISOString());
        }
      })
      .catch(function(e) { console.error('Dashboard fetch error:', e); });

    apiFetch(withWorkspace('/api/webhooks/eod-report', workspaceId))
      .then(function(r) { return r.json(); })
      .then(function(eodsData) {
        setAllEODs((eodsData.data || []).filter(Boolean));
      })
      .catch(function(e) { console.error('EOD fetch error:', e); });
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
  var yesterdayEODs = (allEODs || []).filter(function(e) {
    return e.date === yesterdayStr;
  }).sort(function(a, b) {
    var cashA = (parseFloat(a.cashCollectedMYFM) || 0) + (parseFloat(a.cashCollectedI2I) || 0);
    var cashB = (parseFloat(b.cashCollectedMYFM) || 0) + (parseFloat(b.cashCollectedI2I) || 0);
    return cashB - cashA;
  });

  var rangeLabel = (function() {
    if (dateRange === 'today') return 'Today';
    if (dateRange === 'yesterday') return 'Yesterday';
    if (dateRange === '7d') return '7 Days';
    if (dateRange === '30d') return '30 Days';
    if (dateRange === '365d') return 'Year';
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
            { id: '7d', label: '7 Days' },
            { id: '30d', label: '30 Days' },
            { id: '365d', label: 'Year' },
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

      {/* Offer Breakdown */}
      {t.offerBreakdown && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative z-10 stagger-2">
          {[
            { key: 'myfm', label: 'MYFM', subtitle: 'Coaching', color: '#fafafa', emoji: '🚀' },
            { key: 'i2i-skool', label: 'Skool Sales', subtitle: 'I2I', color: '#d4d4d4', emoji: '🎓' },
            { key: 'i2i-funding', label: 'Funding Program', subtitle: 'I2I', color: '#a3a3a3', emoji: '💰' },
            { key: 'i2i-digital', label: 'Digital Program', subtitle: 'I2I', color: '#a3a3a3', emoji: '💻' },
            { key: 'i2i-inner-circle', label: 'Inner Circle', subtitle: 'I2I', color: '#a3a3a3', emoji: '⭐' },
            { key: 'partner', label: 'Partner', subtitle: 'External', color: '#22c55e', emoji: '🤝' },
          ].map(function(offer) {
            var data = t.offerBreakdown[offer.key] || { booked: 0, closes: 0, revenue: 0 };
            return (
              <div key={offer.key} className="glass-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{offer.emoji}</span>
                    <div>
                      <p className="text-sm font-display font-bold text-crm-text-bright">{offer.label}</p>
                      <p className="text-xs font-mono text-crm-muted">{offer.subtitle}</p>
                    </div>
                  </div>
                  <div className="w-3 h-3 rounded-full" style={{ background: offer.color, boxShadow: '0 0 8px ' + offer.color + '40' }} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="glass-surface p-3 rounded-lg text-center">
                    <p className="text-lg font-display font-bold text-crm-text-bright">{data.booked}</p>
                    <p className="text-[10px] font-mono text-crm-muted">BOOKED</p>
                  </div>
                  <div className="glass-surface p-3 rounded-lg text-center">
                    <p className="text-lg font-display font-bold text-crm-text-bright">{data.closes}</p>
                    <p className="text-[10px] font-mono text-crm-muted">CLOSES</p>
                  </div>
                  <div className="glass-surface p-3 rounded-lg text-center">
                    <p className="text-lg font-display font-bold" style={{ color: 'var(--crm-text-bright)' }}>{formatCurrency(data.revenue)}</p>
                    <p className="text-[10px] font-mono text-crm-muted">REVENUE</p>
                  </div>
                </div>
                {t.totalRevenue > 0 && (
                  <div className="mt-3">
                    <div className="progress-bar">
                      <div className="progress-fill" style={{
                        width: Math.round((data.revenue / t.totalRevenue) * 100) + '%',
                        background: offer.color,
                        boxShadow: '0 0 8px ' + offer.color + '40',
                      }} />
                    </div>
                    <p className="text-[10px] font-mono text-crm-muted mt-1">
                      {Math.round((data.revenue / t.totalRevenue) * 100)}% of total revenue
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Yesterday's EODs — morning review */}
      <div className="glass-card overflow-hidden mt-6 relative z-10 stagger-5">
        <div className="section-header">
          <h3 className="text-sm font-display font-bold" style={{ color: 'var(--crm-text-bright)' }}>Yesterday's EODs</h3>
          <span className="section-tag">{yesterdayEODs.length} {yesterdayEODs.length === 1 ? 'report' : 'reports'}</span>
        </div>

        {yesterdayEODs.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm" style={{ color: 'var(--crm-text-muted)' }}>No EOD reports from yesterday</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--crm-divider)' }}>
            {yesterdayEODs.map(function(eod) {
              var rep = eod.salesRep || eod.closerName || 'Unknown';
              var initials = rep.split(' ').map(function(w) { return w.charAt(0); }).join('').substring(0, 2).toUpperCase();
              var dials = parseInt(eod.outboundDials) || 0;
              var taken = parseInt(eod.callsTaken) || 0;
              var pitched = parseInt(eod.callsTakenAndPitched) || 0;
              var closes = parseInt(eod.closes) || 0;
              var booked = parseInt(eod.netNewCallsBooked) || 0;
              var noShows = parseInt(eod.callsNoShowed) || 0;
              var cashM = parseFloat(eod.cashCollectedMYFM) || 0;
              var cashI = parseFloat(eod.cashCollectedI2I) || 0;
              var totalCash = cashM + cashI;
              var closeRate = pitched > 0 ? Math.min(Math.round((closes / pitched) * 100), 100) : 0;

              return (
                <div key={eod.id} className="p-4 md:p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-display font-bold flex-shrink-0" style={{ background: 'rgba(var(--accent-rgb),0.15)', color: 'var(--crm-accent)' }}>
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-display font-bold truncate" style={{ color: 'var(--crm-text-bright)' }}>{rep}</p>
                      <p className="text-[10px] font-mono" style={{ color: 'var(--crm-text-muted)' }}>
                        {eod.date || 'Yesterday'}
                      </p>
                    </div>
                    {totalCash > 0 && (
                      <span className="text-sm font-display font-bold" style={{ color: '#22c55e' }}>
                        ${totalCash.toLocaleString()}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                    <div className="glass-surface rounded-lg p-2 text-center">
                      <p className="text-sm font-display font-bold" style={{ color: 'var(--crm-text-bright)' }}>{dials}</p>
                      <p className="text-[9px] font-mono uppercase" style={{ color: 'var(--crm-text-muted)' }}>Dials</p>
                    </div>
                    <div className="glass-surface rounded-lg p-2 text-center">
                      <p className="text-sm font-display font-bold" style={{ color: 'var(--crm-text-bright)' }}>{booked}</p>
                      <p className="text-[9px] font-mono uppercase" style={{ color: 'var(--crm-text-muted)' }}>Booked</p>
                    </div>
                    <div className="glass-surface rounded-lg p-2 text-center">
                      <p className="text-sm font-display font-bold" style={{ color: 'var(--crm-text-bright)' }}>{taken}</p>
                      <p className="text-[9px] font-mono uppercase" style={{ color: 'var(--crm-text-muted)' }}>Taken</p>
                    </div>
                    <div className="glass-surface rounded-lg p-2 text-center">
                      <p className="text-sm font-display font-bold" style={{ color: noShows > 0 ? '#ef4444' : 'var(--crm-text-bright)' }}>{noShows}</p>
                      <p className="text-[9px] font-mono uppercase" style={{ color: 'var(--crm-text-muted)' }}>No Shows</p>
                    </div>
                    <div className="glass-surface rounded-lg p-2 text-center">
                      <p className="text-sm font-display font-bold" style={{ color: closes > 0 ? '#22c55e' : 'var(--crm-text-bright)' }}>{closes}</p>
                      <p className="text-[9px] font-mono uppercase" style={{ color: 'var(--crm-text-muted)' }}>Closes</p>
                    </div>
                    <div className="glass-surface rounded-lg p-2 text-center">
                      <p className="text-sm font-display font-bold" style={{ color: closeRate >= 30 ? '#22c55e' : closeRate >= 15 ? '#f59e0b' : 'var(--crm-text-bright)' }}>{closeRate}%</p>
                      <p className="text-[9px] font-mono uppercase" style={{ color: 'var(--crm-text-muted)' }}>Close %</p>
                    </div>
                  </div>

                  {eod.improvementPlan && (
                    <p className="text-xs font-mono mt-3" style={{ color: 'var(--crm-text-muted)' }}>
                      Tomorrow: {eod.improvementPlan}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <hr className="divider" />
      <div className="text-center text-xs text-crm-muted py-4">
        Summit CRM v1.0 &middot; Data refreshes every 30s
        {liveData && liveData.counts ? (
          <span className="ml-3 text-crm-muted/50">
            ({liveData.counts.bookedCalls} bookings, {liveData.counts.closedDeals} deals, {liveData.counts.eodReports} EODs)
          </span>
        ) : null}
      </div>
    </div>
  );
}
