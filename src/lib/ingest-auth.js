// Shared-secret auth for the public form ingest endpoint.
//
// The key comes from the FORM_INGEST_KEY environment variable, or — so it can be
// rotated without a redeploy — from the app_config row the settings page writes.

import crypto from 'crypto';
import { loadAppConfig } from '@/lib/db';

export async function getIngestKey() {
  var envKey = (process.env.FORM_INGEST_KEY || '').trim();
  if (envKey) return envKey;
  try {
    var cfg = await loadAppConfig('forms');
    if (cfg && cfg.ingestKey) return String(cfg.ingestKey).trim();
  } catch (e) {
    console.error('[Ingest] Key lookup failed:', e.message);
  }
  return '';
}

// Constant-time compare so a wrong key can't be discovered a character at a time.
export function ingestKeyMatches(expected, presented) {
  var a = Buffer.from(String(expected || ''));
  var b = Buffer.from(String(presented || ''));
  if (a.length === 0 || a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(a, b);
  } catch (e) {
    return false;
  }
}

// ============================================
// WHICH WORKSPACE MAY THIS SUBMISSION LAND IN?
// ============================================
//
// One install-wide key used to be the whole of it, and the workspace came out of
// the payload. That meant a hosted form pointed at a new client's offer landed
// wherever its n8n workflow happened to say — and if the workflow said nothing at
// all, every submission went into 'default', which is the first company's books.
//
// The key decides the workspace now. A workspace with its own ingest key is sealed:
// that key writes there and nowhere else, and no other key writes into it.

import { getWorkspaces } from '@/lib/store';
import { getIntegration } from '@/lib/workspace-config';

export var INGEST_PROVIDER = 'summit';
export var INGEST_KEY_NAME = 'ingest_key';

// The workspace an install-wide key writes into when the payload names none.
// Kept as 'default' so the workflows that were running before any of this keep
// running; set FORM_INGEST_WORKSPACE to move it.
export function defaultIngestWorkspace() {
  return (process.env.FORM_INGEST_WORKSPACE || '').trim() || 'default';
}

async function keyedWorkspaces() {
  var all = getWorkspaces() || [];
  var out = [];
  for (var i = 0; i < all.length; i++) {
    var key = await getIntegration(all[i].id, INGEST_PROVIDER, INGEST_KEY_NAME)
      .catch(function() { return ''; });
    if (key) out.push({ id: all[i].id, name: all[i].name, key: key });
  }
  return out;
}

// Step one, before any parsing: is this key good for anything, and does it pin the
// workspace on its own? Every workspace is compared against, not just until a match,
// so the sealed list is complete however the loop exits.
export async function authorizeIngestKey(presented) {
  var keyed = await keyedWorkspaces();
  var pinned = null;
  for (var i = 0; i < keyed.length; i++) {
    if (ingestKeyMatches(keyed[i].key, presented)) pinned = keyed[i].id;
  }
  var sealed = keyed.map(function(k) { return k.id; });

  if (pinned) {
    return { ok: true, workspaceId: pinned, sealed: sealed, via: 'workspace-key' };
  }

  var global = await getIngestKey();
  if (!global) {
    return { ok: false, status: 503, reason: 'Ingest key not configured.', sealed: sealed };
  }
  if (!ingestKeyMatches(global, presented)) {
    return { ok: false, status: 401, reason: 'Unauthorized', sealed: sealed };
  }
  // The install-wide key: allowed, but it does not get to name its own workspace
  // unchecked. resolveClaimedWorkspace() decides that once the payload is parsed.
  return { ok: true, workspaceId: null, sealed: sealed, via: 'global-key' };
}

// Step two, once the payload has been normalised: what workspace does an
// install-wide key actually get to write into?
export function resolveClaimedWorkspace(auth, claimed) {
  if (auth.workspaceId) {
    // A per-workspace key. The payload does not get a vote — if it disagrees it is
    // a misconfigured workflow, and the key is the thing we can actually trust.
    return { ok: true, workspaceId: auth.workspaceId, ignoredClaim: claimed || '' };
  }

  var all = (getWorkspaces() || []).map(function(w) { return w.id; });
  var want = String(claimed || '').trim();

  if (!want) {
    var fallback = defaultIngestWorkspace();
    if (auth.sealed.indexOf(fallback) !== -1) {
      return { ok: false, status: 403, reason: 'That workspace has its own ingest key — use it.' };
    }
    return { ok: true, workspaceId: fallback };
  }

  // A workspace that does not exist used to be written anyway, producing records
  // filed under an id nothing can ever show.
  if (all.indexOf(want) === -1) {
    return { ok: false, status: 400, reason: 'Unknown workspace: ' + want };
  }
  // Sealed. This is the leak the whole change exists to stop: one shared key being
  // able to post a booked call into another company's workspace.
  if (auth.sealed.indexOf(want) !== -1) {
    return { ok: false, status: 403, reason: 'That workspace has its own ingest key — use it.' };
  }
  return { ok: true, workspaceId: want };
}
