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
