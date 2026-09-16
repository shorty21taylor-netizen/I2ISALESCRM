import { NextResponse } from 'next/server';
import { initStore, loadAnalysis } from '@/lib/store';
import { resolveAccess, effectiveReadWorkspace, OWNER_EMAIL } from '@/lib/access';
import { sendWorkspaceMessage } from '@/lib/notify-server';
import { analysisKey } from '@/lib/ai-analyst';

export var dynamic = 'force-dynamic';

// Posting the headline to the team group. Operator only — it carries the whole
// floor's findings, and the rep-flag names never leave the page at all.
//
// Two things it will not do. It sends only what is already cached, so it cannot
// trigger an analysis and can never bill. And the destination comes from this
// workspace's own route, never from the install-wide group id — sending one
// company's numbers into another company's group is the exact failure the
// notification layer was rebuilt to make impossible.
export async function POST(req) {
  await initStore();
  try {
    var access = await resolveAccess(req);
    if (!access.signedIn) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
    if (access.email !== OWNER_EMAIL && !access.canSeeTeam) {
      return NextResponse.json({ error: 'Manager access required.' }, { status: 403 });
    }

    var body = await req.json().catch(function() { return {}; });
    var workspaceId = await effectiveReadWorkspace(req, body.workspace || '');
    var key = analysisKey(workspaceId, 'all', body.from, body.to);
    var payload = await loadAnalysis(key);
    if (!payload || !payload.result) {
      return NextResponse.json({ error: 'Run the analysis before sending it.' }, { status: 400 });
    }

    var r = payload.result;
    var objections = (Array.isArray(r.objections) ? r.objections : []).filter(Boolean).slice(0, 3);
    var lines = ['*AFTER-CALL ANALYSIS*', ''];
    if (r.headline) lines.push(r.headline, '');
    lines.push('Based on ' + (payload.callsAnalyzed || 0) + ' calls · ' + (r.confidence || 'unknown') + ' confidence', '');
    if (objections.length) {
      lines.push('*TOP OBJECTIONS*');
      objections.forEach(function(o, i) {
        lines.push((i + 1) + '. ' + o.name + ' — ' + (o.count || 0) + ' calls (' + (o.pct || 0) + '%)');
      });
      lines.push('');
    }
    if (r.topFix) lines.push('*THIS WEEK’S ONE FIX*', r.topFix);

    var sent = await sendWorkspaceMessage({
      req: req, workspaceId: workspaceId, formKey: 'after-call',
      kind: 'after-call-analysis', label: 'After-call analysis',
      message: lines.join('\n'),
    });
    if (sent.unrouted) {
      // Refused rather than guessed at. A workspace with no after-call route has
      // not told us where its team reads things, and the install-wide group is
      // somebody else's.
      return NextResponse.json({ error: sent.reason }, { status: 409 });
    }
    if (!sent.sent) {
      return NextResponse.json({ error: sent.error || sent.reason || 'WhatsApp refused the message.' }, { status: 502 });
    }
    return NextResponse.json({ success: true, destination: sent.destination || undefined });
  } catch (e) {
    console.error('[After-call analysis share]', e);
    return NextResponse.json({ error: 'Could not send it.' }, { status: 500 });
  }
}
