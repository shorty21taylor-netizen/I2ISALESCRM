'use client';

import { useState, useEffect } from 'react';

// Who filed it: picked off the roster rather than typed.
//
// Every one of these fields was a free-text box, and a name typed into a free-text
// box is the thing every total in this product is keyed on. "Ernest Simon",
// "ernest simon", "Ernest" and "Ernst Simon" are four reps to the leaderboard, to
// the commission run and to repIdentity(). Picking from the roster means the
// string filed is the string the roster holds, every time.
//
// It is NOT a closed list. There is always an escape hatch, for three reasons
// this floor actually hits: a rep added through Team & Permissions does not always
// get a profile, so they can be missing from the roster for a day; a guest or a
// partner's closer takes calls without ever being on it; and a correction to an
// old record names somebody who has since left. Refusing to let a real deal be
// filed because the roster is stale is a worse failure than an unlisted name —
// nothing is being routed off this field, so there is nothing to fail closed on.
//
// A value that is not on the roster opens in the text box already, so a name
// auto-filled from a login that nobody has made a profile for is still shown
// rather than silently blanked.

function norm(v) { return String(v || '').trim().toLowerCase().replace(/\s+/g, ' '); }

var OTHER = '__other__';

export default function RepPicker({
  id, value, onChange, reps, ready, placeholder, required, allowOther,
}) {
  var list = (reps || []).filter(function(r) { return r && r.name && !r.archived; });

  // Deduplicate by name: two profiles answering to the same name would otherwise
  // give the dropdown two identical rows and no way to tell them apart.
  var seen = {};
  var names = [];
  list.forEach(function(r) {
    var k = norm(r.name);
    if (!k || seen[k]) return;
    seen[k] = true;
    names.push(r.name);
  });
  names.sort(function(a, b) { return a.localeCompare(b); });

  var onRoster = names.some(function(n) { return norm(n) === norm(value); });
  var s = useState(false), typing = s[0], setTyping = s[1];

  // A value the roster does not hold opens in the text box. Waits for `ready`,
  // or every field would flip to "someone else" for the moment before the roster
  // lands and then jump back under the person's cursor.
  useEffect(function() {
    if (!ready) return;
    if (value && !onRoster) setTyping(true);
  }, [ready, value, onRoster]);

  if (typing) {
    return (
      <div className="rp">
        <input
          id={id} type="text" value={value || ''} required={required}
          onChange={function(e) { onChange(e.target.value); }}
          className="input-field" placeholder="Type their name"
          autoComplete="off"
        />
        {names.length ? (
          <button type="button" className="rp-back" onClick={function() {
            setTyping(false);
            if (!onRoster) onChange('');
          }}>
            Pick from the roster instead
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rp">
      <select
        id={id} value={onRoster ? value : ''} required={required}
        className="input-field"
        onChange={function(e) {
          var picked = e.target.value;
          if (picked === OTHER) { setTyping(true); onChange(''); return; }
          onChange(picked);
        }}
      >
        <option value="">
          {!ready ? 'Loading the roster…' : (names.length ? (placeholder || 'Select a rep') : 'Nobody on the roster yet')}
        </option>
        {names.map(function(name) {
          return <option key={name} value={name}>{name}</option>;
        })}
        {allowOther === false ? null : <option value={OTHER}>Someone else…</option>}
      </select>
    </div>
  );
}
