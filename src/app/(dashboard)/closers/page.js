'use client';
import { useState } from 'react';
import { Search, TrendingUp, TrendingDown, AlertTriangle, Lightbulb } from 'lucide-react';
import { formatCurrency, formatPercent, getInitials } from '@/lib/utils';
import { closers, closerPerformances, recentCalls } from '@/lib/mock-data';

export default function ClosersPage() {
  var s1 = useState(''), search = s1[0], setSearch = s1[1];
  var s2 = useState(closers[0].id), selectedId = s2[0], setSelectedId = s2[1];

  var filtered = closers.filter(function(c) { return c.name.toLowerCase().includes(search.toLowerCase()); });
  var selectedPerf = closerPerformances.find(function(p) { return p.closer.id === selectedId; });
  var selectedCalls = recentCalls.filter(function(c) { return c.closerId === selectedId; });

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <div className="page-header mb-6 -mx-6 -mt-6 px-6 py-4">
        <h1 className="font-display text-2xl font-bold text-crm-text-bright">Closers</h1>
      </div>
      <div className="grid grid-cols-3 gap-6">
        {/* Left - Closer List */}
        <div className="glass-card overflow-hidden">
          <div className="p-4">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-crm-muted" />
              <input
                type="text"
                placeholder="Search closers..."
                value={search}
                onChange={function(e) { setSearch(e.target.value); }}
                className="input-field pl-10"
              />
            </div>
            <div className="space-y-1">
              {filtered.map(function(c) {
                var perf = closerPerformances.find(function(p) { return p.closer.id === c.id; });
                return (
                  <button
                    key={c.id}
                    onClick={function() { setSelectedId(c.id); }}
                    className={'w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all duration-200 ' + (selectedId === c.id ? 'bg-crm-accent/10 border border-crm-accent/20' : 'hover:bg-white/[0.03]')}
                  >
                    <div className={'avatar avatar-md ' + (selectedId === c.id ? 'bg-crm-accent/10 text-crm-accent' : 'text-crm-text')}>
                      {getInitials(c.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-crm-text-bright truncate">{c.name}</div>
                      <div className="text-xs text-crm-muted capitalize">{c.role}</div>
                    </div>
                    {perf && (
                      <span className="text-xs font-mono text-crm-positive">{formatCurrency(perf.totalRevenue)}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right - Detail Panel */}
        <div className="col-span-2 space-y-4">
          {selectedPerf ? (
            <>
              <div className="glass-card-accent p-5 stagger-1">
                <div className="flex items-center gap-3 mb-4">
                  <div className="avatar avatar-lg bg-crm-accent/10 text-crm-accent">
                    {getInitials(selectedPerf.closer.name)}
                  </div>
                  <div>
                    <h2 className="font-display text-xl font-bold text-crm-text-bright">{selectedPerf.closer.name}</h2>
                    <p className="text-sm text-crm-muted capitalize">{selectedPerf.closer.role} &middot; {selectedPerf.closer.email}</p>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4">
                  {[
                    { label: 'Revenue', value: formatCurrency(selectedPerf.totalRevenue), trend: selectedPerf.revenueTrend },
                    { label: 'Close Rate', value: selectedPerf.closeRate + '%', trend: selectedPerf.closeRateTrend },
                    { label: 'Total Dials', value: selectedPerf.totalDials, trend: selectedPerf.dialsTrend },
                    { label: 'Avg Deal', value: formatCurrency(selectedPerf.avgDealValue) },
                  ].map(function(m) {
                    return (
                      <div key={m.label} className="glass-surface p-3">
                        <div className="text-xs font-mono text-crm-muted uppercase tracking-wider mb-1">{m.label}</div>
                        <div className="font-display font-bold text-lg text-crm-text-bright">{m.value}</div>
                        {m.trend !== undefined && (
                          <div className={'flex items-center gap-1 text-xs font-mono mt-1 ' + (m.trend > 0 ? 'metric-positive' : 'metric-negative')}>
                            {m.trend > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {formatPercent(m.trend)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Funnel */}
              <div className="glass-card p-5 stagger-2">
                <h3 className="text-sm font-mono text-crm-muted uppercase tracking-wider mb-4">Sales Funnel</h3>
                <div className="space-y-3">
                  {[
                    { label: 'Connect Rate', value: selectedPerf.connectRate, max: 50 },
                    { label: 'Book Rate', value: (1 / selectedPerf.dialToBookRatio) * 100, max: 30 },
                    { label: 'Show Rate', value: selectedPerf.showRate, max: 100 },
                    { label: 'Close Rate', value: selectedPerf.closeRate, max: 50 },
                  ].map(function(step) {
                    var pct = Math.min((step.value / step.max) * 100, 100);
                    var fillClass = step.value / step.max > 0.6 ? 'progress-fill-green' : step.value / step.max > 0.3 ? 'progress-fill-amber' : 'progress-fill-red';
                    return (
                      <div key={step.label}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-crm-muted">{step.label}</span>
                          <span className="font-mono text-crm-text-bright">{step.value.toFixed(1)}%</span>
                        </div>
                        <div className="progress-bar h-2">
                          <div className={'progress-fill ' + fillClass} style={{ width: pct + '%' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* AI Diagnostic */}
              <div className="glass-card p-5 stagger-3">
                <h3 className="text-sm font-mono text-crm-muted uppercase tracking-wider mb-3">AI Diagnostic</h3>
                {selectedPerf.funnelBottleneck && (
                  <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-crm-warning/10 border border-crm-warning/20">
                    <AlertTriangle className="w-4 h-4 text-crm-warning" />
                    <span className="text-sm text-crm-warning">{selectedPerf.funnelBottleneck}</span>
                  </div>
                )}
                <p className="text-sm text-crm-text mb-3">{selectedPerf.aiDiagnostic}</p>
                <div className="space-y-2">
                  {selectedPerf.aiSuggestions.map(function(s, i) {
                    return (
                      <div key={i} className="flex items-start gap-2 text-sm text-crm-muted">
                        <Lightbulb className="w-4 h-4 text-crm-warning mt-0.5 flex-shrink-0" />
                        <span>{s}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Recent Calls */}
              {selectedCalls.length > 0 && (
                <div className="glass-card p-5 stagger-4">
                  <h3 className="text-sm font-mono text-crm-muted uppercase tracking-wider mb-3">Recent Calls</h3>
                  <div className="space-y-2">
                    {selectedCalls.map(function(call) {
                      return (
                        <div key={call.id} className="flex items-center gap-3 p-3 glass-surface">
                          <span className="text-sm text-crm-text-bright">{call.leadName}</span>
                          <span className={'badge ' + (call.outcome === 'closed' ? 'badge-positive' : 'badge-negative')}>{call.outcome}</span>
                          {call.dealValue && <span className="text-sm font-mono text-crm-positive">{formatCurrency(call.dealValue)}</span>}
                          <span className="text-xs font-mono text-crm-muted ml-auto">Score: {call.aiScorecard.overallScore}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="glass-card p-10 text-center text-crm-muted">Select a closer to view details</div>
          )}
        </div>
      </div>
    </div>
  );
}
