// The check that runs before a submission is written.
//
// A form whose workspace has no destination set is refused outright: nothing is
// written and nothing is posted. That is deliberately blunt. The alternative was
// the bug this whole change exists to remove — a record saved and a message sent
// to whichever group happened to be configured globally, which for a second
// workspace meant another company's WhatsApp group.
//
// Refusing loses a submission the rep can re-file in a minute once an admin
// finishes setup. Sending it to the wrong company cannot be taken back.

import { NextResponse } from 'next/server';
import { resolveRoute } from '@/lib/workspace-config';

export async function requireRoute(workspaceId, formType) {
  var resolved = await resolveRoute(workspaceId, formType);
  if (resolved.ok) return null;
  console.log('[Submit] Refused', formType, 'in workspace', workspaceId, '— no destination configured');
  return NextResponse.json({
    error: resolved.reason,
    unrouted: true,
    formKey: formType,
  }, { status: 409 });
}
