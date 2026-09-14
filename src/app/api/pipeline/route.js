import { NextResponse } from 'next/server';
import { initStore, getPipelineRecords, addPipelineRecord } from '@/lib/store';
import { effectiveReadWorkspace, effectiveWriteWorkspace } from '@/lib/access';
import { pipelineViewer } from '@/lib/pipeline-access';
import { computePipelineStats, isStage, defaultView, DEFAULT_STAGE, SETTER_MOVABLE } from '@/lib/pipeline';

export var dynamic = 'force-dynamic';

// The board. One query, role-scoped twice: to the caller's workspace, then to the
// records they are actually on. A rep never receives another rep's cards at all —
// they are not hidden in the browser, they are never sent.
export async function GET(req) {
  await initStore();
  try {
    var url = new URL(req.url);
    var viewer = await pipelineViewer(req);
    if (viewer.anonymous) {
      return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
    }

    var workspaceId = await effectiveReadWorkspace(req, url.searchParams.get('workspace'));
    var all = getPipelineRecords(workspaceId);
    var mine = viewer.visible(all);

    // Managers may narrow to one rep. A rep asking for someone else gets their own
    // records regardless, because the scope above has already run.
    var repFilter = (url.searchParams.get('rep') || '').trim().toLowerCase();
    var rows = mine;
    if (repFilter && viewer.senior) {
      rows = mine.filter(function(r) {
        return String(r.setter || '').toLowerCase() === repFilter
          || String(r.closer || '').toLowerCase() === repFilter
          || String(r.setterEmail || '').toLowerCase() === repFilter
          || String(r.closerEmail || '').toLowerCase() === repFilter;
      });
    }

    var view = url.searchParams.get('view');
    if (view !== 'setter' && view !== 'closer') view = defaultView(viewer.role);

    // The caller's relation to each card, decided here rather than guessed by the
    // page — the page uses it to know what is draggable, and this is the same
    // function the PATCH route enforces with.
    var data = rows.map(function(r) {
      return Object.assign({}, r, { relation: viewer.relation(r) });
    });

    // A booking that arrived with no resolvable setter would otherwise be invisible
    // to everyone. Managers get it in its own tray rather than it being dropped.
    var unattributed = viewer.senior
      ? all.filter(function(r) { return !r.setter && !r.setterEmail; })
      : [];

    return NextResponse.json({
      success: true,
      data: data,
      total: data.length,
      view: view,
      viewer: { email: viewer.email, name: viewer.name, role: viewer.role, senior: viewer.senior },
      stats: computePipelineStats(rows, view),
      unattributed: unattributed,
      workspaceId: workspaceId || null,
    });
  } catch (e) {
    console.error('[Pipeline GET Error]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// A card added by hand — a setter working a lead that did not come from a form.
export async function POST(req) {
  await initStore();
  try {
    var viewer = await pipelineViewer(req);
    if (viewer.anonymous) {
      return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
    }

    var body = await req.json();
    if (!body.prospectName || !String(body.prospectName).trim()) {
      return NextResponse.json({ error: 'A prospect name is required' }, { status: 400 });
    }
    var stage = body.stage ? String(body.stage) : DEFAULT_STAGE;
    if (!isStage(stage)) {
      return NextResponse.json({ error: 'Unknown stage: ' + stage }, { status: 400 });
    }
    // A rep cannot create a card already past the point they are allowed to move it
    // to. Otherwise "you may not drag this to won" is bypassed by creating it there.
    if (!viewer.senior && SETTER_MOVABLE.indexOf(stage) === -1) {
      return NextResponse.json({ error: 'You cannot create a record at that stage.' }, { status: 403 });
    }
    body.stage = stage;

    // A rep only ever creates their own cards; the identity comes from the session,
    // never from the body. Managers may file on someone's behalf.
    if (!viewer.senior) {
      body.setter = viewer.name;
      body.setterEmail = viewer.email;
    }

    body.workspaceId = await effectiveWriteWorkspace(req, body.workspaceId);
    var record = addPipelineRecord(body, { email: viewer.email, name: viewer.name, type: 'rep' });
    console.log('[Pipeline] Added', record.prospectName, '-', record.stage, '| workspace=' + record.workspaceId);
    return NextResponse.json({ success: true, record: record });
  } catch (e) {
    console.error('[Pipeline POST Error]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
