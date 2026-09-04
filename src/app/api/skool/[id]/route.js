import { NextResponse } from 'next/server';
import { initStore, updateSkoolLead, deleteRecord } from '@/lib/store';
import { callerEmail, OWNER_EMAIL } from '@/lib/access';
import { validateStageAndCommunity } from '../route';

export var dynamic = 'force-dynamic';

// Moving a lead along the pipeline, or correcting what they paid.
export async function PATCH(req, ctx) {
  await initStore();
  try {
    var p = await ctx.params;
    if (!p || !p.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    var body = await req.json();
    var bad = validateStageAndCommunity(body);
    if (bad) return NextResponse.json({ error: bad }, { status: 400 });

    var result = updateSkoolLead(p.id, body);
    if (result.error) return NextResponse.json({ error: result.error }, { status: 404 });

    return NextResponse.json({ success: true, lead: result.lead });
  } catch (e) {
    console.error('[Skool PATCH Error]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// Soft delete, like every other record: the row stays in Postgres with deleted_at
// stamped so a mis-click on a lead someone has been working is recoverable.
export async function DELETE(req, ctx) {
  await initStore();
  try {
    if (callerEmail(req) !== OWNER_EMAIL) {
      return NextResponse.json({ error: 'Operator access required' }, { status: 403 });
    }
    var p = await ctx.params;
    if (!p || !p.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    var result = await deleteRecord('skool-lead', p.id);
    if (result.error) {
      var missing = result.error.indexOf('No ') === 0;
      return NextResponse.json({ error: result.error }, { status: missing ? 404 : 500 });
    }
    return NextResponse.json({ success: true, id: p.id, deleted: result.deleted });
  } catch (e) {
    console.error('[Skool DELETE Error]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
