'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { DollarSign, Percent, Wallet, PiggyBank, Check, AlertTriangle } from 'lucide-react';
import { apiFetch } from '@/lib/workspace-client';
import { computeOperator, clampRate } from '@/lib/operator';

// The operator's pay, sitting under the portfolio rollup. Toggling a workspace
// recomputes in the browser from deals already fetched — waiting on a round trip
// to find out what turning a client off does to your take-home makes the question
// too expensive to ask twice.

function money(n) {
  return (Number(n) || 0).toLocaleString('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  });
}

function pctLabel(rate) {
  var p = (Number(rate) || 0) * 100;
  return (Math.round(p * 100) / 100) + '%';
}

function Card({ icon: Icon, label, value, sub, accent }) {
  return (
    <div className={accent ? 'glass-card-accent p-4 md:p-5' : 'glass-card p-4 md:p-5'}>
      <div className="flex items-center justify-between mb-3">
        <div className={accent ? 'icon-box-accent' : 'icon-box-default'}><Icon className="w-5 h-5" /></div>
        {sub ? (
          <span className="text-[10px] font-mono text-crm-muted uppercase tracking-wider">{sub}</span>
        ) : null}
      </div>
      <div className={(accent ? 'metric-value-accent' : 'metric-value') + ' text-2xl md:text-3xl mb-1'}>{value}</div>
      <div className="text-[10px] md:text-xs font-mono text-crm-muted uppercase tracking-wider">{label}</div>
    </div>
  );
}

export default function OperatorPL({ start, end }) {
  var s1 = useState(null), config = s1[0], setConfig = s1[1];
  var s2 = useState([]), deals = s2[0], setDeals = s2[1];
  var s3 = useState(''), me = s3[0], setMe = s3[1];
  var s4 = useState(''), error = s4[0], setError = s4[1];
  var s5 = useState(''), toast = s5[0], setToast = s5[1];
  var s6 = useState(false), loading = s6[0], setLoading = s6[1];
  var s7 = useState({}), draft = s7[0], setDraft = s7[1];

  var timer = useRef(null);
  var latest = useRef(null);

  var load = useCallback(function () {
    if (!start || !end) return;
    setLoading(true);
    apiFetch('/api/operator?start=' + start + '&end=' + end)
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d.success) throw new Error(d.error || 'Failed to load');
        setConfig(d.config);
        setDeals(d.deals || []);
        setMe(d.myName || '');
        setError('');
      })
      .catch(function (e) { setError(e.message); })
      .then(function () { setLoading(false); });
  }, [start, end]);

  useEffect(function () { load(); }, [load]);

  // Debounced so dragging through four toggles is one write, not four.
  function persist(next) {
    latest.current = next;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(function () {
      apiFetch('/api/operator?start=' + start + '&end=' + end, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(latest.current),
      })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (!d.success) throw new Error(d.error || 'Save failed');
          if (d.persisted === false) {
            setToast('Saved for now — it did not reach the database');
          } else {
            setToast('Saved');
          }
          setTimeout(function () { setToast(''); }, 2200);
        })
        .catch(function (e) {
          setError(e.message);
          // Put back what the server actually holds rather than leaving a number
          // on screen that nothing agrees with.
          load();
        });
    }, 600);
  }

  function update(next) {
    setConfig(next);
    persist(next);
  }

  function toggleWorkspace(id) {
    if (!config) return;
    update(Object.assign({}, config, {
      workspaces: (config.workspaces || []).map(function (w) {
        return w.id === id ? Object.assign({}, w, { enabled: !(w.enabled !== false) }) : w;
      }),
    }));
  }

  function toggleOffer(key) {
    if (!config) return;
    var offers = Object.assign({}, config.offers);
    var o = Object.assign({}, offers[key]);
    o.enabled = !(o.enabled !== false);
    offers[key] = o;
    update(Object.assign({}, config, { offers: offers }));
  }

  function commitRate(key, percentText) {
    if (!config) return;
    var p = parseFloat(percentText);
    if (!isFinite(p)) p = 0;
    if (p < 0) p = 0;
    if (p > 100) p = 100;
    var offers = Object.assign({}, config.offers);
    offers[key] = Object.assign({}, offers[key], { overrideRate: clampRate(p / 100) });
    var next = Object.assign({}, config, { offers: offers });
    var d = Object.assign({}, draft); delete d[key]; setDraft(d);
    update(next);
  }

  function commitPersonal(percentText) {
    if (!config) return;
    var p = parseFloat(percentText);
    if (!isFinite(p)) p = 0;
    if (p < 0) p = 0;
    if (p > 100) p = 100;
    var d = Object.assign({}, draft); delete d.__personal; setDraft(d);
    update(Object.assign({}, config, { personalRate: clampRate(p / 100) }));
  }

  if (error && !config) {
    return <div className="glass-card p-4 text-sm text-crm-negative">Could not load your P&amp;L: {error}</div>;
  }
  if (!config) {
    return <div className="glass-card p-6 text-sm text-crm-muted">{loading ? 'Loading your P&L…' : ''}</div>;
  }

  var c = computeOperator(deals, config, me);
  var wsName = {};
  (c.workspaces || []).forEach(function (w) { wsName[w.id] = w.name; });

  var totals = (c.rows || []).reduce(function (a, r) {
    a.cash += r.offerCash;
    a.override += r.overrideEarnings;
    a.mine += r.myCloseCash;
    a.comm += r.myCommission;
    return a;
  }, { cash: 0, override: 0, mine: 0, comm: 0 });

  return (
    <div className="space-y-4 md:space-y-6">

      <div className="flex items-center justify-between">
        <h2 className="font-display text-base md:text-lg font-bold text-crm-text-bright">Your P&amp;L</h2>
        {toast ? (
          <span className="text-[11px] font-mono text-crm-muted flex items-center gap-1">
            <Check className="w-3 h-3" /> {toast}
          </span>
        ) : null}
      </div>

      {error ? (
        <div className="glass-card p-3 text-xs text-crm-negative flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5" /> {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
        <Card icon={DollarSign} label="Portfolio Cash Collected" value={money(c.portfolioCash)}
          sub={c.workspacesActive + ' of ' + c.workspacesTotal + ' workspaces active'} />
        <Card icon={Percent} label="My Override" value={money(c.totalOverride)} />
        <Card icon={Wallet} label="My Closing Commission" value={money(c.totalMyCommission)}
          sub={pctLabel(c.personalRate)} />
        <Card icon={PiggyBank} label="Total Take-Home" value={money(c.totalTakeHome)} accent />
      </div>

      {/* ---- workspace rail ---- */}
      <div className="glass-card p-4">
        <p className="text-[10px] font-mono text-crm-muted uppercase tracking-wider mb-3">Workspaces</p>
        <div className="flex flex-wrap gap-2">
          {(c.workspaces || []).filter(Boolean).map(function (w) {
            return (
              <button
                key={w.id}
                onClick={function () { toggleWorkspace(w.id); }}
                className="px-3 py-2 rounded-lg border border-crm-border text-left transition-all hover:border-crm-accent/40"
                style={{ opacity: w.enabled ? 1 : 0.5 }}
              >
                <span className="block text-xs text-crm-text-bright">{w.name}</span>
                <span className="block text-[10px] font-mono text-crm-muted">
                  {money(w.cash)} · {w.enabled ? 'on' : 'off'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ---- offer table ---- */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] font-mono text-crm-muted uppercase tracking-wider">
                <th className="text-left p-3">Offer</th>
                <th className="text-left p-3">Workspace</th>
                <th className="text-center p-3">On</th>
                <th className="text-right p-3">Cash Collected</th>
                <th className="text-right p-3">Override %</th>
                <th className="text-right p-3">Override $</th>
                <th className="text-right p-3">My Closes $</th>
                <th className="text-right p-3">My Commission $</th>
              </tr>
            </thead>
            <tbody>
              {(c.rows || []).filter(Boolean).map(function (r) {
                var shown = draft[r.key] !== undefined
                  ? draft[r.key]
                  : String(Math.round((r.rate || 0) * 10000) / 100);
                return (
                  <tr key={r.key} className="border-t border-crm-border/40" style={{ opacity: r.active ? 1 : 0.5 }}>
                    <td className="p-3 text-crm-text-bright">{r.label}</td>
                    <td className="p-3 text-crm-muted text-xs">{wsName[r.workspaceId] || r.workspaceId}</td>
                    <td className="p-3 text-center">
                      <input type="checkbox" checked={r.enabled} onChange={function () { toggleOffer(r.key); }} />
                    </td>
                    <td className="p-3 text-right font-mono">{money(r.offerCash)}</td>
                    <td className="p-3 text-right">
                      <input
                        type="number" step="0.5" min="0" max="100"
                        className="w-20 bg-transparent border border-crm-border rounded px-2 py-1 text-right font-mono text-xs"
                        value={shown}
                        onChange={function (e) {
                          var d = Object.assign({}, draft); d[r.key] = e.target.value; setDraft(d);
                        }}
                        onBlur={function (e) { commitRate(r.key, e.target.value); }}
                        onKeyDown={function (e) { if (e.key === 'Enter') e.target.blur(); }}
                      />
                    </td>
                    <td className="p-3 text-right font-mono">{r.active ? money(r.overrideEarnings) : '$0'}</td>
                    <td className="p-3 text-right font-mono text-crm-muted">{money(r.myCloseCash)}</td>
                    <td className="p-3 text-right font-mono">{r.active ? money(r.myCommission) : '$0'}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-crm-border text-crm-text-bright font-mono">
                <td className="p-3" colSpan={3}>Total</td>
                <td className="p-3 text-right">{money(totals.cash)}</td>
                <td className="p-3" />
                <td className="p-3 text-right">{money(totals.override)}</td>
                <td className="p-3 text-right">{money(totals.mine)}</td>
                <td className="p-3 text-right">{money(totals.comm)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ---- settings ---- */}
      <div className="glass-card p-4 border border-crm-border space-y-3">
        <p className="text-[10px] font-mono text-crm-muted uppercase tracking-wider">Settings</p>

        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs text-crm-text">My closing commission rate</label>
          <input
            type="number" step="0.5" min="0" max="100"
            className="w-24 bg-transparent border border-crm-border rounded px-2 py-1 text-right font-mono text-xs"
            value={draft.__personal !== undefined ? draft.__personal : String(Math.round((c.personalRate || 0) * 10000) / 100)}
            onChange={function (e) { var d = Object.assign({}, draft); d.__personal = e.target.value; setDraft(d); }}
            onBlur={function (e) { commitPersonal(e.target.value); }}
            onKeyDown={function (e) { if (e.key === 'Enter') e.target.blur(); }}
          />
          <span className="text-xs text-crm-muted">%</span>
        </div>

        <label className="flex items-start gap-2 text-xs text-crm-text cursor-pointer">
          <input
            type="checkbox"
            checked={!!config.excludeOwnClosesFromOverride}
            onChange={function () {
              update(Object.assign({}, config, {
                excludeOwnClosesFromOverride: !config.excludeOwnClosesFromOverride,
              }));
            }}
          />
          <span>
            Exclude my own closes from the override base
            <span className="block text-[11px] text-crm-muted">
              Off means you earn the override on your own deals on top of the closing commission.
            </span>
          </span>
        </label>
      </div>
    </div>
  );
}
