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
        var claims = {};
        var byEmail = {};

        // Two people can answer to the same name. Rank the claims rather than
        // letting whichever profile happened to load first win: a display name
        // beats an alias, an alias beats a filed name, and between equals the
        // one with a photo wins — since a face is the whole point of the lookup.
        function claim(alias, rep, strength) {
          var key = norm(alias);
          if (!key) return;
          var held = claims[key];
          if (!held
            || strength > held.strength
            || (strength === held.strength && rep.photo && !held.rep.photo)) {
            claims[key] = { rep: rep, strength: strength };
          }
        }

        (d.reps || []).forEach(function(rep) {
          if (rep.email) byEmail[norm(rep.email)] = rep;
          claim(rep.name, rep, 2);
          (rep.names || []).forEach(function(alias) { claim(alias, rep, 1); });
          (rep.aka || []).forEach(function(alias) { claim(alias, rep, 0); });
        });

        var byName = {};
        Object.keys(claims).forEach(function(key) { byName[key] = claims[key].rep; });
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
    // Name first, then email — the same order records are attributed in. The
    // email on a record is ambient (it used to be stamped from whoever was signed
    // in), so a filed name is the more deliberate signal; the email is what
    // catches someone whose profile has since been renamed.
    find: function(name, email) {
      var byName = state.byName[norm(name)];
      if (byName) return byName;
      var k = norm(email || name);
      return state.byEmail[k] || state.byName[k] || null;
    },
  };
}
