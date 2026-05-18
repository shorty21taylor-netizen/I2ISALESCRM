'use client';

import { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, ScatterChart, Scatter, PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import ClientOnly from '@/components/ClientOnly';
import { formatCurrency } from '@/lib/utils';

export default function AnalyticsPage() {
  var [data, setData] = useState(null);
  var [loading, setLoading] = useState(true);
  var [dateRange, setDateRange] = useState('30');

  useEffect(function() { fetchData(); }, [dateRange]);

  async function fetchData() {
    setLoading(true);
    try {
      var end = new Date();
      var start = new Date();
      start.setDate(start.getDate() - parseInt(dateRange));

      var [dashRes, eodsRes, dealsRes, bookedRes] = await Promise.all([
        fetch('/api/dashboard?start=' + start.toISOString().split('T')[0] + '&end=' + end.toISOString().split('T')[0]),
        fetch('/api/webhooks/eod-report'),
        fetch('/api/webhooks/close-deal'),
        fetch('/api/webhooks/book-call'),
      ]);

      var dash = await dashRes.json();
      var eods = await eodsRes.json();
      var deals = await dealsRes.json();
      var booked = await bookedRes.json();

      var startStr = start.toISOString().split('T')[0];
      var endStr = end.toISOString().split('T')[0];

      var rangeEODs = (eods.data || []).filter(function(e) {
        var d = e.date || (e.submittedAt ? e.submittedAt.split('T')[0] : '');
        return d >= startStr && d <= endStr;
      });

      var rangeDeals = (deals.data || []).filter(function(d) {
        var dt = d.submittedAt ? d.submittedAt.split('T')[0] : '';
        return dt >= startStr && dt <= endStr;
      });

      var rangeBooked = (booked.data || []).filter(function(b) {
        var dt = b.submittedAt ? b.submittedAt.split('T')[0] : '';
        return dt >= startStr && dt <= endStr;
      });

      setData({
        overview: dash.overview || {},
        closers: (dash.closers || []).filter(Boolean),
        eods: rangeEODs,
        deals: rangeDeals,
        booked: rangeBooked,
        startStr: startStr,
        endStr: endStr,
        days: parseInt(dateRange),
      });
    } catch (e) { console.error('[Analytics]', e); }
    setLoading(false);
  }

  function n(v) { return parseFloat(v) || parseInt(v) || 0; }
  function sum(arr, field) { return arr.reduce(function(s, x) { return s + n(x[field]); }, 0); }
  function pct(num, den) { return den > 0 ? Math.min(Math.round((num / den) * 1000) / 10, 100) : 0; }

  if (loading || !data) return <div className="px-4 md:px-8 py-6 text-sm font-mono" style={{ color: 'var(--crm-text-muted)' }}>Loading analytics...</div>;

  var e = data.eods;
  var totalDials = sum(e, 'outboundDials');
  var totalCallsBooked = sum(e, 'netNewCallsBooked');
  var totalCallsOnCalendar = sum(e, 'callsOnCalendar');
  var totalCallsTaken = sum(e, 'callsTaken');
  var totalNoShowed = sum(e, 'callsNoShowed');
  var totalCanceled = sum(e, 'callsCanceled');
  var totalRescheduled = sum(e, 'callsRescheduled');
  var totalPitched = sum(e, 'callsTakenAndPitched');
  var totalCloses = sum(e, 'closes');
  var totalCashMYFM = sum(e, 'cashCollectedMYFM');
  var totalCashI2I = sum(e, 'cashCollectedI2I');
  var totalRevenue = totalCashMYFM + totalCashI2I;
  var dealCash = data.deals.reduce(function(s, d) { return s + n(d.cashCollected); }, 0);
  var daysReported = new Set(e.map(function(x) { return x.date; })).size;

  var closeRate = pct(totalCloses, totalPitched);
  var showRate = pct(totalCallsTaken, totalCallsOnCalendar);
  var noShowRate = pct(totalNoShowed, totalCallsOnCalendar);
  var dialToBookRate = pct(totalCallsBooked, totalDials);
  var pitchRate = pct(totalPitched, totalCallsTaken);
  var overallConversion = pct(totalCloses, totalDials);
  var avgDialsPerDay = daysReported > 0 ? Math.round(totalDials / daysReported) : 0;
  var avgCallsPerDay = daysReported > 0 ? Math.round(totalCallsTaken / daysReported) : 0;
  var avgDealSize = data.deals.length > 0 ? Math.round(dealCash / data.deals.length) : 0;
  var cashPerCall = totalCallsTaken > 0 ? Math.round(dealCash / totalCallsTaken) : 0;
  var cashPerDial = totalDials > 0 ? Math.round((dealCash / totalDials) * 100) / 100 : 0;
  var cancelRate = pct(totalCanceled, totalCallsOnCalendar);

  // Build daily trend data
  var dailyMap = {};
  e.forEach(function(eod) {
    var d = eod.date;
    if (!d) return;
    if (!dailyMap[d]) dailyMap[d] = { date: d, dials: 0, taken: 0, pitched: 0, closes: 0, noShows: 0, booked: 0, revenue: 0 };
    dailyMap[d].dials += n(eod.outboundDials);
    dailyMap[d].taken += n(eod.callsTaken);
    dailyMap[d].pitched += n(eod.callsTakenAndPitched);
    dailyMap[d].closes += n(eod.closes);
    dailyMap[d].noShows += n(eod.callsNoShowed);
    dailyMap[d].booked += n(eod.netNewCallsBooked);
    dailyMap[d].revenue += n(eod.cashCollectedMYFM) + n(eod.cashCollectedI2I);
  });
  var dailyTrend = Object.values(dailyMap).sort(function(a, b) { return a.date > b.date ? 1 : -1; }).map(function(d) {
    d.label = new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return d;
  });

  // Close rate by closer
  var closerMap = {};
  e.forEach(function(eod) {
    var name = eod.salesRep || eod.closerName || 'Unknown';
    if (!closerMap[name]) closerMap[name] = { name: name, dials: 0, taken: 0, pitched: 0, closes: 0, revenue: 0, noShows: 0, booked: 0, days: 0 };
    closerMap[name].dials += n(eod.outboundDials);
    closerMap[name].taken += n(eod.callsTaken);
    closerMap[name].pitched += n(eod.callsTakenAndPitched);
    closerMap[name].closes += n(eod.closes);
    closerMap[name].noShows += n(eod.callsNoShowed);
    closerMap[name].booked += n(eod.netNewCallsBooked);
    closerMap[name].revenue += n(eod.cashCollectedMYFM) + n(eod.cashCollectedI2I);
    closerMap[name].days++;
  });
  var closerData = Object.values(closerMap).map(function(c) {
    c.closeRate = pct(c.closes, c.pitched);
    c.showRate = c.taken > 0 ? pct(c.taken, c.taken + c.noShows) : 0;
    c.avgDials = c.days > 0 ? Math.round(c.dials / c.days) : 0;
    return c;
  }).sort(function(a, b) { return b.revenue - a.revenue; });

  // Revenue by source
  var inboundRev = data.deals.filter(function(d) { return (d.outboundInbound || '').toLowerCase() === 'inbound'; }).reduce(function(s, d) { return s + n(d.cashCollected); }, 0);
  var outboundRev = dealCash - inboundRev;

  // Revenue by program
  var byProgram = {};
  data.deals.forEach(function(d) {
    var p = d.program || 'Unknown';
    if (!byProgram[p]) byProgram[p] = { name: p, count: 0, revenue: 0 };
    byProgram[p].count++;
    byProgram[p].revenue += n(d.cashCollected);
  });
  var programData = Object.values(byProgram).sort(function(a, b) { return b.revenue - a.revenue; });

  // Funnel data
  var funnelData = [
    { stage: 'Dials', value: totalDials },
    { stage: 'Booked', value: totalCallsBooked },
    { stage: 'On Calendar', value: totalCallsOnCalendar },
    { stage: 'Taken', value: totalCallsTaken },
    { stage: 'Pitched', value: totalPitched },
    { stage: 'Closed', value: totalCloses },
  ];

  var COLORS = ['#22c55e', '#3b82f6', '#8b5cf6', '#f59e0b', '#dc2626', '#06b6d4'];
  var tooltipStyle = { background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fafafa', fontSize: '12px' };

  function MetricTile({ label, value, sub, color }) {
    return (
      <div className="glass-card p-3 md:p-4">
        <p className="text-lg md:text-xl font-display font-bold" style={{ color: color || 'var(--crm-text-bright)' }}>{value}</p>
        <p className="text-[10px] font-mono uppercase" style={{ color: 'var(--crm-text-muted)' }}>{label}</p>
        {sub && <p className="text-[9px] font-mono mt-0.5" style={{ color: 'var(--crm-text-muted)' }}>{sub}</p>}
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="page-header py-4 md:py-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-display font-bold" style={{ color: 'var(--crm-text-bright)' }}>Analytics</h1>
            <p className="text-xs font-mono" style={{ color: 'var(--crm-text-muted)' }}>Deep-dive into every sales metric</p>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {['7', '14', '30', '60', '90'].map(function(d) {
              return (
                <button key={d} onClick={function() { setDateRange(d); }}
                  className={'px-3 py-1.5 rounded-lg text-xs font-mono ' + (dateRange === d ? 'text-crm-accent font-bold' : 'text-crm-muted')}
                  style={dateRange === d ? { background: 'rgba(220,38,38,0.1)' } : {}}
                >{d}d</button>
              );
            })}
          </div>
        </div>
      </header>

      <div className="px-4 md:px-8 pb-8">

        {/* CALL METRICS */}
        <h2 className="text-sm font-display font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--crm-accent)' }}>Call Metrics</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
          <MetricTile label="Outbound Dials" value={totalDials.toLocaleString()} />
          <MetricTile label="Calls Booked" value={totalCallsBooked} />
          <MetricTile label="On Calendar" value={totalCallsOnCalendar} />
          <MetricTile label="Calls Taken" value={totalCallsTaken} />
          <MetricTile label="No Shows" value={totalNoShowed} color="#ef4444" />
          <MetricTile label="Canceled" value={totalCanceled} color="#ef4444" />
          <MetricTile label="Rescheduled" value={totalRescheduled} color="#f59e0b" />
          <MetricTile label="Pitched" value={totalPitched} />
          <MetricTile label="Closes" value={totalCloses} color="#22c55e" />
          <MetricTile label="Avg Dials/Day" value={avgDialsPerDay} sub={daysReported + ' days reported'} />
          <MetricTile label="Avg Calls/Day" value={avgCallsPerDay} />
          <MetricTile label="Days Reported" value={daysReported} />
        </div>

        {/* RATES */}
        <h2 className="text-sm font-display font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--crm-accent)' }}>Conversion Rates</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
          <MetricTile label="Close Rate" value={closeRate + '%'} sub="closes / pitched" color="#22c55e" />
          <MetricTile label="Show Rate" value={showRate + '%'} sub="taken / calendar" />
          <MetricTile label="No-Show Rate" value={noShowRate + '%'} sub="no shows / calendar" color="#ef4444" />
          <MetricTile label="Dial → Book" value={dialToBookRate + '%'} sub="booked / dials" />
          <MetricTile label="Pitch Rate" value={pitchRate + '%'} sub="pitched / taken" />
          <MetricTile label="Cancel Rate" value={cancelRate + '%'} sub="canceled / calendar" color="#f59e0b" />
          <MetricTile label="Overall Conv." value={overallConversion + '%'} sub="closes / dials" />
        </div>

        {/* REVENUE */}
        <h2 className="text-sm font-display font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--crm-accent)' }}>Revenue</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
          <MetricTile label="Total Revenue" value={formatCurrency(Math.max(totalRevenue, dealCash))} color="#22c55e" />
          <MetricTile label="Cash MYFM" value={formatCurrency(totalCashMYFM)} color="#3b82f6" />
          <MetricTile label="Cash I2I" value={formatCurrency(totalCashI2I)} color="#8b5cf6" />
          <MetricTile label="Deal Cash" value={formatCurrency(dealCash)} sub={data.deals.length + ' deals'} />
          <MetricTile label="Avg Deal Size" value={formatCurrency(avgDealSize)} />
          <MetricTile label="Cash / Call" value={formatCurrency(cashPerCall)} sub="per call taken" />
          <MetricTile label="Cash / Dial" value={'$' + cashPerDial.toFixed(2)} sub="per outbound dial" />
          <MetricTile label="Inbound Rev" value={formatCurrency(inboundRev)} color="#22c55e" />
          <MetricTile label="Outbound Rev" value={formatCurrency(outboundRev)} color="#dc2626" />
        </div>

        {/* CONVERSION FUNNEL CHART */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <div className="glass-card overflow-hidden">
            <div className="section-header"><h3>Conversion Funnel</h3></div>
            <div className="p-4 h-72">
              <ClientOnly>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={funnelData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis type="number" stroke="#6b6b6b" tick={{ fontSize: 10 }} />
                    <YAxis dataKey="stage" type="category" stroke="#6b6b6b" tick={{ fontSize: 11 }} width={90} />
                    <Tooltip contentStyle={tooltipStyle} formatter={function(v) { return [v.toLocaleString(), 'Count']; }} />
                    <Bar dataKey="value" fill="#dc2626" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ClientOnly>
            </div>
          </div>

          {/* Revenue by Program */}
          <div className="glass-card overflow-hidden">
            <div className="section-header"><h3>Revenue by Program</h3></div>
            <div className="p-4 h-72">
              <ClientOnly>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={programData} cx="50%" cy="50%" outerRadius={80} dataKey="revenue"
                      label={function(entry) { return entry.name.substring(0, 12) + ': $' + entry.revenue.toLocaleString(); }}>
                      {programData.map(function(x, i) { return <Cell key={i} fill={COLORS[i % COLORS.length]} />; })}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={function(v) { return ['$' + v.toLocaleString(), 'Revenue']; }} />
                  </PieChart>
                </ResponsiveContainer>
              </ClientOnly>
            </div>
          </div>
        </div>

        {/* DAILY TRENDS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {/* Dials + Calls Trend */}
          <div className="glass-card overflow-hidden">
            <div className="section-header"><h3>Daily Activity</h3></div>
            <div className="p-4 h-72">
              <ClientOnly>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="label" stroke="#6b6b6b" tick={{ fontSize: 9 }} />
                    <YAxis stroke="#6b6b6b" tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Area type="monotone" dataKey="dials" stroke="#dc2626" fill="rgba(220,38,38,0.1)" name="Dials" />
                    <Area type="monotone" dataKey="taken" stroke="#3b82f6" fill="rgba(59,130,246,0.1)" name="Taken" />
                    <Area type="monotone" dataKey="closes" stroke="#22c55e" fill="rgba(34,197,94,0.1)" name="Closes" />
                    <Legend wrapperStyle={{ fontSize: '10px' }} />
                  </AreaChart>
                </ResponsiveContainer>
              </ClientOnly>
            </div>
          </div>

          {/* Revenue Trend */}
          <div className="glass-card overflow-hidden">
            <div className="section-header"><h3>Revenue Trend</h3></div>
            <div className="p-4 h-72">
              <ClientOnly>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="label" stroke="#6b6b6b" tick={{ fontSize: 9 }} />
                    <YAxis stroke="#6b6b6b" tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={tooltipStyle} formatter={function(v) { return ['$' + v.toLocaleString(), 'Revenue']; }} />
                    <Line type="monotone" dataKey="revenue" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </ClientOnly>
            </div>
          </div>
        </div>

        {/* CLOSER COMPARISON */}
        <h2 className="text-sm font-display font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--crm-accent)' }}>Closer Comparison</h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {/* Close Rate by Closer */}
          <div className="glass-card overflow-hidden">
            <div className="section-header"><h3>Close Rate by Closer</h3></div>
            <div className="p-4 h-72">
              <ClientOnly>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={closerData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="name" stroke="#6b6b6b" tick={{ fontSize: 9 }} />
                    <YAxis stroke="#6b6b6b" tick={{ fontSize: 10 }} unit="%" />
                    <Tooltip contentStyle={tooltipStyle} formatter={function(v) { return [v + '%', 'Close Rate']; }} />
                    <Bar dataKey="closeRate" fill="#dc2626" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ClientOnly>
            </div>
          </div>

          {/* Dials vs Revenue Scatter */}
          <div className="glass-card overflow-hidden">
            <div className="section-header"><h3>Effort vs Revenue</h3></div>
            <div className="p-4 h-72">
              <ClientOnly>
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="dials" name="Dials" stroke="#6b6b6b" tick={{ fontSize: 10 }} />
                    <YAxis dataKey="revenue" name="Revenue" stroke="#6b6b6b" tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={tooltipStyle} formatter={function(v, name) { return [name === 'Revenue' ? '$' + v.toLocaleString() : v.toLocaleString(), name]; }} />
                    <Scatter data={closerData} fill="#dc2626" />
                  </ScatterChart>
                </ResponsiveContainer>
              </ClientOnly>
            </div>
          </div>
        </div>

        {/* CLOSER TABLE */}
        <div className="glass-card overflow-hidden mb-6">
          <div className="section-header"><h3>Closer Breakdown</h3></div>
          <div className="table-scroll">
            <table className="data-table w-full min-w-[800px]">
              <thead>
                <tr>
                  <th className="text-left px-3 py-2 text-[10px] font-mono uppercase" style={{ color: 'var(--crm-text-muted)' }}>Closer</th>
                  <th className="text-right px-2 py-2 text-[10px] font-mono uppercase" style={{ color: 'var(--crm-text-muted)' }}>Dials</th>
                  <th className="text-right px-2 py-2 text-[10px] font-mono uppercase" style={{ color: 'var(--crm-text-muted)' }}>Dials/Day</th>
                  <th className="text-right px-2 py-2 text-[10px] font-mono uppercase" style={{ color: 'var(--crm-text-muted)' }}>Booked</th>
                  <th className="text-right px-2 py-2 text-[10px] font-mono uppercase" style={{ color: 'var(--crm-text-muted)' }}>Taken</th>
                  <th className="text-right px-2 py-2 text-[10px] font-mono uppercase" style={{ color: 'var(--crm-text-muted)' }}>No Shows</th>
                  <th className="text-right px-2 py-2 text-[10px] font-mono uppercase" style={{ color: 'var(--crm-text-muted)' }}>Pitched</th>
                  <th className="text-right px-2 py-2 text-[10px] font-mono uppercase" style={{ color: 'var(--crm-text-muted)' }}>Closes</th>
                  <th className="text-right px-2 py-2 text-[10px] font-mono uppercase" style={{ color: 'var(--crm-text-muted)' }}>Close %</th>
                  <th className="text-right px-2 py-2 text-[10px] font-mono uppercase" style={{ color: 'var(--crm-text-muted)' }}>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {closerData.map(function(c) {
                  return (
                    <tr key={c.name} className="border-t" style={{ borderColor: 'var(--crm-divider)' }}>
                      <td className="px-3 py-2.5 text-sm font-display font-medium" style={{ color: 'var(--crm-text-bright)' }}>{c.name}</td>
                      <td className="text-right px-2 py-2.5 text-sm font-mono" style={{ color: 'var(--crm-text)' }}>{c.dials.toLocaleString()}</td>
                      <td className="text-right px-2 py-2.5 text-sm font-mono" style={{ color: 'var(--crm-text)' }}>{c.avgDials}</td>
                      <td className="text-right px-2 py-2.5 text-sm font-mono" style={{ color: 'var(--crm-text)' }}>{c.booked}</td>
                      <td className="text-right px-2 py-2.5 text-sm font-mono" style={{ color: 'var(--crm-text)' }}>{c.taken}</td>
                      <td className="text-right px-2 py-2.5 text-sm font-mono" style={{ color: '#ef4444' }}>{c.noShows}</td>
                      <td className="text-right px-2 py-2.5 text-sm font-mono" style={{ color: 'var(--crm-text)' }}>{c.pitched}</td>
                      <td className="text-right px-2 py-2.5 text-sm font-mono" style={{ color: '#22c55e' }}>{c.closes}</td>
                      <td className="text-right px-2 py-2.5 text-sm font-mono font-bold" style={{ color: c.closeRate >= 30 ? '#22c55e' : c.closeRate >= 15 ? '#f59e0b' : '#ef4444' }}>{c.closeRate}%</td>
                      <td className="text-right px-2 py-2.5 text-sm font-mono font-bold" style={{ color: '#22c55e' }}>{formatCurrency(c.revenue)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* No Shows Trend */}
        <div className="glass-card overflow-hidden">
          <div className="section-header"><h3>No-Shows &amp; Cancellations Trend</h3></div>
          <div className="p-4 h-64">
            <ClientOnly>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="label" stroke="#6b6b6b" tick={{ fontSize: 9 }} />
                  <YAxis stroke="#6b6b6b" tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={tooltipStyle} formatter={function(v) { return [v, 'Count']; }} />
                  <Bar dataKey="noShows" fill="#ef4444" radius={[4, 4, 0, 0]} name="No Shows" />
                  <Bar dataKey="booked" fill="#22c55e" radius={[4, 4, 0, 0]} name="Booked" />
                  <Legend wrapperStyle={{ fontSize: '10px' }} />
                </BarChart>
              </ResponsiveContainer>
            </ClientOnly>
          </div>
        </div>

      </div>
    </div>
  );
}
