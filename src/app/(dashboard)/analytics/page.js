'use client';
import { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, ScatterChart, Scatter, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import ClientOnly from '@/components/ClientOnly';
import { TrendingUp, Target, Activity, GitBranch, Filter } from 'lucide-react';
import { useWorkspace, withWorkspace } from '@/lib/workspace-client';
import { formatCurrency } from '@/lib/utils';
import EmptyState from '@/components/EmptyState';

function ChartTooltip(props) {
  if (!props.active || !props.payload || !props.payload.length) return null;
  return (
    <div style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '8px 12px' }}>
      <p className="text-xs font-mono text-crm-muted mb-1">{props.label}</p>
      {props.payload.map(function(entry, i) {
        return (
          <p key={i} className="text-xs text-crm-text-bright">
            <span style={{ color: entry.color }}>{entry.name}: </span>
            {typeof entry.value === 'number' && entry.value > 100 ? formatCurrency(entry.value) : entry.value}
          </p>
        );
      })}
    </div>
  );
}

export default function AnalyticsPage() {
  var s1 = useState(null), data = s1[0], setData = s1[1];
  var s2 = useState(true), loading = s2[0], setLoading = s2[1];

  var workspaceId = useWorkspace();

  useEffect(function() {
    if (!workspaceId) return;
    fetchAll();
    var interval = setInterval(fetchAll, 60000);
    return function() { clearInterval(interval); };
  }, [workspaceId]);

  function fetchAll() {
    var today = new Date();
    var twoWeeksAgo = new Date(today);
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 13);
    var start = twoWeeksAgo.toISOString().split('T')[0];
    var end = today.toISOString().split('T')[0];

    Promise.all([
      fetch(withWorkspace('/api/dashboard?start=' + start + '&end=' + end, workspaceId)).then(function(r) { return r.json(); }),
      fetch(withWorkspace('/api/webhooks/eod-report', workspaceId)).then(function(r) { return r.json(); }),
      fetch(withWorkspace('/api/webhooks/close-deal', workspaceId)).then(function(r) { return r.json(); }),
    ]).then(function(results) {
      var dash = results[0];
      var eods = results[1];
      var deals = results[2];
      setData({
        overview: dash.overview || {},
        closers: (dash.closers || []).filter(Boolean),
        eodReports: (eods.data || []).filter(Boolean),
        closedDeals: (deals.data || []).filter(Boolean),
      });
      setLoading(false);
    }).catch(function(e) {
      console.error('[Analytics]', e);
      setLoading(false);
    });
  }

  if (loading || !data) {
    return (
      <div className="px-4 md:px-8 py-6">
        <h1 className="font-display text-2xl font-bold text-crm-text-bright mb-6">Analytics</h1>
        <div className="text-sm text-crm-muted font-mono">Loading analytics...</div>
      </div>
    );
  }

  // Build Revenue Trend (last 14 days)
  var revenueTrend = [];
  for (var i = 13; i >= 0; i--) {
    var d = new Date();
    d.setDate(d.getDate() - i);
    var dateStr = d.toISOString().split('T')[0];
    var dayRevenue = data.eodReports.filter(function(e) { return e.date === dateStr; }).reduce(function(s, e) {
      return s + (parseFloat(e.cashCollectedMYFM) || 0) + (parseFloat(e.cashCollectedI2I) || 0);
    }, 0);
    revenueTrend.push({
      date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      revenue: Math.round(dayRevenue),
    });
  }

  // Close Rate by Closer
  var closeRateByCloser = data.closers.map(function(c) {
    var cr = c.pitched > 0 ? Math.min(Math.round((c.closes / c.pitched) * 1000) / 10, 100) : 0;
    return { name: (c.name || 'Unknown').split(' ')[0], closeRate: cr, closes: c.closes || 0 };
  }).filter(function(c) { return c.name !== 'Unknown'; }).sort(function(a, b) { return b.closeRate - a.closeRate; });

  // Dials vs Revenue scatter
  var dialsVsRevenue = data.closers.map(function(c) {
    return { name: c.name, dials: c.dials || 0, revenue: c.cash || c.revenue || 0 };
  }).filter(function(c) { return c.dials > 0 || c.revenue > 0; });

  // Revenue by Source
  var inboundRev = data.closedDeals.filter(function(dl) {
    return ((dl.outboundInbound || dl.leadSource || '').toLowerCase()) === 'inbound';
  }).reduce(function(s, dl) { return s + (parseFloat(dl.cashCollected) || 0); }, 0);
  var outboundRev = data.closedDeals.reduce(function(s, dl) { return s + (parseFloat(dl.cashCollected) || 0); }, 0) - inboundRev;

  var sourceData = [
    { name: 'Inbound', value: Math.round(inboundRev) },
    { name: 'Outbound', value: Math.round(outboundRev) },
  ];

  // Conversion Funnel
  var totalDials = data.eodReports.reduce(function(s, e) { return s + (parseInt(e.outboundDials) || 0); }, 0);
  var totalBooked = data.eodReports.reduce(function(s, e) { return s + (parseInt(e.netNewCallsBooked) || 0); }, 0);
  var totalTaken = data.eodReports.reduce(function(s, e) { return s + (parseInt(e.callsTaken) || 0); }, 0);
  var totalPitched = data.eodReports.reduce(function(s, e) { return s + (parseInt(e.callsTakenAndPitched) || 0); }, 0);
  var totalCloses = data.eodReports.reduce(function(s, e) { return s + (parseInt(e.closes) || 0); }, 0);

  var funnelData = [
    { stage: 'Dials', value: totalDials },
    { stage: 'Booked', value: totalBooked },
    { stage: 'Taken', value: totalTaken },
    { stage: 'Pitched', value: totalPitched },
    { stage: 'Closed', value: totalCloses },
  ];

  var COLORS = ['#22c55e', '#8a8a8a'];
  var hasRevenue = revenueTrend.some(function(r) { return r.revenue > 0; });
  var hasFunnel = totalDials > 0;

  return (
    <div className="px-4 md:px-6 py-4 md:py-6 max-w-[1600px] mx-auto">
      <h1 className="font-display text-2xl font-bold text-crm-text-bright mb-6">Analytics</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* Revenue Trend */}
        <div className="glass-card overflow-hidden stagger-1">
          <div className="section-header">
            <h3><TrendingUp className="w-4 h-4 text-crm-accent" /> Revenue Trend</h3>
            <span className="section-tag">14 Days</span>
          </div>
          {!hasRevenue ? (
            <EmptyState icon={TrendingUp} title="No revenue data yet" subtitle="Revenue will appear as EOD reports are submitted" />
          ) : (
            <div className="p-4 h-[280px]">
              <ClientOnly>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={revenueTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="date" stroke="#6b6b6b" tick={{ fontSize: 10 }} />
                    <YAxis stroke="#6b6b6b" tick={{ fontSize: 10 }} />
                    <Tooltip content={ChartTooltip} />
                    <Line type="monotone" dataKey="revenue" stroke="#22c55e" strokeWidth={2} dot={{ fill: '#22c55e', r: 3 }} name="Revenue" />
                  </LineChart>
                </ResponsiveContainer>
              </ClientOnly>
            </div>
          )}
        </div>

        {/* Close Rate by Closer */}
        <div className="glass-card overflow-hidden stagger-2">
          <div className="section-header">
            <h3><Target className="w-4 h-4 text-crm-accent" /> Close Rate by Closer</h3>
            <span className="section-tag">Comparison</span>
          </div>
          {closeRateByCloser.length === 0 ? (
            <EmptyState icon={Target} title="No close rate data yet" subtitle="Appears when closers submit EOD reports" />
          ) : (
            <div className="p-4 h-[280px]">
              <ClientOnly>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={closeRateByCloser}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="name" stroke="#6b6b6b" tick={{ fontSize: 10 }} />
                    <YAxis stroke="#6b6b6b" tick={{ fontSize: 10 }} unit="%" />
                    <Tooltip content={ChartTooltip} />
                    <Bar dataKey="closeRate" fill="#a3a3a3" radius={[4, 4, 0, 0]} name="Close Rate" />
                  </BarChart>
                </ResponsiveContainer>
              </ClientOnly>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* Dials vs Revenue Scatter */}
        <div className="glass-card overflow-hidden stagger-3">
          <div className="section-header">
            <h3><Activity className="w-4 h-4 text-crm-accent" /> Dials vs Revenue</h3>
            <span className="section-tag">Scatter</span>
          </div>
          {dialsVsRevenue.length === 0 ? (
            <EmptyState icon={Activity} title="No dial/revenue data yet" subtitle="Appears when closers have performance data" />
          ) : (
            <div className="p-4 h-[280px]">
              <ClientOnly>
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="dials" name="Dials" stroke="#6b6b6b" tick={{ fontSize: 10 }} />
                    <YAxis dataKey="revenue" name="Revenue" stroke="#6b6b6b" tick={{ fontSize: 10 }} />
                    <Tooltip content={ChartTooltip} cursor={{ strokeDasharray: '3 3' }} />
                    <Scatter data={dialsVsRevenue} fill="#a3a3a3" name="Closer" />
                  </ScatterChart>
                </ResponsiveContainer>
              </ClientOnly>
            </div>
          )}
        </div>

        {/* Revenue by Source */}
        <div className="glass-card overflow-hidden stagger-4">
          <div className="section-header">
            <h3><Filter className="w-4 h-4 text-crm-accent" /> Revenue by Source</h3>
            <span className="section-tag">Split</span>
          </div>
          {sourceData[0].value === 0 && sourceData[1].value === 0 ? (
            <EmptyState icon={Filter} title="No source data yet" subtitle="Appears as deals are closed" />
          ) : (
            <div className="p-4 h-[280px]">
              <ClientOnly>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={sourceData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={function(entry) { return entry.name + ': $' + entry.value.toLocaleString(); }}>
                      {sourceData.map(function(entry, idx) { return <Cell key={'c-' + idx} fill={COLORS[idx]} />; })}
                    </Pie>
                    <Tooltip content={ChartTooltip} />
                  </PieChart>
                </ResponsiveContainer>
              </ClientOnly>
            </div>
          )}
        </div>
      </div>

      {/* Conversion Funnel — full width */}
      <div className="glass-card overflow-hidden stagger-5">
        <div className="section-header">
          <h3><GitBranch className="w-4 h-4 text-crm-accent" /> Conversion Funnel</h3>
          <span className="section-tag">Full Pipeline</span>
        </div>
        {!hasFunnel ? (
          <EmptyState icon={GitBranch} title="No funnel data yet" subtitle="Funnel stages populate as dials and closes are recorded" />
        ) : (
          <div className="p-4 h-[240px]">
            <ClientOnly>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={funnelData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis type="number" stroke="#6b6b6b" tick={{ fontSize: 10 }} />
                  <YAxis dataKey="stage" type="category" stroke="#6b6b6b" tick={{ fontSize: 11 }} width={70} />
                  <Tooltip content={ChartTooltip} />
                  <Bar dataKey="value" fill="#a3a3a3" radius={[0, 4, 4, 0]} name="Count" />
                </BarChart>
              </ResponsiveContainer>
            </ClientOnly>
          </div>
        )}
      </div>
    </div>
  );
}
