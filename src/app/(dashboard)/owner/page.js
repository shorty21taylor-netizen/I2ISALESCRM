'use client';
import { useState, useEffect, useCallback } from 'react';
import { Building2, DollarSign, Wallet, Percent, Layers, RefreshCw } from 'lucide-react';
import { formatCurrency, formatNumber } from '@/lib/utils';

var RANGES = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7 Days' },
  { key: '30d', label: '30 Days' },
  { key: 'mtd', label: 'MTD' },
  { key: 'ytd', label: 'YTD' },
  { key: '365d', label: 'Year' },
];

function rangeParams(key) {
  var today = new Date();
  var todayStr = today.toISOString().split('T')[0];

  function daysAgo(n) {
    var d = new Date(today);
    d.setDate(d.getDate() - n);
    return d.toISOString().split('T')[0];
  }

  if (key === 'today') return { start: todayStr, end: todayStr };
  if (key === '7d') return { start: daysAgo(6), end: todayStr };
  if (key === '30d') return { start: daysAgo(29), end: todayStr };
  if (key === '365d') return { start: daysAgo(364), end: todayStr };
  if (key === 'mtd') return { start: todayStr.substring(0, 8) + '01', end: todayStr };
  if (key === 'ytd') return { start: todayStr.substring(0, 4) + '-01-01', end: todayStr };
  return { start: daysAgo(29), end: todayStr };
}

export default function OwnerPage() {
  var s1 = useState(null), data = s1[0], setData = s1[1];
  var s2 = useState('30d'), range = s2[0], setRange = s2[1];
  // null until the first payload arrives, then a map of offerKey -> included.
  var s3 = useState(null), enabled = s3[0], setEnabled = s3[1];
  var s4 = useState(false), loading = s4[0], setLoading = s4[1];
  var s5 = useState(null), error = s5[0], setError = s5[1];

  var load = useCallback(function() {
    var p = rangeParams(range);
    setLoading(true);
    fetch('/api/owner-dashboard?start=' + p.start + '&end=' + p.end)
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (!d.success) throw new Error(d.error || 'Failed to load');
        setData(d);
        setError(null);
        // Default every offer on, preserving toggles already made.
        setEnabled(function(prev) {
          var next = {};
          (d.offers || []).forEach(function(o) {
            next[o.key] = prev && prev[o.key] !== undefined ? prev[o.key] : true;
          });
          return next;
        });
      })
      .catch(function(e) { setError(e.message); })
      .then(function() { setLoading(false); });
  }, [range]);

  useEffect(function() { load(); }, [load]);

  var offers = (data && data.offers) || [];
  var companies = (data && data.companies) || [];

  function isOn(key) { return !enabled || enabled[key] !== false; }

  function toggle(key) {
    setEnabled(function(prev) {
      var next = {};
      Object.keys(prev || {}).forEach(function(k) { next[k] = prev[k]; });
      next[key] = !isOn(key);
      return next;
    });
  }

  function setAll(value) {
    setEnabled(function() {
      var next = {};
      offers.forEach(function(o) { next[o.key] = value; });
      return next;
    });
  }

  var included = offers.filter(function(o) { return isOn(o.key); });

  var totals = included.reduce(function(acc, o) {
    acc.revenue += o.revenue;
    acc.cashCollected += o.cashCollected;
    acc.commission += o.commission;
    acc.deals += o.deals;
    return acc;
  }, { revenue: 0, cashCollected: 0, commission: 0, deals: 0 });

  var unattributed = companies.reduce(function(sum, c) { return sum + (c.unattributedCash || 0); }, 0);

  var byCompany = companies.map(function(c) {
    var cOffers = included.filter(function(o) { return o.workspaceId === c.workspaceId; });
    return {
      company: c,
      offers: cOffers,
      revenue: cOffers.reduce(function(s, o) { return s + o.revenue; }, 0),
      cashCollected: cOffers.reduce(function(s, o) { return s + o.cashCollected; }, 0),
      commission: cOffers.reduce(function(s, o) { return s + o.commission; }, 0),
      deals: cOffers.reduce(function(s, o) { return s + o.deals; }, 0),
    };
  }).filter(function(c) { return c.offers.length > 0; });

  var maxRevenue = included.reduce(function(m, o) { return Math.max(m, o.revenue); }, 0);

  return (
    <div className="px-4 md:px-6 py-4 md:py-6 space-y-4 md:space-y-6 max-w-[1600px] mx-auto">

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="font-display text-xl md:text-2xl font-bold text-crm-text-bright flex items-center gap-2">
            <Building2 className="w-5 h-5 text-crm-accent" /> Owner View
          </h1>
          <p className="text-xs md:text-sm text-crm-muted mt-1">Every offer you manage, across every workspace</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {RANGES.map(function(r) {
            return (
              <button
                key={r.key}
                onClick={function() { setRange(r.key); }}
                className={'px-3 py-1.5 rounded-lg text-xs font-mono transition-all ' +
                  (range === r.key
                    ? 'text-crm-text-bright border border-crm-accent/40'
                    : 'text-crm-muted border border-crm-border hover:text-crm-text')}
                style={range === r.key ? { background: 'rgba(var(--accent-rgb),0.15)' } : {}}
              >
                {r.label}
              </button>
            );
          })}
          <button onClick={load} className="btn-ghost p-2" aria-label="Refresh">
            <RefreshCw className={'w-3.5 h-3.5 ' + (loading ? 'animate-spin' : '')} />
          </button>
        </div>
      </div>

      {error && <div className="glass-card p-4 text-sm text-crm-negative">Could not load owner data: {error}</div>}

      {/* Combined totals across selected offers */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
        <div className="glass-card-accent p-4 md:p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="icon-box-accent"><DollarSign className="w-5 h-5" /></div>
            <span className="text-[10px] font-mono text-crm-muted uppercase tracking-wider">{included.length} of {offers.length} offers</span>
          </div>
          <div className="metric-value-accent text-2xl md:text-3xl mb-1">{formatCurrency(totals.revenue)}</div>
          <div className="text-[10px] md:text-xs font-mono text-crm-muted uppercase tracking-wider">Combined Revenue</div>
        </div>

        <div className="glass-card p-4 md:p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="icon-box-default"><Wallet className="w-5 h-5" /></div>
            <span className="text-[10px] font-mono text-crm-muted uppercase tracking-wider">{formatNumber(totals.deals)} deals</span>
          </div>
          <div className="metric-value text-2xl md:text-3xl mb-1">{formatCurrency(totals.cashCollected)}</div>
          <div className="text-[10px] md:text-xs font-mono text-crm-muted uppercase tracking-wider">Cash Collected</div>
        </div>

        <div className="glass-card p-4 md:p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="icon-box-default"><Percent className="w-5 h-5" /></div>
            <span className="text-[10px] font-mono text-crm-muted uppercase tracking-wider">Company total</span>
          </div>
          <div className="metric-value text-2xl md:text-3xl mb-1">{formatCurrency(totals.commission)}</div>
          <div className="text-[10px] md:text-xs font-mono text-crm-muted uppercase tracking-wider">Total Commissions</div>
        </div>
      </div>

      {unattributed > 0 && (
        <p className="text-[11px] text-crm-muted">
          {formatCurrency(unattributed)} of EOD cash in this range could not be attributed to a specific offer
          (cash reported with no closed deals to apportion against) and is excluded from the totals above.
        </p>
      )}

      {/* Offer toggles */}
      <div className="glass-card overflow-hidden">
        <div className="section-header">
          <h3><Layers className="w-4 h-4 text-crm-accent" /> Offers</h3>
          <div className="flex items-center gap-2">
            <button onClick={function() { setAll(true); }} className="btn-ghost text-[10px] py-1 px-2">All on</button>
            <button onClick={function() { setAll(false); }} className="btn-ghost text-[10px] py-1 px-2">All off</button>
          </div>
        </div>

        <div className="p-3 md:p-5 space-y-2">
          {offers.length === 0 && !loading && (
            <div className="text-center py-8">
              <Layers className="w-5 h-5 text-crm-muted mx-auto mb-2" />
              <p className="text-sm text-crm-muted">No offer activity in this range</p>
            </div>
          )}

          {offers.map(function(o) {
            var on = isOn(o.key);
            var pct = maxRevenue > 0 ? Math.round((o.revenue / maxRevenue) * 100) : 0;
            return (
              <div key={o.key} className={'glass-surface p-3 md:p-4 transition-opacity ' + (on ? '' : 'opacity-40')}>
                <div className="flex items-center gap-3">
                  <button
                    onClick={function() { toggle(o.key); }}
                    role="switch"
                    aria-checked={on}
                    aria-label={'Include ' + o.offer}
                    className={'relative w-10 h-5 rounded-full flex-shrink-0 transition-colors duration-300 ' + (on ? 'bg-crm-accent' : 'bg-crm-border')}
                  >
                    <div
                      className={'absolute top-0.5 w-4 h-4 rounded-full transition-transform duration-300 ' + (on ? 'translate-x-5' : 'translate-x-0.5')}
                      style={{ background: on ? 'var(--crm-bg)' : 'var(--crm-muted)' }}
                    />
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: o.color }} />
                      <span className="text-sm font-display font-semibold text-crm-text-bright truncate">{o.offer}</span>
                      <span className="section-tag">{o.workspaceName}</span>
                    </div>
                    <div className="text-[10px] md:text-xs text-crm-muted font-mono mt-0.5">
                      {formatNumber(o.deals)} deals &middot; {formatNumber(o.booked)} booked
                    </div>
                  </div>

                  <div className="hidden sm:grid grid-cols-3 gap-4 text-right flex-shrink-0">
                    <div>
                      <div className="text-sm font-display font-semibold text-crm-text-bright">{formatCurrency(o.revenue)}</div>
                      <div className="text-[9px] font-mono text-crm-muted uppercase">Revenue</div>
                    </div>
                    <div>
                      <div className="text-sm font-display font-semibold text-crm-text">{formatCurrency(o.cashCollected)}</div>
                      <div className="text-[9px] font-mono text-crm-muted uppercase">Cash</div>
                    </div>
                    <div>
                      <div className="text-sm font-display font-semibold text-crm-text">{formatCurrency(o.commission)}</div>
                      <div className="text-[9px] font-mono text-crm-muted uppercase">Commission</div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 sm:hidden mt-3 pt-3" style={{ borderTop: '0.5px solid var(--glass-surface-border)' }}>
                  <div>
                    <div className="text-xs font-display font-semibold text-crm-text-bright">{formatCurrency(o.revenue)}</div>
                    <div className="text-[9px] font-mono text-crm-muted uppercase">Revenue</div>
                  </div>
                  <div>
                    <div className="text-xs font-display font-semibold text-crm-text">{formatCurrency(o.cashCollected)}</div>
                    <div className="text-[9px] font-mono text-crm-muted uppercase">Cash</div>
                  </div>
                  <div>
                    <div className="text-xs font-display font-semibold text-crm-text">{formatCurrency(o.commission)}</div>
                    <div className="text-[9px] font-mono text-crm-muted uppercase">Comm.</div>
                  </div>
                </div>

                <div className="progress-bar mt-3">
                  <div className="progress-fill" style={{ width: pct + '%', background: 'linear-gradient(90deg, #d4d4d4, #a3a3a3)' }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Per-company rollup */}
      <div className="glass-card overflow-hidden">
        <div className="section-header">
          <h3><Building2 className="w-4 h-4 text-crm-accent" /> By Company</h3>
          <span className="section-tag">{byCompany.length} active</span>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Offers</th>
                <th className="text-right">Revenue</th>
                <th className="text-right">Cash Collected</th>
                <th className="text-right">Commissions</th>
                <th className="text-right">Deals</th>
              </tr>
            </thead>
            <tbody>
              {byCompany.map(function(c) {
                return (
                  <tr key={c.company.workspaceId}>
                    <td className="text-sm font-medium text-crm-text-bright">{c.company.name}</td>
                    <td className="text-crm-muted font-mono text-xs">{c.offers.length}</td>
                    <td className="text-right font-mono text-crm-text-bright">{formatCurrency(c.revenue)}</td>
                    <td className="text-right font-mono text-crm-text">{formatCurrency(c.cashCollected)}</td>
                    <td className="text-right font-mono text-crm-text">{formatCurrency(c.commission)}</td>
                    <td className="text-right font-mono text-crm-muted">{formatNumber(c.deals)}</td>
                  </tr>
                );
              })}
              {byCompany.length > 0 && (
                <tr>
                  <td className="font-display font-bold text-crm-text-bright">Total</td>
                  <td className="text-crm-muted font-mono text-xs">{included.length}</td>
                  <td className="text-right font-mono font-bold text-crm-text-bright">{formatCurrency(totals.revenue)}</td>
                  <td className="text-right font-mono font-bold text-crm-text-bright">{formatCurrency(totals.cashCollected)}</td>
                  <td className="text-right font-mono font-bold text-crm-text-bright">{formatCurrency(totals.commission)}</td>
                  <td className="text-right font-mono font-bold text-crm-text-bright">{formatNumber(totals.deals)}</td>
                </tr>
              )}
              {byCompany.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-sm text-crm-muted py-8">
                    {loading ? 'Loading…' : 'No offers selected'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
