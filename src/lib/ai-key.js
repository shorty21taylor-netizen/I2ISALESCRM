// Where Summit OS keeps its Anthropic API key.
//
// It used to be ANTHROPIC_API_KEY and nothing else, which meant the two features
// that need it — the AIOS tab and the written half of the sales report — could
// only be switched on by someone with access to the deployment's variables and a
// redeploy to spend. That is a strange gate to put in front of a product
// decision, so the key can now be set in Settings instead.
//
// The environment still wins when it is set: a deployment that manages its own
// secrets should not have them silently overridden from a web form.

import { saveAppConfig, loadAppConfig } from '@/lib/db';
import { seal, open, hasKey as hasSealKey, keySource } from '@/lib/secret-box';

var CONFIG_KEY = 'anthropic-api-key';

var cached = null;
var loaded = false;

function fromEnv() {
  return (process.env.ANTHROPIC_API_KEY || '').trim();
}

async function readStored() {
  if (loaded) return cached;
  try {
    cached = await loadAppConfig(CONFIG_KEY);
  } catch (e) {
    console.error('[AI key] load failed:', e.message);
    cached = null;
  }
  loaded = true;
  return cached;
}

// The key to actually call the API with, or '' when there is none.
export async function getApiKey() {
  var env = fromEnv();
  if (env) return env;
  var stored = await readStored();
  if (!stored || !stored.sealed) return '';
  return open(stored.sealed) || '';
}

// Enough of the key to recognise it, and never enough to use it.
function mask(key) {
  var k = String(key || '');
  if (k.length <= 12) return '••••';
  return k.slice(0, 7) + '…' + k.slice(-4);
}

export async function getKeyStatus() {
  var env = fromEnv();
  var stored = await readStored();
  var usable = await getApiKey();

  return {
    configured: !!usable,
    // Which one is in play, so nobody edits the box in Settings and wonders why
    // nothing changed on a deployment that sets the variable.
    source: env ? 'environment' : (stored && stored.sealed ? 'settings' : 'none'),
    hint: usable ? mask(usable) : '',
    // Set in Settings but no longer readable: the key that sealed it has changed.
    unreadable: !!(!env && stored && stored.sealed && !usable),
    canStore: hasSealKey(),
    keySource: keySource(),
    savedAt: (stored && stored.savedAt) || null,
    savedBy: (stored && stored.savedBy) || null,
  };
}

// Anthropic keys have a recognisable shape. Checking it here turns the most
// common mistake — pasting the wrong string entirely — into a clear message
// rather than a failed call later.
export function looksLikeKey(key) {
  return /^sk-ant-[A-Za-z0-9_-]{20,}$/.test(String(key || '').trim());
}

export async function setApiKey(key, byEmail) {
  var clean = String(key || '').trim();
  if (!clean) return { error: 'Paste the key first.' };
  if (!hasSealKey()) {
    return { error: 'This server has nowhere safe to keep the key. Set CREDENTIALS_KEY or DATABASE_URL and try again.' };
  }

  var sealed = seal(clean);
  if (sealed.error) return { error: sealed.error };

  var record = {
    sealed: sealed.value,
    savedAt: new Date().toISOString(),
    savedBy: (byEmail || '').toLowerCase(),
  };
  await saveAppConfig(CONFIG_KEY, record);
  cached = record;
  loaded = true;
  return { success: true };
}

export async function clearApiKey() {
  var record = { sealed: '', clearedAt: new Date().toISOString() };
  await saveAppConfig(CONFIG_KEY, record);
  cached = record;
  loaded = true;
  return { success: true };
}
