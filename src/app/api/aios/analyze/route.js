import { NextResponse } from 'next/server';
import { initStore, getOnboardingSteps } from '@/lib/store';
import { resolveAccess, effectiveReadWorkspace, onboardingOwed } from '@/lib/access';
import { repScope } from '@/lib/rep-scope';
import { buildContext } from '@/lib/aios/handlers';
import { askAios } from '@/lib/aios/agent';
import { checkLimit, recordAsk } from '@/lib/aios/limits';
import { buildAnalysisPrompt, isSurface, SURFACES } from '@/lib/aios/analyze';
import { RANGE_IDS, isDay } from '@/lib/aios/range';

export var dynamic = 'force-dynamic';

// A wider read than a chat turn gets. Finding a pattern means checking the funnel,
// the trend, the prior period and the data quality before saying anything.
var ANALYSIS_TOOL_BUDGET = 14;

export async function POST(req) {
  await initStore();
  try {
    var access = await resolveAccess(req);
    if (!access.email) {
      return NextResponse.json({ error: 'Sign in to run an analysis.' }, { status: 401 });
    }

    // This reads the whole floor and names reps against their numbers, so it is a
    // manager's view. A rep pressing it would be handed their colleagues' figures
    // by a route that never asked whether they should see them.
    if (!access.canSeeTeam) {
      return NextResponse.json({
        error: 'Analysis covers the whole floor, so it is available to managers and the operator.',
      }, { status: 403 });
    }

    if (onboardingOwed(access, getOnboardingSteps(access.email))) {
      return NextResponse.json({ error: 'Finish onboarding first.', onboardingRequired: true }, { status: 403 });
    }

    var body = await req.json().catch(function() { return {}; });

    var surface = String(body.surface || 'metrics');
    if (!isSurface(surface)) {
      return NextResponse.json({ error: 'Unknown surface.' }, { status: 400 });
    }

    var rangeId = String(body.range || 'month');
    if (RANGE_IDS.indexOf(rangeId) === -1) {
      return NextResponse.json({ error: 'Unknown range.' }, { status: 400 });
    }
    if (rangeId === 'custom' && !(isDay(body.start) && isDay(body.end))) {
      return NextResponse.json({ error: 'A custom range needs a start and end date.' }, { status: 400 });
    }

    // An analysis costs several model turns, so it spends from the same daily
    // allowance a question does rather than running free alongside it.
    var limit = checkLimit(access.email);
    if (!limit.ok) return NextResponse.json({ error: limit.error }, { status: limit.status });

    var url = new URL(req.url);
    var workspaceId = await effectiveReadWorkspace(req, body.workspace || url.searchParams.get('workspace'));
    var scope = await repScope(req);

    var ctx = buildContext({
      access: access,
      workspaceId: workspaceId,
      scope: scope,
      selfName: scope ? scope.name : (access.email || ''),
    });

    var range = { id: rangeId, start: body.start || null, end: body.end || null };
    var prompt = buildAnalysisPrompt(surface, range);

    var answer = await askAios(ctx, prompt, [], { maxToolCalls: ANALYSIS_TOOL_BUDGET });
    if (answer.error) {
      return NextResponse.json({ error: answer.error }, { status: answer.status || 500 });
    }

    recordAsk(access.email, limit.day);

    return NextResponse.json({
      success: true,
      surface: surface,
      surfaceLabel: SURFACES[surface].label,
      range: range,
      text: answer.text,
      // What it actually read, so a finding can be checked rather than believed.
      trace: (answer.trace || []).map(function(t) { return { tool: t.tool, ok: t.ok }; }),
    });
  } catch (e) {
    console.error('[AIOS Analyze]', e);
    return NextResponse.json({ error: 'The analysis hit an error. Try it again in a moment.' }, { status: 500 });
  }
}
