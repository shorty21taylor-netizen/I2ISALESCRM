import { NextResponse } from 'next/server';
import { initStore, getStore, loadAnalysis, setAnalysis } from '@/lib/store';
import { resolveAccess, effectiveReadWorkspace, matchesWorkspace, OWNER_EMAIL } from '@/lib/access';
import { buildCorpus, analyzeAfterCalls, analysisKey } from '@/lib/ai-analyst';
import { pipelineViewer } from '@/lib/pipeline-access';
import { toReportDay } from '@/lib/report-date';

export var dynamic = 'force-dynamic';

// Reading the after-call reports with Summit Sales AI.
//
// Two things this route is careful about. The answer is cached by what it
// analysed, so re-opening the page costs nothing; and a rep only ever gets their
// own calls back, with the rep flags stripped — the whole point of that section
// is naming people, which is a manager's business and nobody else's.

var MIN_REPORTS = 3;
var COOLDOWN_MS = 60 * 1000;

// In memory, deliberately: a rate limit is a courtesy against double-clicks and
// runaway retries, not a security control, and it should reset on deploy.
var lastRun = {};

// The workspace is part of the key, not an afterthought. Without it, two
// companies' operators both scope to 'all' over the same week and the second one
// is served the first one's analysis — their reps named, their objections, their
// numbers. Everything that changed the answer has to be in the key. The key
// itself is built in ai-analyst.js so the share route cannot drift from it.
var keyFor = analysisKey;

function inRange(day, from, to) {
  if (!day) return false;
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}

async function context(req) {
  var access = await resolveAccess(req);
  if (!access.signedIn || !access.email) {
    return { denied: NextResponse.json({ error: 'Sign in first.' }, { status: 401 }) };
  }
  var url = new URL(req.url);
  var workspaceId = await effectiveReadWorkspace(req, url.searchParams.get('workspace'));
  // An operator reads the floor; anyone else is forced to their own calls
  // whatever they ask for.
  var isAdmin = access.email === OWNER_EMAIL || !!access.canSeeTeam;

  // Whose calls these are is decided by repIdentity, not by the email alone —
  // a manager who filed on a rep's behalf must not be handed that rep's calls
  // as their own. pipelineViewer already resolves the name a rep's records are
  // filed under, roster fallback included.
  var viewer = isAdmin ? null : await pipelineViewer(req);
  // Fail closed: a non-admin whose identity could not be resolved gets nothing,
  // never the unscoped floor.
  if (!isAdmin && !(viewer && viewer.identity)) {
    return { denied: NextResponse.json({ error: 'Your account is not on this workspace.' }, { status: 403 }) };
  }

  return {
    access: access, workspaceId: workspaceId, isAdmin: isAdmin,
    identity: viewer ? viewer.identity : null,
    scope: isAdmin ? 'all' : access.email,
  };
}

function reportsIn(workspaceId, from, to) {
  return (getStore().afterCallReports || [])
    .filter(Boolean)
    .filter(function(r) { return matchesWorkspace(r, workspaceId); })
    .filter(function(r) { return inRange(toReportDay(r.submittedAt), from, to); });
}

// A rep must never be handed the rep-flags section — it names colleagues.
function shaped(payload, isAdmin) {
  if (isAdmin || !payload || !payload.result) return payload;
  var result = Object.assign({}, payload.result, { repFlags: [] });
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
    var available = reportsIn(ctx.workspaceId, from, to);
    var corpus = buildCorpus(available, { identity: ctx.identity });

    // No model call and no billing on this path, ever.
    return NextResponse.json(Object.assign({
      success: true,
      cached: !!cached,
      isAdmin: ctx.isAdmin,
      available: corpus.total,
      withoutNotes: corpus.dropped,
    }, cached ? shaped(cached, ctx.isAdmin) : {}));
  } catch (e) {
    console.error('[After-call analysis GET]', e);
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
        return NextResponse.json(Object.assign({ success: true, cached: true, isAdmin: ctx.isAdmin },
          shaped(cached, ctx.isAdmin)));
      }
    }

    var since = Date.now() - (lastRun[cooldownKey] || 0);
    if (since < COOLDOWN_MS) {
      return NextResponse.json({
        error: 'Give it ' + Math.ceil((COOLDOWN_MS - since) / 1000) + ' seconds before running another analysis.',
      }, { status: 429 });
    }

    var corpus = buildCorpus(reportsIn(ctx.workspaceId, from, to), { identity: ctx.identity });

    // Too thin to say anything honest. Said plainly rather than run anyway and
    // have the model manufacture a pattern out of two calls.
    if (corpus.reports.length < MIN_REPORTS) {
      return NextResponse.json({
        error: corpus.total === 0 && corpus.dropped > 0
          ? 'There are ' + corpus.dropped + ' reports in this range but none of them have written notes to read.'
          : 'Only ' + corpus.reports.length + ' report(s) in this range have notes. At least '
            + MIN_REPORTS + ' are needed before an analysis means anything.',
      }, { status: 400 });
    }

    lastRun[cooldownKey] = Date.now();
    var outcome = await analyzeAfterCalls(corpus, {});
    if (outcome.error) {
      // A failed run should not burn the cooldown for a minute.
      lastRun[cooldownKey] = 0;
      return NextResponse.json({ error: outcome.error }, { status: outcome.error === 'AI not configured' ? 503 : 502 });
    }

    var payload = {
      result: outcome.result,
      model: outcome.model,
      callsAnalyzed: corpus.reports.length,
      totalInRange: corpus.total,
      withoutNotes: corpus.dropped,
      sampled: corpus.sampled,
      requestedBy: ctx.access.email,
      createdAt: new Date().toISOString(),
    };
    var saved = await setAnalysis(key, payload);

    return NextResponse.json(Object.assign({
      success: true, cached: false, isAdmin: ctx.isAdmin, persisted: saved.persisted !== false,
    }, shaped(payload, ctx.isAdmin)));
  } catch (e) {
    console.error('[After-call analysis POST]', e);
    return NextResponse.json({ error: 'The analysis could not run.' }, { status: 500 });
  }
}
