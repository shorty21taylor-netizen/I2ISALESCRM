import { NextResponse } from 'next/server';
import { initStore, loadAnalysis } from '@/lib/store';
import { resolveAccess, effectiveReadWorkspace, OWNER_EMAIL } from '@/lib/access';
import { sendWorkspaceMessage } from '@/lib/notify-server';

export var dynamic = 'force-dynamic';

// Posting the headline to the team's END OF DAY REPORTS group. Operator only —
// it carries the whole floor's figures — and it sends only what is already
// cached, so it cannot trigger an analysis and can never bill.
//
// The destination comes from this workspace's own eod-report route, never from
// the install-wide group id. sendGroupMessage() would have posted one company's
// numbers into whichever group the deployment happens to have configured.
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
    var key = 'eod:' + (workspaceId || 'none') + ':all:' + (body.from || 'all') + ':' + (body.to || 'all');
    var payload = await loadAnalysis(key);
    if (!payload || !payload.result) {
      return NextResponse.json({ error: 'Run the analysis before sending it.' }, { status: 400 });
    }

    var r = payload.result;
    var leaks = (Array.isArray(r.funnelLeaks) ? r.funnelLeaks : []).filter(Boolean);
    var worst = leaks[0];

    var lines = ['*EOD ANALYSIS*', ''];
    if (r.headline) lines.push(r.headline, '');
    lines.push((payload.reportsAnalyzed || 0) + ' reports · ' + (payload.repsAnalyzed || 0)
      + ' reps · ' + (payload.businessDays || 0) + ' days · ' + (r.confidence || 'unknown') + ' confidence', '');
    if (worst) {
      lines.push('*WORST LEAK*');
      lines.push(String(worst.stage || '').toUpperCase() + ' — ' + (worst.metric || ''));
      if (worst.observation) lines.push(worst.observation);
      if (worst.fix) lines.push('Fix: ' + worst.fix);
      lines.push('');
    }
    if (r.topFix) lines.push('*THIS WEEK’S ONE FIX*', r.topFix);

    var sent = await sendWorkspaceMessage({
      req: req, workspaceId: workspaceId, formKey: 'eod-report',
      kind: 'eod-analysis', label: 'EOD analysis',
      message: lines.join('\n'),
    });
    if (sent.unrouted) {
      return NextResponse.json({ error: sent.reason }, { status: 409 });
    }
    if (!sent.sent) {
      return NextResponse.json({ error: sent.error || sent.reason || 'WhatsApp refused the message.' }, { status: 502 });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[EOD analysis share]', e);
    return NextResponse.json({ error: 'Could not send it.' }, { status: 500 });
  }
}
