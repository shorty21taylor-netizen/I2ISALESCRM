'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/workspace-client';

function norm(v) {
  return String(v || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function initialsOf(name) {
  return String(name || '?')
    .split(' ')
    .map(function(w) { return w.charAt(0); })
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

// The floor's faces, for any screen that lists people by name.
//
// Rows on a leaderboard or an EOD log are keyed by whatever name was filed, not
// by an account, so the lookup is built from every name a rep's records go under
// — the same match set their own totals are computed from. A rep whose face this
// cannot find falls back to initials, which is what every one of these lists
// showed before.
export default function useRoster() {
  var [state, setState] = useState({ ready: false, byName: {}, byEmail: {}, reps: [] });

  useEffect(function() {
    var cancelled = false;
    apiFetch('/api/roster')
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (cancelled || !d || !d.success) { if (!cancelled) setState(function(s) { return Object.assign({}, s, { ready: true }); }); return; }
        var byName = {};
        var byEmail = {};
        (d.reps || []).forEach(function(rep) {
          if (rep.email) byEmail[norm(rep.email)] = rep;
          byName[norm(rep.name)] = rep;
          (rep.names || []).forEach(function(alias) {
            // First writer wins: a real display name should not be displaced by
            // an alias that happens to collide.
            if (!byName[norm(alias)]) byName[norm(alias)] = rep;
          });
        });
        setState({ ready: true, byName: byName, byEmail: byEmail, reps: d.reps || [] });
      })
      .catch(function() {
        if (!cancelled) setState(function(s) { return Object.assign({}, s, { ready: true }); });
      });
    return function() { cancelled = true; };
  }, []);

  return {
    ready: state.ready,
    reps: state.reps,
    find: function(nameOrEmail) {
      var k = norm(nameOrEmail);
      if (!k) return null;
      return state.byEmail[k] || state.byName[k] || null;
    },
  };
}
