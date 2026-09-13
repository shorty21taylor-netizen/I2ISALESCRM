import { NextResponse } from 'next/server';
import { initStore, listAiosConversations, createAiosConversation } from '@/lib/store';
import { resolveAccess, effectiveReadWorkspace, onboardingOwed } from '@/lib/access';
import { getOnboardingSteps } from '@/lib/store';

export var dynamic = 'force-dynamic';

// A caller only ever sees their own chats: the store checks ownership by email,
// so there is no id a person could guess their way into.
export async function GET(req) {
  await initStore();
  var access = await resolveAccess(req);
  if (!access.email) return NextResponse.json({ error: 'Sign in to use Summit AIOS.' }, { status: 401 });

  // The same gate the rest of the floor is behind, answered before anyone types
  // rather than after, so the page can say so instead of failing a question.
  if (onboardingOwed(access, getOnboardingSteps(access.email))) {
    return NextResponse.json({ success: true, onboardingRequired: true, conversations: [] });
  }

  var url = new URL(req.url);
  var workspaceId = await effectiveReadWorkspace(req, url.searchParams.get('workspace'));
  var rows = listAiosConversations(access.email, workspaceId).slice(0, 50).map(function(c) {
    return { id: c.id, title: c.title, updatedAt: c.updatedAt, messages: (c.messages || []).length };
  });
  return NextResponse.json({ success: true, conversations: rows });
}

export async function POST(req) {
  await initStore();
  var access = await resolveAccess(req);
  if (!access.email) return NextResponse.json({ error: 'Sign in to use Summit AIOS.' }, { status: 401 });

  var body = await req.json().catch(function() { return {}; });
  var url = new URL(req.url);
  var workspaceId = await effectiveReadWorkspace(req, body.workspace || url.searchParams.get('workspace'));
  var conv = createAiosConversation(access.email, workspaceId, body.title || 'New conversation');
  return NextResponse.json({ success: true, conversation: { id: conv.id, title: conv.title, updatedAt: conv.updatedAt, messages: [] } });
}
