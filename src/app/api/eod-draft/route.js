import { NextResponse } from 'next/server';
import { initStore, getStore, getAfterCallReports, getCloserProfile } from '@/lib/store';
import { effectiveReadWorkspace, matchesWorkspace, resolveAccess } from '@/lib/access';
import { getUser } from '@/lib/users';
import { repIdentity } from '@/lib/rep-stats';
import { buildEodDraft, buildSetterEodDraft, buildDmEodDraft } from '@/lib/eod-draft';
import { todayInReportTimezone, toReportDay } from '@/lib/report-date';

export var dynamic = 'force-dynamic';

// The rep's day, totalled, so the end-of-day form can be filled from what they
// already filed instead of counted again from memory.
//
// Read-only. It writes nothing and decides nothing — the form fills its blanks
// from this and the rep still presses submit.
export async function GET(req) {
  await initStore();

  var access = await resolveAccess(req);
  if (!access.email) {
    return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  }

  var url = new URL(req.url);
  var workspaceId = await effectiveReadWorkspace(req, url.searchParams.get('workspace'));
  var day = toReportDay(url.searchParams.get('day')) || todayInReportTimezone();
  // Which of the three reports is being filed. The form says so explicitly now,
  // so the draft never has to guess — and a setter's draft must not carry the
  // closer's call figures, which would land their day on the wrong board.
  var asked_role = String(url.searchParams.get('role') || '').toLowerCase();
  var mode = asked_role === 'dm' || asked_role === 'dm-setter' ? 'dm'
    : asked_role === 'setter' ? 'setter'
    : 'closer';

  // Whose day. Their own by default; a manager filing on a rep's behalf can name
  // the rep, and then ownership is decided by the name — which is the rule
  // everywhere else in this codebase, because the name is the field somebody
  // deliberately typed and the email is ambient.
  var asked = String(url.searchParams.get('rep') || '').trim();
  var owns;
  var subject;

  if (asked && access.canSeeTeam) {
    subject = asked;
    var wanted = asked.trim().toLowerCase();
    owns = function(record, emailField, nameField) {
      var name = nameField ? record[nameField] : '';
      return !!name && String(name).trim().toLowerCase() === wanted;
    };
  } else {
    var account = await getUser(access.email).catch(function() { return null; });
    var identity = repIdentity(getCloserProfile(access.email), access.email, account && account.name);
    subject = identity.name;
    owns = function(record, emailField, nameField) {
      return identity.owns(record, emailField, nameField);
    };
  }

  // Scoped to the workspace the caller is standing in, before anything is counted.
  var store = getStore();
  function here(list) {
    return (list || []).filter(function(r) { return matchesWorkspace(r, workspaceId); });
  }
  var input = {
    day: day,
    owns: owns,
    booked: here(store.bookedCalls),
    deals: here(store.closedDeals),
    afterCalls: here(getAfterCallReports(workspaceId)),
  };

  var draft = mode === 'dm' ? buildDmEodDraft(input)
    : mode === 'setter' ? buildSetterEodDraft(input)
    : buildEodDraft(input);

  return NextResponse.json({
    success: true,
    role: mode,
    rep: subject,
    workspaceId: workspaceId || null,
    day: draft.day,
    fields: draft.fields,
    notes: draft.notes,
    counts: draft.counts,
  });
}
