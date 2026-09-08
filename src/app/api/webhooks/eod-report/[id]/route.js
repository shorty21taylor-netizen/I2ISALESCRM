import { NextResponse } from 'next/server';
import { makeDeleteHandler } from '@/lib/delete-route';
import { initStore, updateEODReport } from '@/lib/store';
import { callerEmail, OWNER_EMAIL } from '@/lib/access';

export var dynamic = 'force-dynamic';

export var DELETE = makeDeleteHandler('eod-report');

// Correct a number someone typed into the wrong box. Operator-only, and what was
// originally filed is kept on the record rather than overwritten.
export async function PATCH(req, ctx) {
  await initStore();
  try {
    var caller = callerEmail(req);
    if (caller !== OWNER_EMAIL) {
      return NextResponse.json({ error: 'Operator access required' }, { status: 403 });
    }
    var p = await ctx.params;
    if (!p || !p.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    var body = await req.json();
    var result = updateEODReport(p.id, body, caller);
    if (result.error) {
      var missing = result.error.indexOf('No EOD') === 0;
      return NextResponse.json({ error: result.error }, { status: missing ? 404 : 400 });
    }
    return NextResponse.json({ success: true, report: result.report, changes: result.changes });
  } catch (e) {
    console.error('[EOD PATCH Error]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
