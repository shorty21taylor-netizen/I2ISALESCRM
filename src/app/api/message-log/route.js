import { NextResponse } from 'next/server';
import { initStore, getMessageLog } from '@/lib/store';
import { effectiveReadWorkspace } from '@/lib/access';

// Read-only view of every WhatsApp notification the CRM has attempted.
export async function GET(req) {
  await initStore();
  try {
    var url = new URL(req.url);
    var workspaceId = await effectiveReadWorkspace(req, url.searchParams.get('workspace'));
    var kind = url.searchParams.get('kind') || '';
    var status = url.searchParams.get('status') || '';
    var limit = parseInt(url.searchParams.get('limit'), 10) || 100;

    var rows = getMessageLog(workspaceId);
    if (kind) rows = rows.filter(function(r) { return r.kind === kind; });
    if (status) rows = rows.filter(function(r) { return r.status === status; });

    var counts = { sent: 0, failed: 0, skipped: 0, external: 0 };
    rows.forEach(function(r) {
      if (counts[r.status] !== undefined) counts[r.status]++;
    });

    return NextResponse.json({
      success: true,
      counts: counts,
      total: rows.length,
      data: rows.slice(0, limit),
    });
  } catch (e) {
    console.error('[Message Log Error]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
