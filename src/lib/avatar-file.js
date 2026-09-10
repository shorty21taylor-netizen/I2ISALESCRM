'use client';

// A profile photo comes off a phone, so it arrives as three or four megabytes of
// camera JPEG. Rather than refuse it, resize it here: the file a rep picks can be
// large, and what actually gets stored is a square a few dozen kilobytes wide.
//
// The alternative — simply raising the stored limit — puts multi-megabyte data
// URLs in the database and then back down the wire on every page load, which is
// the one thing a profile picture must never cost.

export var MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
export var EDGE = 512;

var TARGET_BYTES = 180 * 1024;
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

export function fileToAvatar(file) {
  if (!file) return Promise.reject(new Error('No file'));
  if (file.type && file.type.indexOf('image/') !== 0) {
    return Promise.reject(new Error('That file is not an image'));
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return Promise.reject(new Error('That photo is over 12MB — larger than a phone camera makes'));
  }

  return loadBitmap(file).then(function(src) {
    var sw = src.width, sh = src.height;
    if (!sw || !sh) throw new Error('That image has no size');

    // Square crop from the middle. The avatar is a circle, so anything else gets
    // cropped by CSS regardless; doing it here means we do not store the pixels
    // nobody will ever see.
    var side = Math.min(sw, sh);
    var canvas = document.createElement('canvas');
    canvas.width = EDGE;
    canvas.height = EDGE;

    var ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    // JPEG has no alpha, so a transparent PNG would otherwise come out on black.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, EDGE, EDGE);
    ctx.drawImage(src, (sw - side) / 2, (sh - side) / 2, side, side, 0, 0, EDGE, EDGE);
    if (src.close) src.close();

    var quality = 0.9;
    var out = canvas.toDataURL('image/jpeg', quality);
    while (out.length > TARGET_BYTES && quality > FLOOR_QUALITY) {
      quality -= 0.1;
      out = canvas.toDataURL('image/jpeg', quality);
    }
    return out;
  });
}
