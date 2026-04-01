'use client';
import { useState } from 'react';
import { Users, User, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, AlertTriangle, Lightbulb } from 'lucide-react';
import { formatCurrency, formatPercent, getInitials } from '@/lib/utils';
import { teamOverview, closerPerformances } from '@/lib/mock-data';

export default function ReportsPage() {
  var s = useState('team'), view = s[0], setView = s[1];
  var t = teamOverview;

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-bold text-crm-text-bright">AI Reports</h1>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 glass-surface p-1">
            <button onClick={function() { setView('team'); }} className={'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ' + (view === 'team' ? 'bg-crm-accent/20 text-crm-accent' : 'text-crm-muted hover:text-crm-text')}>
              <Users className="w-4 h-4" /> Team
            </button>
            <button onClick={function() { setView('individual'); }} className={'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ' + (view === 'individual' ? 'bg-crm-accent/20 text-crm-accent' : 'text-crm-muted hover:text-crm-text')}>
              <User className="w-4 h-4" /> Individual
            </button>
          </div>
          <div className="flex items-center gap-2 ml-4">
            <button className="btn-ghost p-2"><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-sm font-mono text-crm-text-bright">Week of Mar 25</span>
            <button className="btn-ghost p-2"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      {view === 'team' ? (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Revenue', value: formatCurrency(t.totalRevenue), trend: t.revenueTrend },
              { label: 'Close Rate', value: t.teamCloseRate + '%', trend: t.closeRateTrend },
              { label: 'Total Closes', value: t.totalCloses, trend: t.closesTrend },
              { label: 'Total Dials', value: t.totalDials, trend: t.dialsTrend },
            ].map(function(m, idx) {
              return (
                <div key={m.label} className={'glass-card p-5 stagger-' + (idx + 1)}>
                  <div className="text-xs font-mono text-crm-muted uppercase tracking-wider mb-2">{m.label}</div>
                  <div className="font-display font-bold text-2xl text-crm-text-bright mb-1">{m.value}</div>
                  <div className={'flex items-center gap-1 text-xs font-mono ' + (m.trend > 0 ? 'metric-positive' : 'metric-negative')}>
                    {m.trend > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {formatPercent(m.trend)} vs last week
                  </div>
                </div>
              );
            })}
          </div>

          {/* Team Diagnostic */}
          <div className="glass-card p-5 stagger-5">
            <div className="section-header -mx-5 -mt-5 mb-4">
              <h3>Team Diagnostic</h3>
              <span className="section-tag" style={{ color: '#dc2626', background: 'rgba(220,38,38,0.08)', borderColor: 'rgba(220,38,38,0.15)' }}>AI</span>
            </div>
            <p className="text-sm text-crm-text leading-relaxed mb-4">
              Strong week overall with revenue up 12.3%. Marcus continues to lead in both volume and conversion.
              Key concern: Derek&apos;s close rate dropped to 24.6% — needs immediate coaching attention.
              Jordan&apos;s show rate at 65.2% is dragging team average. Tanya showing consistent improvement as she transitions to closing role.
            </p>
            <h4 className="text-xs font-mono text-crm-muted uppercase tracking-wider mb-2">Priority Actions</h4>
            <div className="space-y-2">
              {[
                'Schedule 1:1 coaching session with Derek — focus on price objection reframes',
                'Audit Jordan\'s confirmation sequence to improve show rate',
                'Route 2 premium inbound leads to Marcus this week',
                'Have Tanya shadow Marcus on 2 calls for closing technique transfer',
                'Review EOD compliance — 3 missing reports from Jordan this month',
              ].map(function(action, i) {
                return (
                  <div key={i} className="flex items-start gap-2 text-sm text-crm-text">
                    <span className="text-crm-accent font-mono text-xs mt-0.5">{i + 1}.</span>
                    <span>{action}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {closerPerformances.map(function(perf) {
            return (
              <div key={perf.closer.id} className="glass-card p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="avatar avatar-md text-crm-text">
                    {getInitials(perf.closer.name)}
                  </div>
                  <div>
                    <div className="font-medium text-crm-text-bright">{perf.closer.name}</div>
                    <div className="text-xs text-crm-muted capitalize">{perf.closer.role}</div>
                  </div>
                </div>

                <div className="grid grid-cols-5 gap-3 mb-4">
                  {[
                    { label: 'Revenue', value: formatCurrency(perf.totalRevenue), trend: perf.revenueTrend },
                    { label: 'Close Rate', value: perf.closeRate + '%', trend: perf.closeRateTrend },
                    { label: 'Dials', value: perf.totalDials, trend: perf.dialsTrend },
                    { label: 'Connect', value: perf.connectRate + '%' },
                    { label: '$/Dial', value: '$' + perf.revenuePerDial.toFixed(0) },
                  ].map(function(m) {
                    return (
                      <div key={m.label} className="glass-surface p-2">
                        <div className="text-xs text-crm-muted mb-1">{m.label}</div>
                        <div className="font-mono font-bold text-sm text-crm-text-bright">{m.value}</div>
                        {m.trend !== undefined && (
                          <div className={'flex items-center gap-1 text-xs font-mono mt-0.5 ' + (m.trend > 0 ? 'metric-positive' : 'metric-negative')}>
                            {m.trend > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {formatPercent(m.trend)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {perf.funnelBottleneck && (
                  <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-crm-warning/10 border border-crm-warning/20">
                    <AlertTriangle className="w-4 h-4 text-crm-warning" />
                    <span className="text-sm text-crm-warning">{perf.funnelBottleneck}</span>
                  </div>
                )}

                <p className="text-sm text-crm-text mb-3">{perf.aiDiagnostic}</p>

                <div className="space-y-1.5">
                  {perf.aiSuggestions.map(function(s, i) {
                    return (
                      <div key={i} className="flex items-start gap-2 text-sm text-crm-muted">
                        <Lightbulb className="w-4 h-4 text-crm-warning mt-0.5 flex-shrink-0" />
                        <span>{s}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
