'use client';

// One medal, any size. Every colour is currentColor so the metal is set once on
// the parent and the whole thing — disc, ring, glyph — follows it.

var GLYPHS = {
  bolt: 'M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12l1-8.5Z',
  phone: 'M6.5 3h3l1.5 4-2 1.5a12 12 0 0 0 5.5 5.5L16 12l4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.5 5.2 2 2 0 0 1 6.5 3Z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3.5 2',
  calendar: 'M4 6.5h16v14H4zM4 11h16M8.5 3v4M15.5 3v4',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9ZM12 13.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z',
  chart: 'M4 20V9M10 20V4M16 20v-7M22 20H2',
  flame: 'M12 22c3.9 0 6.5-2.5 6.5-6 0-4.5-4-5.5-3-10.5C12 7 9 8.5 9 12c0-1.5-.8-2.5-1.5-3C6 11 5.5 13 5.5 16c0 3.5 2.6 6 6.5 6Z',
  star: 'M12 3l2.7 5.9 6.3.7-4.7 4.3 1.3 6.3L12 17l-5.6 3.2 1.3-6.3L3 9.6l6.3-.7L12 3Z',
  shield: 'M12 3l8 3v6c0 4.6-3.3 8.2-8 9.5-4.7-1.3-8-4.9-8-9.5V6l8-3Z',
  crown: 'M4 18h16M4 18 3 7l5 4 4-6 4 6 5-4-1 11',
  coins: 'M9 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10ZM15 22a5 5 0 1 0 0-10 5 5 0 0 0 0 10ZM9 12v0M15 12v0',
  trophy: 'M7 4h10v5a5 5 0 0 1-10 0V4ZM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M9.5 20h5M12 14v6',
};

export default function AwardMedal({ icon, size, className, style }) {
  var px = size || 52;
  var path = GLYPHS[icon] || GLYPHS.star;
  // The glyph is drawn on a 24-box, centred and scaled up slightly so it fills
  // the disc without crowding the ring.
  var scale = 1.28;
  var offset = (48 - 24 * scale) / 2;

  return (
    <svg className={className} style={style} width={px} height={px} viewBox="0 0 48 48"
      fill="none" aria-hidden="true">
      <circle cx="24" cy="24" r="23" fill="currentColor" opacity="0.13" />
      <circle cx="24" cy="24" r="20.5" stroke="currentColor" strokeWidth="1.6" opacity="0.55" />
      <circle cx="24" cy="24" r="17" fill="currentColor" opacity="0.2" />
      <g transform={'translate(' + offset + ' ' + offset + ') scale(' + scale + ')'}
        stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d={path} />
      </g>
    </svg>
  );
}
