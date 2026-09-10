// A workspace picks one brand colour; the platform wears it as its accent on top
// of whichever theme the user is in.
//
// The whole UI already hangs off --crm-accent and --accent-rgb, so theming is a
// matter of writing a handful of variables onto <html>. The work is in doing it
// without breaking legibility: a brand navy is invisible as text on the dark
// theme, and a brand lemon is invisible on the light one. So the raw colour is
// kept for large solid fills — buttons, where the brand should read true — and a
// luminance-adjusted variant of the same hue is used everywhere the accent has to
// be read: labels, icons, borders, tinted backgrounds.

// The surfaces the accent has to hold up against in each theme.
var SURFACE = { dark: '#161616', light: '#ffffff' };
var MIN_RATIO = 4.5;

export function parseHex(hex) {
  var s = String(hex || '').trim().replace(/^#/, '');
  if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
  if (!/^[0-9a-fA-F]{6}$/.test(s)) return null;
  return {
    r: parseInt(s.slice(0, 2), 16),
    g: parseInt(s.slice(2, 4), 16),
    b: parseInt(s.slice(4, 6), 16),
  };
}

export function isValidHex(hex) { return parseHex(hex) !== null; }

function toHex(rgb) {
  function part(v) {
    var s = Math.max(0, Math.min(255, Math.round(v))).toString(16);
    return s.length === 1 ? '0' + s : s;
  }
  return '#' + part(rgb.r) + part(rgb.g) + part(rgb.b);
}

function channel(c) {
  var v = c / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

export function luminance(hex) {
  var c = parseHex(hex);
  if (!c) return 0;
  return 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
}

export function contrast(a, b) {
  var l1 = luminance(a);
  var l2 = luminance(b);
  if (l1 < l2) { var t = l1; l1 = l2; l2 = t; }
  return (l1 + 0.05) / (l2 + 0.05);
}

function rgbToHsl(c) {
  var r = c.r / 255, g = c.g / 255, b = c.b / 255;
  var max = Math.max(r, g, b), min = Math.min(r, g, b);
  var h = 0, s = 0, l = (max + min) / 2;
  var d = max - min;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return { h: h, s: s, l: l };
}

function hslToRgb(hsl) {
  var h = hsl.h, s = hsl.s, l = hsl.l;
  if (s === 0) { var v = l * 255; return { r: v, g: v, b: v }; }
  function hue(p, q, t) {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  }
  var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  var p = 2 * l - q;
  return { r: hue(p, q, h + 1 / 3) * 255, g: hue(p, q, h) * 255, b: hue(p, q, h - 1 / 3) * 255 };
}

export function shift(hex, deltaL) {
  var c = parseHex(hex);
  if (!c) return hex;
  var hsl = rgbToHsl(c);
  hsl.l = Math.max(0, Math.min(1, hsl.l + deltaL));
  return toHex(hslToRgb(hsl));
}

// Walk the brand colour's own lightness until it clears the contrast bar against
// the surface, keeping its hue and saturation. A navy stays navy — it just gets
// bright enough to read on black.
export function readableOn(hex, surface, minRatio) {
  var target = minRatio || MIN_RATIO;
  if (!isValidHex(hex)) return hex;
  if (contrast(hex, surface) >= target) return hex;

  var towardLight = luminance(surface) < 0.5;
  var c = parseHex(hex);
  var hsl = rgbToHsl(c);
  var step = towardLight ? 0.02 : -0.02;

  for (var i = 0; i < 50; i++) {
    hsl.l = Math.max(0, Math.min(1, hsl.l + step));
    var candidate = toHex(hslToRgb(hsl));
    if (contrast(candidate, surface) >= target) return candidate;
    if (hsl.l <= 0 || hsl.l >= 1) break;
  }
  // A fully saturated hue can be incapable of the ratio; take the best it can do.
  return toHex(hslToRgb(hsl));
}

// Black or white, whichever a person can actually read on this colour.
export function inkOn(hex) {
  return contrast('#ffffff', hex) >= contrast('#0a0a0a', hex) ? '#ffffff' : '#0a0a0a';
}

// The variables the whole platform reads. Returned rather than applied so the
// settings preview can render them without touching the live page.
export function accentVars(brandHex, theme) {
  if (!isValidHex(brandHex)) return null;
  var dark = theme !== 'light';
  var surface = dark ? SURFACE.dark : SURFACE.light;

  var accent = readableOn(brandHex, surface, MIN_RATIO);
  var rgb = parseHex(accent);
  var glow = shift(accent, dark ? 0.12 : -0.1);
  var muted = shift(accent, dark ? -0.24 : 0.28);

  return {
    '--crm-accent': accent,
    '--accent-rgb': rgb.r + ',' + rgb.g + ',' + rgb.b,
    '--crm-accent-glow': glow,
    '--crm-accent-muted': muted,
    // A button is a large solid fill, so it carries the brand colour itself.
    '--btn-primary-bg': 'linear-gradient(135deg,' + shift(brandHex, 0.08) + ' 0%,' + brandHex + ' 100%)',
    '--btn-primary-bg-hover': 'linear-gradient(135deg,' + shift(brandHex, 0.16) + ' 0%,' + shift(brandHex, 0.06) + ' 100%)',
    '--btn-primary-fg': inkOn(brandHex),
  };
}

var APPLIED = [
  '--crm-accent', '--accent-rgb', '--crm-accent-glow', '--crm-accent-muted',
  '--btn-primary-bg', '--btn-primary-bg-hover', '--btn-primary-fg',
];

export function applyAccent(brandHex, theme) {
  if (typeof document === 'undefined') return;
  var vars = accentVars(brandHex, theme);
  if (!vars) { clearAccent(); return; }
  var root = document.documentElement;
  Object.keys(vars).forEach(function(k) { root.style.setProperty(k, vars[k]); });
}

// Removing the inline values hands the platform back to the stylesheet's own
// neutral accent — used when viewing every workspace at once, or when a
// workspace has not chosen a colour.
export function clearAccent() {
  if (typeof document === 'undefined') return;
  var root = document.documentElement;
  APPLIED.forEach(function(k) { root.style.removeProperty(k); });
}
