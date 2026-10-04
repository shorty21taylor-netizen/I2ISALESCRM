'use client';

import { useEffect } from 'react';
import { formatCurrency } from '@/lib/utils';

// The moment after a rep files the thing the whole floor is measured on.
//
// Two of the five forms earn one. A closed deal rains cash and names the figure;
// a booked call is the summit putting a dart in the calendar — the setter's whole
// job in one picture. The other three forms are reporting, not scoring, and a
// celebration on an end-of-day would cheapen the two that matter.
//
// It is an overlay with pointer-events: none, so it never swallows a click or
// blocks the form underneath, and it takes itself off screen. Everything is
// inline SVG and CSS keyframes — no library, nothing to load, nothing to wait for
// at the exact moment somebody wants to feel good about their day.

// Deliberately irregular: evenly spaced notes read as a loading spinner rather
// than as money falling. Each is [left %, delay ms, drift px, spin deg, scale].
var NOTES = [
  [8, 0, -26, -38, 1.0], [20, 120, 18, 26, 0.82], [31, 60, -12, 44, 1.12],
  [43, 210, 24, -30, 0.9], [55, 30, -20, 34, 1.04], [66, 160, 14, -42, 0.86],
  [78, 90, -18, 28, 1.08], [89, 240, 20, -24, 0.94], [14, 300, 10, 40, 0.78],
  [49, 340, -16, -36, 0.8], [72, 280, 22, 32, 0.76], [37, 380, -10, 22, 0.72],
];

function Note({ spec }) {
  var left = spec[0], delay = spec[1], drift = spec[2], spin = spec[3], scale = spec[4];
  return (
    <span
      className="cel-note"
      style={{
        left: left + '%',
        animationDelay: delay + 'ms',
        '--drift': drift + 'px',
        '--spin': spin + 'deg',
        '--scale': scale,
      }}
    >
      <svg width="34" height="22" viewBox="0 0 34 22" fill="none" aria-hidden="true">
        <rect x="0.6" y="0.6" width="32.8" height="20.8" rx="3" fill="#1d7a46" stroke="#34d27a" strokeWidth="1.2" />
        <circle cx="17" cy="11" r="5.6" fill="none" stroke="#7ef0ad" strokeWidth="1.2" />
        <path d="M17 7.2v7.6M15.1 9.1h3.4a1.6 1.6 0 0 1 0 3.2h-3a1.6 1.6 0 0 0 0 3.2h3.4"
          stroke="#d8ffe8" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    </span>
  );
}

// The Summit ridge, traced from the same artwork the sidebar mark uses.
function Ridge() {
  return (
    <svg className="cel-ridge" viewBox="0 0 384.3 285.7" width="168" height="125" aria-hidden="true">
      <path
        d="M0 285.7L191.8 0L384.3 285.7L275.5 285.7L240.5 238.7L226.5 256.7L184.5 199.7L124.5 285.7Z"
        fill="currentColor"
      />
    </svg>
  );
}

function Calendar() {
  return (
    <svg className="cel-cal" width="136" height="136" viewBox="0 0 104 104" fill="none" aria-hidden="true">
      <rect x="6" y="14" width="92" height="84" rx="10" fill="#14161b" stroke="currentColor" strokeWidth="2.5" />
      <path d="M6 36h92" stroke="currentColor" strokeWidth="2.5" />
      <path d="M28 6v16M76 6v16" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
      {[0, 1, 2, 3].map(function(col) {
        return [0, 1, 2].map(function(row) {
          var isTarget = col === 2 && row === 1;
          return (
            <rect
              key={col + '-' + row}
              x={18 + col * 18} y={48 + row * 16} width="12" height="10" rx="2.5"
              className={isTarget ? 'cel-cal-hit' : ''}
              fill={isTarget ? 'currentColor' : 'rgba(255,255,255,0.13)'}
            />
          );
        });
      })}
    </svg>
  );
}

export default function SubmitCelebration({ variant, amount, onDone }) {
  useEffect(function() {
    if (!variant) return undefined;
    // Long enough for the dart to land and the cash to clear the fold, short
    // enough that nobody waiting to file a second deal has to sit through it.
    var t = setTimeout(function() { if (onDone) onDone(); }, 2100);
    return function() { clearTimeout(t); };
  }, [variant, onDone]);

  if (!variant) return null;

  var figure = Number(amount);
  var hasFigure = isFinite(figure) && figure > 0;

  return (
    <div className="cel" role="status" aria-live="polite">
      {variant === 'cash' ? (
        <>
          <span className="sr-only">
            Deal closed{hasFigure ? ', ' + formatCurrency(figure) + ' collected' : ''}.
          </span>
          <div className="cel-rain" aria-hidden="true">
            {NOTES.map(function(spec, i) { return <Note key={i} spec={spec} />; })}
          </div>
          {hasFigure ? (
            <div className="cel-figure" aria-hidden="true">{formatCurrency(figure)}</div>
          ) : null}
        </>
      ) : (
        <>
          <span className="sr-only">Call booked.</span>
          <div className="cel-stage" aria-hidden="true">
            <Ridge />
            <span className="cel-dart">
              <svg width="58" height="18" viewBox="0 0 58 18" fill="none">
                {/* flights, shaft, then the tip that does the landing */}
                <path d="M2 9L13 2.5v13z" fill="#c8a951" />
                <path d="M9 9L19 4.5v9z" fill="#e2c87f" />
                <rect x="17" y="7.6" width="27" height="2.8" rx="1.4" fill="#d7d7d7" />
                <path d="M44 5.4L57 9l-13 3.6z" fill="#fafafa" />
              </svg>
            </span>
            <Calendar />
          </div>
        </>
      )}
    </div>
  );
}
