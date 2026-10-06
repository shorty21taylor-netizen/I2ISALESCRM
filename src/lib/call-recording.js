// Where a call recording lives on a record, and what counts as one.
//
// It was briefly a hard gate: no link, no record. That is no longer true. The
// floor files on hosted forms that have no recording question, and refusing
// those submissions did not produce recordings — it produced nothing at all,
// with the call, the cash and the commission lost along with the missing link.
//
// So the link is captured wherever it is offered, stored, and shown on the
// record; a record without one says "no recording" rather than being refused.
// A workspace that wants the old behaviour back sets
// summit / require_call_recording = on, which every write path honours.
//
// It is a LINK, not an upload. There is no object store behind this product: the
// only upload path is the avatar one, which caps at 12MB and resizes in the
// browser. A call recording is hundreds of megabytes. Every tool a floor already
// uses — Zoom, Fathom, Grain, Fireflies, Drive — hands out a share link, so the
// link is both what exists and what a manager can actually open months later.

var MAX_LEN = 600;

// Hosts that hand out call recordings. Not a whitelist — anything https is
// accepted — but a link from one of these is worth saying so, because a rep who
// pastes a meeting invite instead of a recording is the common mistake.
var KNOWN = [
  'zoom.us', 'fathom.video', 'grain.com', 'fireflies.ai', 'gong.io',
  'drive.google.com', 'loom.com', 'vimeo.com', 'youtu', 'dropbox.com',
  'otter.ai', 'notta.ai', 'tldv.io', 'sharepoint.com', 'onedrive.live.com',
];

export function normalizeRecording(raw) {
  var value = String(raw === null || raw === undefined ? '' : raw).trim();

  if (!value) {
    return { ok: false, reason: 'A link to the call recording is required before this can be filed.' };
  }
  if (value.length > MAX_LEN) {
    return { ok: false, reason: 'That link is too long to be a real one.' };
  }

  // A bare host is what people paste when they copy out of an address bar on a
  // phone, so it is corrected rather than refused.
  if (value.indexOf('://') === -1 && /^[\w.-]+\.[a-z]{2,}/i.test(value)) {
    value = 'https://' + value;
  }

  var parsed = null;
  try {
    parsed = new URL(value);
  } catch (e) {
    return { ok: false, reason: 'That is not a link. Paste the share link to the recording.' };
  }

  // http: is allowed through but https is what every one of these tools issues;
  // anything else — javascript:, data:, file: — is not a recording.
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { ok: false, reason: 'That is not a link. Paste the share link to the recording.' };
  }
  if (!parsed.hostname || parsed.hostname.indexOf('.') === -1) {
    return { ok: false, reason: 'That link has no real address on it.' };
  }

  var host = parsed.hostname.toLowerCase();
  var known = KNOWN.some(function(k) { return host.indexOf(k) !== -1; });

  return { ok: true, url: parsed.href, host: host, known: known };
}

// Where it lives on a record. Both addClosedDeal and addAfterCallReport already
// carry an `extra` object through untouched, so the link rides there rather than
// as a new column — addClosedDeal is one of the functions the floor's numbers
// rest on and is not to be modified.
export function withRecording(body, url) {
  var extra = Object.assign({}, (body && body.extra) || {});
  extra.recordingUrl = url;
  return extra;
}

export function recordingOf(record) {
  return (record && record.extra && record.extra.recordingUrl) || '';
}



// Does this workspace refuse a call record that carries no recording?
//
// Off by default. It is opt-in rather than opt-out because the cost of being
// wrong runs one way: a workspace that wanted the rule and does not have it has
// records missing a link, which is visible on every row and fixable later; a
// workspace that did not want it and has it loses the submission entirely.
export async function recordingRequired(getIntegration, workspaceId) {
  if (!getIntegration || !workspaceId) return false;
  var v = await getIntegration(workspaceId, 'summit', 'require_call_recording')
    .catch(function() { return ''; });
  return String(v || '').trim().toLowerCase() === 'on';
}
