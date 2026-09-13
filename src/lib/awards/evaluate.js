// Deciding which awards a rep has earned, and granting the new ones.
//
// Read-only with respect to sales data. This module and everything it calls
// touch deals, EODs and bookings only to count them; the single write is a row
// in rep_awards. addClosedDeal, addEODReport, addBookedCall, recalcOverview and
// registerCloser are untouched and uncalled from here.

import { awardsForTrack } from '@/lib/awards/definitions';
import { computeMetrics, valueFor, unbackedMetrics } from '@/lib/awards/metrics';
import { getRepAwards, grantAward } from '@/lib/store';

// A rep is judged on their own track. Someone who both sets and closes is judged
// as a closer, because that is the board they are ranked on.
//
// The account's role is the answer when there is one. When there is not — a rep
// whose seat predates accounts — their own EODs say what they do, and defaulting
// everyone to closer would hand setters ten awards they can never earn.
export function trackFor(role, eods) {
  var stated = String(role || '').toLowerCase();
  if (stated.indexOf('setter') !== -1) return 'setter';
  if (stated.indexOf('closer') !== -1 || stated.indexOf('admin') !== -1
    || stated.indexOf('manager') !== -1 || stated.indexOf('operator') !== -1) return 'closer';

  var setter = 0, closer = 0;
  (eods || []).forEach(function(e) {
    var r = String(e.role || '').toLowerCase();
    if (r.indexOf('setter') !== -1) setter++;
    else if (r) closer++;
  });
  return setter > closer ? 'setter' : 'closer';
}

function met(award, value) {
  if (value === null || value === undefined) return false;
  return value >= award.threshold;
}

// Everything the panel needs: each award, whether it is held, and how close the
// rep is to the ones they are not.
export function summarise(input) {
  var track = trackFor(input.role, input.eods);
  var metrics = computeMetrics(input);
  var held = getRepAwards(input.email);

  var rows = awardsForTrack(track).map(function(award) {
    var value = valueFor(award, metrics);
    var grant = held[award.id] || null;
    var dark = value === null;
    return {
      id: award.id,
      name: award.name,
      description: award.description,
      rarity: award.rarity,
      icon: award.icon,
      window: award.window,
      threshold: award.threshold,
      metric: award.metric,
      value: value,
      // A dark award has no honest percentage, so it reports none rather than 0.
      percent: dark ? null : Math.min(100, Math.round((value / award.threshold) * 100)),
      dark: dark,
      earned: !!grant,
      awardedAt: grant ? grant.awardedAt : null,
      seenAt: grant ? grant.seenAt : null,
    };
  });

  var earned = rows.filter(function(r) { return r.earned; });
  // "Closest to earning" ignores dark awards — telling someone they are 0% of
  // the way to something we cannot measure is worse than not mentioning it.
  var chasing = rows.filter(function(r) { return !r.earned && !r.dark; })
    .sort(function(a, b) { return b.percent - a.percent; });

  return {
    track: track,
    awards: rows,
    earnedCount: earned.length,
    total: rows.length,
    nextUp: chasing.slice(0, 3),
    unseen: earned.filter(function(r) { return !r.seenAt; })
      .sort(function(a, b) { return String(a.awardedAt).localeCompare(String(b.awardedAt)); }),
    unbacked: unbackedMetrics(metrics),
  };
}

// Grant whatever is newly earned. Idempotent: a second call in a row grants
// nothing, because grantAward refuses an award the rep already holds.
//
// `silent` pre-stamps seenAt, which is what the backfill uses so nobody's first
// login after deploy is a slot machine of medals they earned months ago.
export function evaluateAwards(input, options) {
  var opts = options || {};
  var track = trackFor(input.role, input.eods);
  var metrics = computeMetrics(input);
  var held = getRepAwards(input.email);
  var granted = [];

  awardsForTrack(track).forEach(function(award) {
    if (held[award.id]) return;
    var value = valueFor(award, metrics);
    if (!met(award, value)) return;
    var row = grantAward(input.email, award.id, {
      progress: value,
      seenAt: opts.silent ? new Date().toISOString() : null,
    });
    if (row) granted.push(award.id);
  });

  return { granted: granted, unbacked: unbackedMetrics(metrics) };
}
