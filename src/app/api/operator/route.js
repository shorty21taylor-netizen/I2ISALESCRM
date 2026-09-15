import { NextResponse } from 'next/server';
import {
  initStore, getStore, getWorkspaces, getDisplayNameState,
  loadOperatorConfigFor, setOperatorConfig,
  getOperatorWorkspaceId, setOperatorWorkspaceId,
} from '@/lib/store';
import { resolveAccess } from '@/lib/access';
import { seedConfig, computeOperator, sanitizeConfig, dealsInRange } from '@/lib/operator';
import { todayInReportTimezone } from '@/lib/report-date';

export var dynamic = 'force-dynamic';

// The operator's own pay page. It reads across every workspace by design, which
// is exactly why it is gated on being the operator rather than on canSeeTeam — a
// manager of one client has no business seeing another client's cash, and this
// page is nothing but that.
async function gate(req) {
  var access = await resolveAccess(req);
  if (!access.email) {
    return { denied: NextResponse.json({ error: 'Sign in first' }, { status: 401 }) };
  }
  if (!access.isOperator) {
    return { denied: NextResponse.json({ error: 'Operator access required' }, { status: 403 }) };
  }
  return { access: access };
}

// Deals carry the closer's NAME, never their address, so matching the operator's
// own closes on their email silently matched nothing and their closing commission
// always read zero. The confirmed display name is the only thing that lines up.
function operatorName(email) {
  var state = getDisplayNameState(email);
  return (state && state.displayName) || email;
}

export async function GET(req) {
  await initStore();
  var g = await gate(req);
  if (g.denied) return g.denied;

  try {
    var url = new URL(req.url);
    var today = todayInReportTimezone();
    var start = url.searchParams.get('start') || today;
    var end = url.searchParams.get('end') || today;

    var all = getStore().closedDeals || [];
    var workspaces = getWorkspaces();

    // Seeding reads every deal, not just the window's: an offer that sold nothing
    // this week still needs its rate to exist, or the rate would disappear from
    // the table whenever the range was narrowed.
    var stored = await loadOperatorConfigFor(g.access.email);
    var config = seedConfig(stored, all, workspaces);
    if (!stored) await setOperatorConfig(g.access.email, config);

    var windowDeals = dealsInRange(all, start, end);
    var myName = operatorName(g.access.email);
    var computed = computeOperator(windowDeals, config, myName);

    return NextResponse.json({
      success: true,
      dateRange: { start: start, end: end },
      config: config,
      computed: computed,
      myName: myName,
      operatorWorkspaceId: await getOperatorWorkspaceId(),
      // Lean rows — enough for the client to recompute a toggle without a refetch,
      // and nothing more. The full deal record has no business on this page.
      deals: windowDeals.map(function (d) {
        return {
          id: d.id,
          workspaceId: d.workspaceId || 'default',
          program: d.program || '',
          closer: d.closer || '',
          cashCollected: Number(d.cashCollected) || 0,
          submittedAt: d.submittedAt || '',
        };
      }),
    });
  } catch (e) {
    console.error('[Operator API GET]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  await initStore();
  var g = await gate(req);
  if (g.denied) return g.denied;

  try {
    var body = await req.json().catch(function () { return {}; });

    // Setting which workspace is the console is a separate, smaller action.
    // It must name a workspace that exists: storing a blank or a stale id would
    // leave the nav falling back to a name match and quietly showing Operator
    // View inside a client's workspace.
    if (body && body.action === 'set-operator-workspace') {
      var target = String(body.workspaceId || '').trim();
      var exists = getWorkspaces().filter(Boolean).some(function (w) { return w.id === target; });
      if (!target || !exists) {
        return NextResponse.json({ error: 'Name a workspace that exists.' }, { status: 400 });
      }
      var saved = await setOperatorWorkspaceId(target);
      return NextResponse.json({ success: true, operatorWorkspaceId: saved.workspaceId });
    }

    var ids = getWorkspaces().filter(Boolean).map(function (w) { return w.id; });
    var clean = sanitizeConfig(body, ids);
    var result = await setOperatorConfig(g.access.email, clean);

    var all = getStore().closedDeals || [];
    var url = new URL(req.url);
    var today = todayInReportTimezone();
    var windowDeals = dealsInRange(all, url.searchParams.get('start') || today, url.searchParams.get('end') || today);

    return NextResponse.json({
      success: true,
      // False means it is live in this process but did not reach Postgres. The
      // page says so rather than showing a green tick over a lost setting.
      persisted: result.persisted !== false,
      config: clean,
      myName: operatorName(g.access.email),
      computed: computeOperator(windowDeals, clean, operatorName(g.access.email)),
    });
  } catch (e) {
    console.error('[Operator API POST]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
