'use client';

import { useEffect } from 'react';
import { formatCurrency } from '@/lib/utils';

// The moment after a rep files the thing the whole floor is measured on.
//
// All five forms get one, and they are deliberately not the same kind of moment.
//
// The two that score celebrate the result: a closed deal rains cash and names the
// figure; a booked call is the summit putting a dart in the calendar. The three
// that report celebrate the FILING, never the contents — an end-of-day submitted
// at 9pm after a terrible day should meet something that says "you showed up and
// logged it", not confetti about performance. So the EOD marks the streak, the DM
// end-of-day shows the inbox emptying into a booked call, and the after-call shows
// the note being filed. None of them reads the numbers inside.
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


// ---- the three that report ----

// A climb, one marker per weekday, the newest one planted. The streak is the
// only figure shown and it is a measure of showing up, not of selling.
function Climb({ streak }) {
  var steps = [];
  var shown = Math.max(1, Math.min(6, streak || 1));
  for (var i = 0; i < shown; i++) steps.push(i);
  return (
    <div className="cel-climb" aria-hidden="true">
      <svg width="210" height="124" viewBox="0 0 210 124" fill="none">
        <path className="cel-climb-line" d="M8 116 L48 92 L88 74 L128 50 L168 28 L202 10"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="260" />
        {steps.map(function(i) {
          var x = 8 + i * 38.8;
          var y = 116 - i * 21.2;
          return (
            <circle key={i} className="cel-climb-dot" cx={x} cy={y} r="5"
              style={{ animationDelay: (120 + i * 90) + 'ms' }} />
          );
        })}
      </svg>
      <span className="cel-flag">
        <svg width="26" height="30" viewBox="0 0 26 30" fill="none">
          <path d="M4 29V2" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
          <path d="M5.4 3.4h16l-4.4 5.4 4.4 5.4h-16z" fill="currentColor" />
        </svg>
      </span>
    </div>
  );
}

// The inbox funnel: bubbles arrive, narrow, and one comes out the bottom as a
// call on the calendar. A DM setter's whole day in one picture.
function Inbox() {
  var bubbles = [0, 1, 2, 3, 4];
  return (
    <div className="cel-inbox" aria-hidden="true">
      {bubbles.map(function(i) {
        return (
          <span key={i} className="cel-bubble" style={{ animationDelay: (i * 110) + 'ms', left: (i * 44) + 'px' }}>
            <svg width="34" height="26" viewBox="0 0 34 26" fill="none">
              <path d="M3 3h28v15H13l-7 5v-5H3z" fill="rgba(255,255,255,0.10)" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            </svg>
          </span>
        );
      })}
      <span className="cel-booked">
        <svg width="62" height="62" viewBox="0 0 62 62" fill="none">
          <rect x="4" y="10" width="54" height="48" rx="8" fill="#14161b" stroke="currentColor" strokeWidth="2.4" />
          <path d="M4 24h54" stroke="currentColor" strokeWidth="2.4" />
          <path d="M18 4v10M44 4v10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          <path className="cel-tick" d="M19 40l8 8 15-16" stroke="#2ee06a" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      </span>
    </div>
  );
}

// The call is over and what was said is on the record. A card slides into the
// stack and seals — nothing about whether it closed.
function Filed() {
  return (
    <div className="cel-filed" aria-hidden="true">
      <span className="cel-wave">
        <svg width="96" height="46" viewBox="0 0 96 46" fill="none">
          {[6, 18, 30, 42, 54, 66, 78, 90].map(function(x, i) {
            return (
              <rect key={x} className="cel-bar" x={x} y="18" width="5" height="10" rx="2.5"
                fill="currentColor" style={{ animationDelay: (i * 70) + 'ms' }} />
            );
          })}
        </svg>
      </span>
      <span className="cel-card">
        <svg width="92" height="112" viewBox="0 0 92 112" fill="none">
          <rect x="3" y="3" width="86" height="106" rx="9" fill="#14161b" stroke="currentColor" strokeWidth="2.4" />
          <path d="M18 30h56M18 46h56M18 62h38" stroke="rgba(255,255,255,0.35)" strokeWidth="3" strokeLinecap="round" />
          <path className="cel-seal" d="M26 86l10 10 22-22" stroke="#2ee06a" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      </span>
    </div>
  );
}

export default function SubmitCelebration({ variant, amount, streak, onDone }) {
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
      {variant === 'eod' ? (
        <>
          <span className="sr-only">
            End-of-day filed{streak > 1 ? ', ' + streak + ' weekdays in a row' : ''}.
          </span>
          <div className="cel-stage cel-stage-sm">
            <Climb streak={streak} />
            <p className="cel-caption">
              {streak > 1 ? <><b>{streak}</b> weekdays in a row</> : <>Day logged</>}
            </p>
          </div>
        </>
      ) : variant === 'dm' ? (
        <>
          <span className="sr-only">DM end-of-day filed.</span>
          <div className="cel-stage cel-stage-sm">
            <Inbox />
            <p className="cel-caption">Inbox logged</p>
          </div>
        </>
      ) : variant === 'aftercall' ? (
        <>
          <span className="sr-only">After-call report filed.</span>
          <div className="cel-stage cel-stage-sm">
            <Filed />
            <p className="cel-caption">On the record</p>
          </div>
        </>
      ) : variant === 'cash' ? (
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
