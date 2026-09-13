import { NextResponse } from 'next/server';
import { initStore, createAiosConversation, getAiosConversation, addAiosMessage } from '@/lib/store';
import { resolveAccess, effectiveReadWorkspace, onboardingOwed } from '@/lib/access';
import { getOnboardingSteps } from '@/lib/store';
import { repScope } from '@/lib/rep-scope';
import { buildContext } from '@/lib/aios/handlers';
import { askAios } from '@/lib/aios/agent';
import { checkLimit, recordAsk, PER_REP_PER_DAY } from '@/lib/aios/limits';

export var dynamic = 'force-dynamic';

// One question to Summit AIOS. Everything that decides what may be read —
// identity, workspace, rep-or-manager — is resolved here, on the server, and
// handed to the tool layer as a context the model cannot alter.
export async function POST(req) {
  await initStore();
  try {
    var access = await resolveAccess(req);
    if (!access.email) {
      return NextResponse.json({ error: 'Sign in to use Summit AIOS.' }, { status: 401 });
    }

    // Same gate as the rest of the floor: onboarding first.
    if (onboardingOwed(access, getOnboardingSteps(access.email))) {
      return NextResponse.json({ error: 'Finish onboarding to unlock Summit AIOS.', onboardingRequired: true }, { status: 403 });
    }

    var body = await req.json().catch(function() { return {}; });
    var question = String(body.question || '').trim();
    if (!question) return NextResponse.json({ error: 'Ask a question.' }, { status: 400 });
    if (question.length > 2000) {
      return NextResponse.json({ error: 'That question is too long — keep it under 2,000 characters.' }, { status: 400 });
    }

    var limit = checkLimit(access.email);
    if (!limit.ok) {
      return NextResponse.json({ error: limit.error }, { status: limit.status });
    }

    var url = new URL(req.url);
    var workspaceId = await effectiveReadWorkspace(req, body.workspace || url.searchParams.get('workspace'));
    var scope = await repScope(req);

    var conv = body.conversationId ? getAiosConversation(body.conversationId, access.email) : null;
    var history = conv ? (conv.messages || []).map(function(m) { return { role: m.role, text: m.text }; }) : [];

    var ctx = buildContext({
      access: access,
      workspaceId: workspaceId,
      scope: scope,
      selfName: scope ? scope.name : (access.email || ''),
    });

    var answer = await askAios(ctx, question, history);
    if (answer.error) {
      // Nothing is written on a failure, so a model outage does not leave a
      // stranded conversation in the rail with no answer under it.
      return NextResponse.json({ error: answer.error }, { status: answer.status || 500 });
    }

    // Counted only once an answer actually came back, so a model outage never
    // costs anybody a question off their daily allowance.
    recordAsk(access.email, limit.day);

    if (!conv) conv = createAiosConversation(access.email, workspaceId, question);
    addAiosMessage(conv.id, access.email, { role: 'user', text: question });
    var saved = addAiosMessage(conv.id, access.email, {
      role: 'assistant',
      text: answer.text,
      tools: (answer.trace || []).map(function(t) { return t.tool; }),
    });

    return NextResponse.json({
      success: true,
      conversationId: conv.id,
      title: conv.title,
      message: saved,
      // What it looked up, so an answer can be checked rather than trusted.
      trace: answer.trace || [],
      remaining: Math.max(0, PER_REP_PER_DAY - (limit.used.rep + 1)),
    });
  } catch (e) {
    console.error('[AIOS Ask]', e);
    return NextResponse.json({ error: 'Summit AIOS hit an error answering that.' }, { status: 500 });
  }
}
