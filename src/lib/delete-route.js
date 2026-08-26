// Shared DELETE handler for the four record types.
//
// The pages have had delete buttons for a while, but the routes behind them were
// never built — every click 404'd, the list refetched, and the row was still there.
// Deletion of live sales data is operator-only, and it is enforced here on the
// server: hiding the button in the UI is not a permission check.

import { NextResponse } from 'next/server';
import { initStore, deleteRecord } from '@/lib/store';
import { callerEmail, OWNER_EMAIL } from '@/lib/access';

export function makeDeleteHandler(kind) {
  return async function DELETE(req, ctx) {
    await initStore();
    try {
      if (callerEmail(req) !== OWNER_EMAIL) {
        return NextResponse.json({ error: 'Operator access required' }, { status: 403 });
      }

      var p = await ctx.params;
      var id = p && p.id;
      if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

      var result = await deleteRecord(kind, id);
      if (result.error) {
        var missing = result.error.indexOf('No ') === 0;
        return NextResponse.json({ error: result.error }, { status: missing ? 404 : 500 });
      }

      return NextResponse.json({ success: true, id: id, deleted: result.deleted });
    } catch (e) {
      console.error('[Delete ' + kind + ']', e);
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
  };
}
