import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { initStore } from '@/lib/store';
import { resolveAccess, OWNER_EMAIL } from '@/lib/access';
import { getKeyStatus, setApiKey, clearApiKey, looksLikeKey } from '@/lib/ai-key';

export var dynamic = 'force-dynamic';

// The key spends the account's money, so it is the operator's to set and nobody
// else's — not a manager's, even in their own workspace.
async function requireOperator(req) {
  var access = await resolveAccess(req);
  if (!access.email) return { denied: NextResponse.json({ error: 'Sign in first' }, { status: 401 }) };
  if (!access.isOperator && access.email !== OWNER_EMAIL) {
    return { denied: NextResponse.json({ error: 'Operator access required' }, { status: 403 }) };
  }
  return { access: access };
}

export async function GET(req) {
  await initStore();
  var gate = await requireOperator(req);
  if (gate.denied) return gate.denied;
  // Status only. The key itself never comes back out of this endpoint — there is
  // no read path for it anywhere, which is the point of sealing it.
  return NextResponse.json({ success: true, status: await getKeyStatus() });
}

export async function POST(req) {
  await initStore();
  var gate = await requireOperator(req);
  if (gate.denied) return gate.denied;

  var body = await req.json().catch(function() { return {}; });
  var key = String(body.key || '').trim();

  if (!key) return NextResponse.json({ error: 'Paste the key first.' }, { status: 400 });
  if (!looksLikeKey(key)) {
    return NextResponse.json({
      error: 'That does not look like an Anthropic key. They start with sk-ant- and come from console.anthropic.com.',
    }, { status: 400 });
  }

  // Prove it works before storing it, so "saved" means the tab will answer
  // rather than that a string went into a database.
  try {
    var probe = new Anthropic({ apiKey: key });
    await probe.models.list({ limit: 1 });
  } catch (e) {
    var status = e && e.status;
    if (status === 401 || status === 403) {
      return NextResponse.json({ error: 'Anthropic rejected that key. Check it was copied whole.' }, { status: 400 });
    }
    // Anything else is the network between here and them, not the key. Storing
    // it is still the right move; refusing would strand a good key behind a blip.
    console.error('[AI key] could not verify (storing anyway):', e && e.message);
  }

  var result = await setApiKey(key, gate.access.email);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });

  return NextResponse.json({ success: true, status: await getKeyStatus() });
}

export async function DELETE(req) {
  await initStore();
  var gate = await requireOperator(req);
  if (gate.denied) return gate.denied;
  await clearApiKey();
  return NextResponse.json({ success: true, status: await getKeyStatus() });
}
