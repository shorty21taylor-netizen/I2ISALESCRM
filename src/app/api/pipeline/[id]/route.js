import { NextResponse } from 'next/server';
import { initStore, getPipelineRecord, updatePipelineRecord, getPipelineEvents, deleteRecord } from '@/lib/store';
import { callerEmail, OWNER_EMAIL, effectiveReadWorkspace, matchesWorkspace } from '@/lib/access';
import { pipelineViewer, authorizeMove, authorizeAssignment } from '@/lib/pipeline-access';
import { isStage } from '@/lib/pipeline';

export var dynamic = 'force-dynamic';

// One card with its full history, for the detail drawer.
export async function GET(req, ctx) {
  await initStore();
  try {
    var p = await ctx.params;
    if (!p || !p.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    var viewer = await pipelineViewer(req);
    if (viewer.anonymous) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

    var record = getPipelineRecord(p.id);
    var workspaceId = await effectiveReadWorkspace(req, null);
    // A record outside the caller's workspace does not exist as far as they are
    // concerned, whatever their role in their own.
    if (record && !viewer.isOwner && !matchesWorkspace(record, workspaceId)) record = null;

    var relation = record ? viewer.relation(record) : '';
    if (!record || !relation) {
      return NextResponse.json({ error: 'No such pipeline record.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      record: Object.assign({}, record, { relation: relation }),
      events: getPipelineEvents(record.id),
    });
  } catch (e) {
    console.error('[Pipeline detail GET Error]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// Moving a card, or correcting what is on it.
//
// The permission check is here and only here. The board disables what it believes
// the caller cannot move, but that is a courtesy — a setter POSTing `showed` to
// `won` straight at this route is refused on the same rule.
export async function PATCH(req, ctx) {
  await initStore();
  try {
    var p = await ctx.params;
    if (!p || !p.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    var viewer = await pipelineViewer(req);
    if (viewer.anonymous) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

    var body = await req.json();

    var record = getPipelineRecord(p.id);
    var workspaceId = await effectiveReadWorkspace(req, null);
    if (record && !viewer.isOwner && !matchesWorkspace(record, workspaceId)) record = null;
    if (!record) return NextResponse.json({ error: 'No such pipeline record.' }, { status: 404 });

    if (body.stage !== undefined && !isStage(String(body.stage))) {
      return NextResponse.json({ error: 'Unknown stage: ' + body.stage }, { status: 400 });
    }

    // A move is checked against both ends of the transition. An edit that does not
    // change the stage still has to come from somebody on the record.
    var target = body.stage !== undefined ? String(body.stage) : record.stage;
    var verdict = authorizeMove(viewer, record, target);
    if (!verdict.ok) {
      return NextResponse.json({ error: verdict.reason }, { status: verdict.status });
    }

    var assignment = authorizeAssignment(viewer, body);
    if (!assignment.ok) {
      return NextResponse.json({ error: assignment.reason }, { status: assignment.status });
    }

    // The workspace is never editable. Moving a record between clients' books is not
    // a correction, it is a data leak.
    delete body.workspaceId;

    var result = updatePipelineRecord(record.id, body, {
      email: viewer.email, name: viewer.name, type: 'rep', note: body.moveNote || '',
    });
    if (result.error) return NextResponse.json({ error: result.error }, { status: 404 });

    return NextResponse.json({
      success: true,
      record: Object.assign({}, result.record, { relation: viewer.relation(result.record) }),
      events: getPipelineEvents(record.id),
    });
  } catch (e) {
    console.error('[Pipeline PATCH Error]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// Soft delete, operator only — same as every other record type.
export async function DELETE(req, ctx) {
  await initStore();
  try {
    if ((await callerEmail(req)) !== OWNER_EMAIL) {
      return NextResponse.json({ error: 'Operator access required' }, { status: 403 });
    }
    var p = await ctx.params;
    if (!p || !p.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    var result = await deleteRecord('pipeline', p.id);
    if (result.error) {
      var missing = result.error.indexOf('No ') === 0;
      return NextResponse.json({ error: result.error }, { status: missing ? 404 : 500 });
    }
    return NextResponse.json({ success: true, id: p.id, deleted: result.deleted });
  } catch (e) {
    console.error('[Pipeline DELETE Error]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
