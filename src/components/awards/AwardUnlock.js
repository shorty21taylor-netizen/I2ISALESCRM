'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import AwardMedal from '@/components/awards/AwardMedal';
import { RARITY } from '@/lib/awards/definitions';

// The three seconds between earning a medal and owning it.
//
// The whole timeline is CSS keyframes driven off one mount, because a JS-stepped
// animation drifts under load and this must land on 3000ms every time. The only
// thing JS decides is when it starts, when it ends, and that it is never shown
// twice.

var RUN_MS = 3000;
var REDUCED_MS = 1900;
var MAX_PER_SESSION = 3;

function reducedMotion() {
  return typeof window !== 'undefined'
    && window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function AwardUnlock({ unseen, onSeen, blocked }) {
  var [queue, setQueue] = useState([]);
  var [current, setCurrent] = useState(null);
  var [leaving, setLeaving] = useState(false);
  // Fired-for ids, so React's double render in strict mode cannot double-post
  // the seen call or replay an unlock.
  var postedRef = useRef({});
  var timers = useRef([]);

  function clearTimers() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }

  useEffect(function() {
    if (!unseen || !unseen.length) return;
    var fresh = unseen.filter(function(a) { return !postedRef.current[a.id]; });
    if (!fresh.length) return;

    // Oldest first, capped. Anything past the cap collapses into one card rather
    // than holding someone hostage to a slot machine.
    var head = fresh.slice(0, MAX_PER_SESSION);
    var rest = fresh.slice(MAX_PER_SESSION);
    var items = head.slice();
    if (rest.length) {
      items.push({
        id: '__summary__',
        name: rest.length + ' awards unlocked',
        description: 'Open your awards to see everything you picked up.',
        rarity: 'gold',
        icon: 'trophy',
        summaryOf: rest.map(function(r) { return r.id; }),
      });
    }
    setQueue(function(q) { return q.concat(items); });
  }, [unseen]);

  // Never open over a live modal or a call timer: hold the queue and let the
  // next clean load play it. An interruption is worse than a delay.
  useEffect(function() {
    if (blocked || current || !queue.length) return;
    var next = queue[0];
    setQueue(function(q) { return q.slice(1); });
    setCurrent(next);
  }, [queue, current, blocked]);

  var finish = useCallback(function() {
    clearTimers();
    setLeaving(false);
    setCurrent(null);
  }, []);

  useEffect(function() {
    if (!current) return;
    var reduced = reducedMotion();
    var total = reduced ? REDUCED_MS : RUN_MS;

    // Seen is written the instant it starts, not when it ends. A refresh at
    // 1.2s must not replay it, and a skip still counts as watched.
    var ids = current.summaryOf ? current.summaryOf.concat([]) : [current.id];
    var unposted = ids.filter(function(id) { return !postedRef.current[id]; });
    ids.forEach(function(id) { postedRef.current[id] = true; });
    if (unposted.length && onSeen) onSeen(unposted);

    timers.current.push(setTimeout(function() { setLeaving(true); }, total - 350));
    timers.current.push(setTimeout(finish, total));
    return clearTimers;
  }, [current, onSeen, finish]);

  // Escape and click-outside both jump to the end. Already marked seen, so
  // skipping costs nothing but the spectacle.
  useEffect(function() {
    if (!current) return;
    function onKey(e) { if (e.key === 'Escape') finish(); }
    document.addEventListener('keydown', onKey);
    return function() { document.removeEventListener('keydown', onKey); };
  }, [current, finish]);

  if (!current) return null;

  var metal = RARITY[current.rarity] || RARITY.gold;
  var reduced = reducedMotion();

  return (
    <div
      className={'aw-unlock' + (leaving ? ' leaving' : '') + (reduced ? ' reduced' : '')}
      style={{ '--metal': metal.dark, '--metal-light': metal.light }}
      onClick={finish}
      role="dialog"
      aria-label={'Award unlocked: ' + current.name}
    >
      <div className="aw-unlock-inner" onClick={function(e) { e.stopPropagation(); }}>
        <div className="aw-unlock-stage">
          <span className="aw-bloom" aria-hidden="true" />
          {current.rarity === 'gold' && !reduced ? (
            <span className="aw-rays" aria-hidden="true">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(function(i) {
                return <i key={i} style={{ '--r': (i * 30) + 'deg' }} />;
              })}
            </span>
          ) : null}
          <span className="aw-unlock-medal">
            <AwardMedal icon={current.icon} size={132} />
            <span className="aw-sweep" aria-hidden="true" />
          </span>
        </div>

        <p className="aw-unlock-eyebrow">Award unlocked</p>
        <p className="aw-unlock-name">{current.name}</p>
        <p className="aw-unlock-desc">{current.description}</p>
      </div>
    </div>
  );
}
