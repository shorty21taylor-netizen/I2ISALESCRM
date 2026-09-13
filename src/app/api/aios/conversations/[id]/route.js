import { NextResponse } from 'next/server';
import { initStore, getAiosConversation, deleteAiosConversation } from '@/lib/store';
import { resolveAccess } from '@/lib/access';

export var dynamic = 'force-dynamic';

export async function GET(req, context) {
  await initStore();
  var access = await resolveAccess(req);
  if (!access.email) return NextResponse.json({ error: 'Sign in to use Summit AIOS.' }, { status: 401 });

  var params = await context.params;
  var conv = getAiosConversation(params.id, access.email);
  if (!conv) return NextResponse.json({ error: 'No such conversation.' }, { status: 404 });

  return NextResponse.json({
    success: true,
    conversation: {
      id: conv.id,
      title: conv.title,
      updatedAt: conv.updatedAt,
      messages: (conv.messages || []).map(function(m) {
        return { id: m.id, role: m.role, text: m.text, at: m.at, tools: m.tools || [] };
      }),
    },
  });
}

// Soft, like every delete in this CRM: the rows stay and a timestamp is stamped.
export async function DELETE(req, context) {
  await initStore();
  var access = await resolveAccess(req);
  if (!access.email) return NextResponse.json({ error: 'Sign in to use Summit AIOS.' }, { status: 401 });

  var params = await context.params;
  var gone = deleteAiosConversation(params.id, access.email);
  if (!gone) return NextResponse.json({ error: 'No such conversation.' }, { status: 404 });
  return NextResponse.json({ success: true });
}
