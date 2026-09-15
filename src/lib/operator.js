// The operator's own P&L: what the portfolio collected, what the override on it
// comes to, and what was earned closing personally.
//
// Two things here are deliberate and easy to get wrong later.
//
// First, a workspace is a real workspace — the same tenant every other page means
// by the word. An earlier draft invented one synthetic workspace per offer name,
// which would have put a second, disagreeing list of "workspaces" in front of the
// one person who most needs the real one.
//
// Second, an offer belongs to the workspace its deals were filed in, not to a
// global program list. Two clients both selling "Mentorship" are two offers with
// two rates, because they are two businesses.

import { toReportDay } from '@/lib/report-date';

export var DEFAULT_OPERATOR_CONFIG = {
  workspaces: [],                      // [{ id, name, enabled }]
  offers: {},                          // { [key]: { workspaceId, program, label, enabled, overrideRate } }
  personalRate: 0.10,                  // the operator's own closing commission
  excludeOwnClosesFromOverride: true,  // no override on top of your own commission
};

function norm(s) {
  return String(s === null || s === undefined ? '' : s).trim().toLowerCase();
}

function num(v) {
  var n = Number(v);
  return isFinite(n) ? n : 0;
}

// Rates live as decimals and are shown as percents. Anything outside 0–1 is a
// mis-parse — a 5 that meant 5% would otherwise pay out five times the cash.
export function clampRate(v) {
  var n = num(v);
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

export function dealWorkspace(deal) {
  return (deal && deal.workspaceId) || 'default';
}

export function offerKeyFor(deal) {
  return dealWorkspace(deal) + '::' + norm(deal && deal.program);
}

function labelFor(program) {
  var p = String(program === null || program === undefined ? '' : program).trim();
  return p || 'Unlabelled';
}

// Deals filed in the window, as the page counts days: Pacific, on submittedAt.
// It is submittedAt and not createdAt — closed deals carry no createdAt, and a
// filter on a field that does not exist silently matches nothing.
export function dealsInRange(deals, start, end) {
  return (deals || []).filter(Boolean).filter(function (d) {
    var day = toReportDay(d.submittedAt);
    if (!day) return false;
    if (start && day < start) return false;
    if (end && day > end) return false;
    return true;
  });
}

// Add anything newly seen; never overwrite a rate or a toggle already set. A
// config that reset itself on every deploy would quietly stop paying an override.
export function seedConfig(existing, deals, workspaces) {
  var cfg = {
    workspaces: [],
    offers: {},
    personalRate: DEFAULT_OPERATOR_CONFIG.personalRate,
    excludeOwnClosesFromOverride: DEFAULT_OPERATOR_CONFIG.excludeOwnClosesFromOverride,
  };
  if (existing && typeof existing === 'object') {
    if (Array.isArray(existing.workspaces)) cfg.workspaces = existing.workspaces.slice();
    if (existing.offers && typeof existing.offers === 'object') {
      Object.keys(existing.offers).forEach(function (k) { cfg.offers[k] = existing.offers[k]; });
    }
    if (existing.personalRate !== undefined) cfg.personalRate = clampRate(existing.personalRate);
    if (existing.excludeOwnClosesFromOverride !== undefined) {
      cfg.excludeOwnClosesFromOverride = !!existing.excludeOwnClosesFromOverride;
    }
  }

  var known = {};
  cfg.workspaces.forEach(function (w) { if (w && w.id) known[w.id] = w; });

  (workspaces || []).filter(Boolean).forEach(function (w) {
    if (!w.id) return;
    if (known[w.id]) {
      // Keep the toggle; follow a rename made elsewhere.
      known[w.id].name = w.name || known[w.id].name || w.id;
      return;
    }
    var row = { id: w.id, name: w.name || w.id, enabled: true };
    known[w.id] = row;
    cfg.workspaces.push(row);
  });

  (deals || []).filter(Boolean).forEach(function (d) {
    var wsId = dealWorkspace(d);
    if (!known[wsId]) {
      var row = { id: wsId, name: wsId, enabled: true };
      known[wsId] = row;
      cfg.workspaces.push(row);
    }
    var key = offerKeyFor(d);
    if (!cfg.offers[key]) {
      cfg.offers[key] = {
        workspaceId: wsId,
        program: String(d.program || ''),
        label: labelFor(d.program),
        enabled: true,
        overrideRate: 0,
      };
    }
  });

  return cfg;
}

// One pass over the window's deals. Everything the page shows comes from here, so
// a toggle flipped in the browser can recompute without another round trip.
export function computeOperator(deals, config, myName) {
  var cfg = seedConfig(config, [], []);
  var onWs = {};
  (cfg.workspaces || []).forEach(function (w) {
    if (w && w.enabled !== false) onWs[w.id] = true;
  });

  var me = norm(myName);
  var byKey = {};

  (deals || []).filter(Boolean).forEach(function (d) {
    var key = offerKeyFor(d);
    if (!byKey[key]) byKey[key] = { offerCash: 0, myCloseCash: 0, deals: 0, myDeals: 0 };
    var cash = num(d.cashCollected);
    byKey[key].offerCash += cash;
    byKey[key].deals += 1;
    // The closer is matched by name, which is how every other figure in this CRM
    // attributes a deal. An email match would miss a deal a manager filed for you.
    if (me && norm(d.closer) === me) {
      byKey[key].myCloseCash += cash;
      byKey[key].myDeals += 1;
    }
  });

  // Offers that appear in the window but not yet in the config still have to show,
  // or cash would vanish from the portfolio total until someone pressed save.
  Object.keys(byKey).forEach(function (key) {
    if (cfg.offers[key]) return;
    var parts = key.split('::');
    cfg.offers[key] = {
      workspaceId: parts[0] || 'default',
      program: parts[1] || '',
      label: labelFor(parts[1]),
      enabled: true,
      overrideRate: 0,
    };
  });

  var rows = Object.keys(cfg.offers).map(function (key) {
    var o = cfg.offers[key] || {};
    var agg = byKey[key] || { offerCash: 0, myCloseCash: 0, deals: 0, myDeals: 0 };
    var wsId = o.workspaceId || 'default';
    var active = o.enabled !== false && !!onWs[wsId];
    var base = cfg.excludeOwnClosesFromOverride
      ? agg.offerCash - agg.myCloseCash
      : agg.offerCash;
    if (base < 0) base = 0;
    var rate = clampRate(o.overrideRate);

    return {
      key: key,
      label: o.label || labelFor(o.program),
      program: o.program || '',
      workspaceId: wsId,
      enabled: o.enabled !== false,
      active: active,
      rate: rate,
      deals: agg.deals,
      myDeals: agg.myDeals,
      offerCash: agg.offerCash,
      myCloseCash: agg.myCloseCash,
      overrideBase: base,
      overrideEarnings: active ? base * rate : 0,
      myCommission: active ? agg.myCloseCash * clampRate(cfg.personalRate) : 0,
    };
  }).sort(function (a, b) { return b.offerCash - a.offerCash; });

  var on = rows.filter(function (r) { return r.active; });
  var sum = function (list, field) {
    return list.reduce(function (s, r) { return s + r[field]; }, 0);
  };

  var totalOverride = sum(on, 'overrideEarnings');
  var totalMyCommission = sum(on, 'myCommission');

  // Cash per workspace, including the ones switched off — the rail shows what a
  // workspace contributes so the decision to exclude it is an informed one.
  var perWorkspace = {};
  rows.forEach(function (r) {
    if (!perWorkspace[r.workspaceId]) perWorkspace[r.workspaceId] = { cash: 0, deals: 0 };
    perWorkspace[r.workspaceId].cash += r.offerCash;
    perWorkspace[r.workspaceId].deals += r.deals;
  });

  return {
    rows: rows,
    workspaces: (cfg.workspaces || []).map(function (w) {
      var agg = perWorkspace[w.id] || { cash: 0, deals: 0 };
      return {
        id: w.id, name: w.name || w.id, enabled: w.enabled !== false,
        cash: agg.cash, deals: agg.deals,
      };
    }),
    workspacesActive: (cfg.workspaces || []).filter(function (w) { return w.enabled !== false; }).length,
    workspacesTotal: (cfg.workspaces || []).length,
    portfolioCash: sum(on, 'offerCash'),
    totalOverride: totalOverride,
    totalMyCommission: totalMyCommission,
    totalTakeHome: totalOverride + totalMyCommission,
    personalRate: clampRate(cfg.personalRate),
    excludeOwnClosesFromOverride: !!cfg.excludeOwnClosesFromOverride,
  };
}

// What the POST is allowed to store. Anything not named here is dropped rather
// than persisted, so a stray field from a future UI cannot quietly become config.
export function sanitizeConfig(body, knownWorkspaceIds) {
  var known = {};
  (knownWorkspaceIds || []).forEach(function (id) { known[id] = true; });

  var out = {
    workspaces: [],
    offers: {},
    personalRate: clampRate(body && body.personalRate),
    excludeOwnClosesFromOverride: !(body && body.excludeOwnClosesFromOverride === false),
  };

  var seen = {};
  ((body && body.workspaces) || []).filter(Boolean).forEach(function (w) {
    var id = String(w.id || '').trim();
    if (!id || seen[id]) return;
    seen[id] = true;
    out.workspaces.push({
      id: id,
      name: String(w.name || id).slice(0, 120),
      enabled: w.enabled !== false,
    });
  });

  var offers = (body && body.offers) || {};
  Object.keys(offers).forEach(function (key) {
    var o = offers[key] || {};
    var wsId = String(o.workspaceId || '').trim() || 'default';
    // An offer pointed at a workspace that no longer exists would be invisible and
    // uncountable; it goes back to 'default' where it can at least be seen.
    if (Object.keys(known).length && !known[wsId] && !seen[wsId]) wsId = 'default';
    out.offers[String(key)] = {
      workspaceId: wsId,
      program: String(o.program || ''),
      label: String(o.label || '').slice(0, 120) || 'Unlabelled',
      enabled: o.enabled !== false,
      overrideRate: clampRate(o.overrideRate),
    };
  });

  return out;
}
