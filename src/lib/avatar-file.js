'use client';

// Profile images come off a phone, so they arrive as three or four megabytes of
// camera JPEG. Rather than refuse them, resize here: the file someone picks can
// be large, and what actually gets stored is a few dozen kilobytes.
//
// The alternative — simply raising the stored limit — puts multi-megabyte data
// URLs in the database and then back down the wire on every page load, which is
// the one thing a profile picture must never cost.

export var MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

// A square for the face, and a wide strip for the banner behind it. The banner
// is 4:1 because that is the shape a company header is drawn in everywhere else.
export var AVATAR_EDGE = 512;
export var BANNER_W = 1600;
export var BANNER_H = 400;

var AVATAR_TARGET = 180 * 1024;
var BANNER_TARGET = 320 * 1024;
var FLOOR_QUALITY = 0.5;

function loadViaImg(file) {
  return new Promise(function(resolve, reject) {
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function() { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = function() {
      URL.revokeObjectURL(url);
      reject(new Error('That file is not an image we can read'));
    };
    img.src = url;
  });
}

function loadBitmap(file) {
  // createImageBitmap applies the EXIF rotation phones write into their photos,
  // which drawing an <img> to a canvas does not — without it, half the team ends
  // up sideways.
  if (typeof createImageBitmap === 'function') {
    try {
      return createImageBitmap(file, { imageOrientation: 'from-image' })
        .catch(function() { return loadViaImg(file); });
    } catch (e) { /* older browsers reject the options argument outright */ }
  }
  return loadViaImg(file);
}

// Cover-crop from the middle to exactly w x h, then step the quality down until
// the encoded result fits. Cropping here rather than in CSS means we never store
// the pixels nobody will see.
function render(file, w, h, targetBytes) {
  if (!file) return Promise.reject(new Error('No file'));
  if (file.type && file.type.indexOf('image/') !== 0) {
    return Promise.reject(new Error('That file is not an image'));
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return Promise.reject(new Error('That image is over 12MB — larger than a phone camera makes'));
  }

  return loadBitmap(file).then(function(src) {
    var sw = src.width, sh = src.height;
    if (!sw || !sh) throw new Error('That image has no size');

    var scale = Math.max(w / sw, h / sh);
    var cw = Math.min(sw, w / scale);
    var ch = Math.min(sh, h / scale);

    var canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;

    var ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    // JPEG has no alpha, so a transparent PNG would otherwise come out on black.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(src, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, w, h);
    if (src.close) src.close();

    var quality = 0.9;
    var out = canvas.toDataURL('image/jpeg', quality);
    while (out.length > targetBytes && quality > FLOOR_QUALITY) {
      quality -= 0.1;
      out = canvas.toDataURL('image/jpeg', quality);
    }
    return out;
  });
}

export function fileToAvatar(file) {
  return render(file, AVATAR_EDGE, AVATAR_EDGE, AVATAR_TARGET);
}

export function fileToBanner(file) {
  return render(file, BANNER_W, BANNER_H, BANNER_TARGET);
}
