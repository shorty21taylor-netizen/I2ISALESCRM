'use client';

// The Summit mark: a range drawn in, then the bolt striking it. Used at rest in
// the sign-in header and animated on the way into the app.
export default function SummitMark({ size, animate }) {
  var px = size || 120;
  return (
    <svg
      className={'summit-mark' + (animate ? ' animate' : '')}
      width={px}
      height={px}
      viewBox="0 0 120 120"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="summit-face" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--crm-accent-glow)" stopOpacity="0.55" />
          <stop offset="100%" stopColor="var(--crm-accent)" stopOpacity="0.06" />
        </linearGradient>
      </defs>

      {/* the lower ridge, drawn first so the main peak reads as nearer */}
      <path className="summit-ridge-face" d="M2 100 L30 58 L58 100 Z" fill="url(#summit-face)" opacity="0.5" />
      <path className="summit-ridge" d="M2 100 L30 58 L58 100 Z"
        stroke="var(--crm-accent-muted)" strokeWidth="2.5" strokeLinejoin="round" />

      <path className="summit-peak-face" d="M12 100 L60 22 L108 100 Z" fill="url(#summit-face)" />
      <path className="summit-peak" d="M12 100 L60 22 L108 100 Z"
        stroke="var(--crm-accent-glow)" strokeWidth="3.5" strokeLinejoin="round" />

      <path className="summit-bolt" d="M67 33 L47 75 H60 L53 101 L79 61 H65 Z"
        fill="var(--crm-text-bright)" />
    </svg>
  );
}
