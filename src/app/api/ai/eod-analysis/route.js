import { NextResponse } from 'next/server';
import { initStore, getStore, loadAnalysis, setAnalysis } from '@/lib/store';
import { resolveAccess, effectiveReadWorkspace, matchesWorkspace, OWNER_EMAIL } from '@/lib/access';
import { repScope, scopeList } from '@/lib/rep-scope';
import { aggregateEod, analyzeEod, businessDaysBetween } from '@/lib/eod-analyst';
import { recordDay } from '@/lib/report-date';

export var dynamic = 'force-dynamic';

// Reading the EOD reports with Summit Sales AI.
//
// The arithmetic is all done before the model is called — see eod-analyst.js.
// This route's job is who may ask, what they are allowed to be shown, and never
// paying twice for the same question.

var MIN_REPORTS = 3;
var COOLDOWN_MS = 60 * 1000;

// In memory, deliberately: a rate limit here is a courtesy against double-clicks
// and runaway retries, not a security control, and it should reset on deploy.
var lastRun = {};

// The workspace belongs in the key for the same reason it does on the after-call
// analysis: two operators both scope to 'all' over the same week, and without it
// the second company asking is served the first company's answer.
function keyFor(workspaceId, scope, from, to) {
  return 'eod:' + (workspaceId || 'none') + ':' + scope + ':' + (from || 'all') + ':' + (to || 'all');
}

async function context(req) {
  var access = await resolveAccess(req);
  if (!access.signedIn || !access.email) {
    return { denied: NextResponse.json({ error: 'Sign in first.' }, { status: 401 }) };
  }
  var url = new URL(req.url);
  var workspaceId = await effectiveReadWorkspace(req, url.searchParams.get('workspace'));

  // An operator reads the floor. Everybody else is forced to their own reports,
  // whatever they ask for — and the forcing happens here, on the server, not by
  // a page choosing to render less.
  var isAdmin = access.email === OWNER_EMAIL || !!access.canSeeTeam;

  return {
    access: access, workspaceId: workspaceId, isAdmin: isAdmin,
    scope: isAdmin ? 'all' : access.email,
  };
}

// The same scoping the EOD Logs list itself goes through, so the analysis can
// never cover rows the caller is not allowed to read.
async function reportsIn(req, workspaceId, from, to) {
  var rows = (getStore().eodReports || [])
    .filter(Boolean)
    .filter(function(r) { return matchesWorkspace(r, workspaceId); })
    .filter(function(r) {
      var day = recordDay(r);
      if (!day) return false;
      if (from && day < from) return false;
      if (to && day > to) return false;
      return true;
    });
  var scope = await repScope(req);
  return scopeList(scope, rows, 'eod');
}

// A rep is never handed the sections that name other people. repFlags is the
// point of the red-flag board and dataIntegrity lists who did not report — both
// are a manager's business and nobody else's.
function shaped(payload, isAdmin) {
  if (isAdmin || !payload || !payload.result) return payload;
  var result = Object.assign({}, payload.result, { repFlags: [], dataIntegrity: [] });
  return Object.assign({}, payload, { result: result });
}

export async function GET(req) {
  await initStore();
  try {
    var ctx = await context(req);
    if (ctx.denied) return ctx.denied;

    var url = new URL(req.url);
    var from = url.searchParams.get('from') || '';
    var to = url.searchParams.get('to') || '';

    var cached = await loadAnalysis(keyFor(ctx.workspaceId, ctx.scope, from, to));
    var rows = await reportsIn(req, ctx.workspaceId, from, to);
    var days = businessDaysBetween(from, to);
    var aggregate = aggregateEod(rows, days);

    // No model call and no billing on this path, ever. The aggregate still goes
    // back, so the button can say how much it would be reading.
    return NextResponse.json(Object.assign({
      success: true,
      cached: !!cached,
      isAdmin: ctx.isAdmin,
      aggregate: aggregate,
    }, cached ? shaped(cached, ctx.isAdmin) : {}));
  } catch (e) {
    console.error('[EOD analysis GET]', e);
    return NextResponse.json({ error: 'Could not read the analysis.' }, { status: 500 });
  }
}

export async function POST(req) {
  await initStore();
  try {
    var ctx = await context(req);
    if (ctx.denied) return ctx.denied;

    var body = await req.json().catch(function() { return {}; });
    var from = String(body.from || '');
    var to = String(body.to || '');
    var key = keyFor(ctx.workspaceId, ctx.scope, from, to);
    var cooldownKey = (ctx.workspaceId || 'none') + ':' + ctx.scope;

    if (!body.force) {
      var cached = await loadAnalysis(key);
      if (cached) {
        var rowsForCache = await reportsIn(req, ctx.workspaceId, from, to);
        return NextResponse.json(Object.assign(
          { success: true, cached: true, isAdmin: ctx.isAdmin,
            aggregate: aggregateEod(rowsForCache, businessDaysBetween(from, to)) },
          shaped(cached, ctx.isAdmin)
        ));
      }
    }

    var since = Date.now() - (lastRun[cooldownKey] || 0);
    if (since < COOLDOWN_MS) {
      return NextResponse.json({
        error: 'Give it ' + Math.ceil((COOLDOWN_MS - since) / 1000) + ' seconds before running another analysis.',
      }, { status: 429 });
    }

    var rows = await reportsIn(req, ctx.workspaceId, from, to);
    var days = businessDaysBetween(from, to);
    var aggregate = aggregateEod(rows, days);

    // Too thin to say anything honest. Said plainly rather than run anyway and
    // have the model manufacture a funnel out of two days.
    if (aggregate.reportCount < MIN_REPORTS) {
      return NextResponse.json({
        error: aggregate.reportCount === 0 && aggregate.setterReportCount > 0
          ? 'The ' + aggregate.setterReportCount + ' report(s) in this range are all setter reports, which'
            + ' carry no pitches or closes. There is no closing funnel to read.'
          : 'Only ' + aggregate.reportCount + ' EOD report(s) in this range. At least '
            + MIN_REPORTS + ' are needed before an analysis means anything.',
        aggregate: aggregate,
      }, { status: 400 });
    }

    lastRun[cooldownKey] = Date.now();
    var outcome = await analyzeEod(aggregate, {});
    if (outcome.error) {
      // A failed run should not burn the cooldown for a minute.
      lastRun[cooldownKey] = 0;
      return NextResponse.json({ error: outcome.error }, { status: outcome.error === 'AI not configured' ? 503 : 502 });
    }

    var payload = {
      result: outcome.result,
      model: outcome.model,
      reportsAnalyzed: aggregate.reportCount,
      repsAnalyzed: aggregate.repCount,
      businessDays: aggregate.range.businessDays,
      requestedBy: ctx.access.email,
      createdAt: new Date().toISOString(),
    };
    var saved = await setAnalysis(key, payload);

    return NextResponse.json(Object.assign({
      success: true, cached: false, isAdmin: ctx.isAdmin,
      persisted: saved.persisted !== false,
      aggregate: aggregate,
    }, shaped(payload, ctx.isAdmin)));
  } catch (e) {
    console.error('[EOD analysis POST]', e);
    return NextResponse.json({ error: 'The analysis could not run.' }, { status: 500 });
  }
}
