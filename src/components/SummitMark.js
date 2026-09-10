'use client';

// The Summit Closing Group mark: a hollow peak with a serrated range rising
// inside it. Drawn to the logo rather than approximated — the outer form is a
// mitred stroke, which is both what the logo is and what lets it draw itself.
export default function SummitMark({ size, animate, wordmark }) {
  var px = size || 120;
  return (
    <div className={'summit-lockup' + (animate ? ' animate' : '')}>
      <svg
        className="summit-mark"
        width={px}
        height={px}
        viewBox="0 0 120 120"
        fill="none"
        role="img"
        aria-label="Summit Closing Group"
      >
        {/* the outer peak */}
        <path
          className="summit-outline"
          d="M60 18 L110 88 L10 88 Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="7.5"
          strokeLinejoin="miter"
        />
        {/* the range inside it, standing on the same base */}
        <path
          className="summit-range"
          d="M38.5 83.5 L56.8 56 L67 72 L70.5 68 L82.5 83.5 Z"
          fill="currentColor"
        />
      </svg>

      {wordmark ? (
        <div className="summit-words">
          <p className="summit-name">SUMMIT</p>
          <p className="summit-tag">CLOSING GROUP</p>
        </div>
      ) : null}
    </div>
  );
}
