'use client';

// The Summit Closing Group mark.
//
// The geometry below was traced off the logo artwork itself, not approximated by
// eye: the outer ring and the ridge that cuts through it are the file's own edges.
// That matters because this same shape has to hold up in three places at once —
// drawing itself on the way into the app, sitting in the sidebar, and printing at
// the top of a report someone hands to a client.
//
// A workspace that has uploaded its own logo gets that file instead, everywhere.

var MARK_BOX = '0 0 384.3 285.7';
var MARK_W = 384.3;
var MARK_H = 285.7;

// Two rings: the outer triangle, and the hole whose lower edge is the mountain.
// Kept apart so each can draw itself as a line before the solid mark arrives.
var RING_OUTER = 'M0 285.7L191.8 0L384.3 285.7L275.5 285.7L240.5 238.7L226.5 256.7L184.5 199.7L124.5 285.7Z';
var RING_INNER = 'M51.7 262.7L191 56.2L332.5 262.7L288.5 262.7L241.5 198.7L227 217.2L183.5 156.7L110.5 262.7Z';
var MARK_D = RING_OUTER + RING_INNER;

var WORD_BOX = '0 0 442 116';
var WORD_W = 442;
var WORD_H = 116;
var WORD_D = 'M22.5 0L32 -0.5L33 0.5L37 0.5L38 1.5L44 2.5L52.5 7L46 16.5L44 14.5L42 14.5L39 12.5L37 12.5L36 11.5L31 11.5L30 10.5L21 11.5L16.5 15L16.5 20L18 21.5L22 22.5L23 23.5L26 23.5L27 24.5L30 24.5L31 25.5L35 25.5L39 27.5L42 27.5L48 30.5L52.5 35L53.5 39L54.5 40L54.5 49L52.5 53L47 58.5L43 60.5L41 60.5L40 61.5L37 61.5L36 62.5L20 62.5L19 61.5L15 61.5L14 60.5L9 59.5L-0.5 54L6 45.5L8 45.5L15 49.5L21 50.5L22 51.5L33 51.5L34 50.5L38 49.5L40.5 46L39.5 42L37 39.5L33 37.5L29 37.5L28 36.5L25 36.5L24 35.5L20 35.5L19 34.5L13 33.5L6 29.5L1.5 23L1.5 15L2.5 14L2.5 12L4.5 8L8 4.5L14 1.5L17 1.5L18 0.5ZM15.5 83L19 82.5L20 83.5L24 83.5L29.5 88L26 92.5L24 90.5L22 90.5L21 89.5L14 89.5L8.5 94L8.5 96L7.5 97L7.5 102L11 107.5L15 109.5L20 109.5L21 108.5L23 108.5L27 106.5L30.5 111L24 115.5L20 115.5L19 116.5L11 115.5L7 112.5L6 112.5L1.5 107L1.5 105L0.5 104L0.5 94L2.5 90L7 85.5L11 83.5ZM39.5 84L45.5 84L45.5 109L61 109.5L61 115.5L38.5 115L38.5 85ZM81.5 83L85 82.5L86 83.5L90 83.5L94 85.5L98.5 90L100.5 94L100.5 96L101.5 97L101.5 101L100.5 102L99.5 108L94 113.5L90 114.5L89 115.5L85 115.5L84 116.5L83 115.5L77 115.5L75 113.5L74 113.5L68.5 108L67.5 106L67.5 103L66.5 102L66.5 97L67.5 96L67.5 93L68.5 91L75 84.5L77 83.5ZM79.5 90L88 89.5L90 90.5L93.5 95L93.5 99L94.5 100L93.5 101L93.5 103L92.5 105L87 109.5L81 109.5L77 107.5L74.5 104L74.5 101L73.5 100L74.5 95L75.5 93ZM74.5 1L88.5 1L88.5 39L89.5 40L89.5 43L90.5 45L94 48.5L98 50.5L101 50.5L102 51.5L109 51.5L110 50.5L112 50.5L116 48.5L119.5 45L120.5 43L120.5 40L121.5 39L121.5 1L135 0.5L135.5 42L134.5 43L134.5 46L130.5 53L124 58.5L120 60.5L115 61.5L114 62.5L96 62.5L95 61.5L92 61.5L84 57.5L77.5 51L76.5 47L75.5 46L75.5 44L74.5 43ZM114.5 84L128 83.5L133.5 87L130 91.5L126 89.5L122 89.5L121 88.5L120 89.5L118 89.5L116.5 91L116.5 93L119 95.5L126 96.5L130 98.5L134.5 104L134.5 108L133.5 109L133.5 111L131 113.5L127 115.5L115 115.5L109 112.5L107.5 111L111 106.5L117 109.5L125 109.5L127.5 107L127.5 106L125 103.5L116 101.5L112 99.5L109.5 97L109.5 95L108.5 94L109.5 88L113 84.5ZM143.5 84L150.5 84L150 115.5L143.5 115ZM159.5 1L173 0.5L173.5 2L177.5 6L177.5 7L184.5 15L184.5 16L187.5 19L187.5 20L194.5 28L195 29.5L195.5 28L200.5 23L200.5 22L208.5 13L208.5 12L211.5 9L211.5 8L214.5 5L214.5 4L218 0.5L230 0.5L231.5 2L231.5 61L217.5 61L217 22.5L209.5 31L209.5 32L204.5 37L204.5 38L201.5 41L201.5 42L197 46.5L193 46.5L190.5 44L190.5 43L186.5 39L186.5 38L183.5 35L183.5 34L179.5 30L179.5 29L174 22.5L173.5 61L160 61.5ZM161.5 84L168 83.5L168.5 85L178.5 96L178.5 97L184 103.5L184.5 84L191.5 84L191 115.5L186 115.5L180.5 110L180.5 109L169 95.5L168.5 115L161.5 115ZM210.5 84L224 83.5L229.5 87L228.5 90L227 91.5L225 91.5L222 89.5L214 89.5L212 90.5L207.5 96L207.5 103L208.5 105L212 108.5L214 108.5L215 109.5L220 109.5L221 108.5L223 108.5L224.5 107L224 102.5L216.5 102L217 97.5L230 97.5L230.5 111L228 113.5L224 115.5L211 115.5L207 113.5L201.5 107L201.5 105L200.5 104L200.5 95L201.5 94L201.5 92L202.5 90L207 85.5ZM255.5 1L269 0.5L269.5 2L276.5 10L276.5 11L283.5 19L283.5 20L287.5 24L287.5 25L290.5 28L291 29.5L314 0.5L327 0.5L327.5 61L313.5 61L313 22.5L306.5 30L306.5 31L301.5 36L301.5 37L294.5 45L294 46.5L289 46.5L282.5 39L282.5 38L276.5 31L276.5 30L270.5 24L270 22.5L269.5 61L256 61.5ZM270.5 83L274 82.5L275 83.5L279 83.5L283 85.5L284.5 87L284.5 88L282 91.5L280 91.5L277 89.5L269 89.5L267 90.5L263.5 94L263.5 96L262.5 97L262.5 102L264.5 106L267 108.5L269 108.5L270 109.5L276 109.5L277 108.5L279.5 108L279.5 104L276 103.5L275 102.5L272 102.5L271.5 98L285 97.5L286.5 99L285.5 100L286.5 102L286.5 109L283 113.5L279 115.5L266 115.5L262 112.5L261 112.5L258.5 110L255.5 104L255.5 96L256.5 95L256.5 93L258.5 89L262 85.5L266 83.5ZM295.5 84L314 83.5L315 84.5L318 84.5L322.5 89L322.5 91L323.5 92L322.5 99L318 103.5L317 103.5L316.5 105L320.5 110L320.5 111L323.5 114L323 115.5L316 115.5L313.5 111L309 105.5L302.5 106L302 115.5L295.5 115ZM302.5 90L313 89.5L316.5 93L316.5 95L315.5 97L312 99.5L304 99.5L302.5 98ZM346.5 83L350 82.5L351 83.5L354 83.5L360 86.5L360.5 88L363.5 91L364.5 93L364.5 96L365.5 97L365.5 102L364.5 103L364.5 105L362.5 109L359 112.5L358 112.5L354 115.5L342 115.5L338 113.5L333.5 109L331.5 105L331.5 103L330.5 102L330.5 97L331.5 96L331.5 93L332.5 91L338 85.5L342 83.5ZM343.5 90L352 89.5L356.5 93L357.5 95L357.5 99L358.5 100L357.5 101L357.5 104L355 107.5L351 109.5L345 109.5L339.5 105L338.5 103L338.5 95L339.5 93ZM352.5 1L365.5 1L365 61.5L353 61.5L351.5 60L351.5 2ZM373.5 84L380.5 84L380.5 105L381.5 107L385 109.5L391 109.5L394.5 107L395.5 105L395.5 84L402.5 84L402.5 106L400.5 110L396 114.5L394 115.5L390 115.5L389 116.5L387 116.5L386 115.5L382 115.5L380 114.5L375.5 110L373.5 106ZM384.5 1L442.5 1L442 12.5L419.5 13L420.5 14L419.5 15L419.5 18L420.5 19L420.5 31L419.5 32L419.5 35L420.5 36L420.5 38L419.5 39L419.5 52L420.5 53L420.5 56L419.5 57L419 61.5L405.5 61L405.5 13L385 12.5ZM412.5 84L430 83.5L436 86.5L438.5 91L438.5 98L434 103.5L430 104.5L429 105.5L419.5 106L419 115.5L412.5 115ZM419.5 90L428 89.5L430 90.5L431.5 92L431.5 97L428 99.5L420 99.5Z';

// The lockup's own proportions: how wide the wordmark runs against the mark, and
// how much air sits between them.
var WORD_SCALE = WORD_W / MARK_W;
var WORD_GAP = 0.11;

function markWidth(height) {
  return Math.round((height * MARK_W) / MARK_H);
}

function wordWidth(height) {
  return Math.round(markWidth(height) * WORD_SCALE);
}

// The height the whole lockup will occupy. Callers that have to wait on a brand
// before they know which mark to draw use this to hold the space, so the page
// does not jump when the answer arrives.
export function lockupHeight(size, wordmark) {
  var h = size || 120;
  if (!wordmark) return h;
  var ww = wordWidth(h);
  return h + Math.round(h * WORD_GAP) + Math.round((ww * WORD_H) / WORD_W);
}

// The bare glyph, for anywhere the mark sits inline at a fixed height — a report
// header, a nav rail — with no animation and no wordmark.
export function SummitGlyph(props) {
  var h = props.height || 34;
  return (
    <svg
      className={props.className || 'summit-glyph'}
      viewBox={MARK_BOX}
      width={markWidth(h)}
      height={h}
      role="img"
      aria-label={props.name || 'Summit Closing Group'}
    >
      <path d={MARK_D} fill="currentColor" fillRule="evenodd" />
    </svg>
  );
}

export default function SummitMark({ size, animate, wordmark, src, name, pending }) {
  var h = size || 120;
  var cls = 'summit-lockup' + (animate ? ' animate' : '') + (src ? ' has-logo' : '');

  // Still finding out whether this workspace has a logo of its own. Hold the
  // space rather than draw a mark that is about to be replaced.
  if (pending) {
    return <div className={'summit-lockup'} style={{ height: lockupHeight(h, wordmark) }} />;
  }

  // An uploaded logo is the logo. Nothing is drawn over it or beside it.
  if (src) {
    return (
      <div className={cls}>
        <img className="summit-logo" src={src} alt={name || 'Logo'} style={{ height: h }} />
      </div>
    );
  }

  var w = markWidth(h);
  var ww = wordWidth(h);

  return (
    <div className={cls}>
      <svg
        className="summit-mark"
        viewBox={MARK_BOX}
        width={w}
        height={h}
        role="img"
        aria-label={name || 'Summit Closing Group'}
      >
        {/* Drawn as a line first, then handed over to the solid mark. */}
        <path className="summit-draw" d={RING_OUTER} pathLength="1" fill="none"
          stroke="currentColor" strokeWidth="5" strokeLinejoin="miter" />
        <path className="summit-draw" d={RING_INNER} pathLength="1" fill="none"
          stroke="currentColor" strokeWidth="5" strokeLinejoin="miter" />
        <path className="summit-solid" d={MARK_D} fill="currentColor" fillRule="evenodd" />
      </svg>

      {wordmark ? (
        <svg
          className="summit-word"
          viewBox={WORD_BOX}
          width={ww}
          height={Math.round((ww * WORD_H) / WORD_W)}
          style={{ marginTop: Math.round(h * WORD_GAP) }}
          aria-hidden="true"
        >
          <path d={WORD_D} fill="currentColor" fillRule="evenodd" />
        </svg>
      ) : null}
    </div>
  );
}
