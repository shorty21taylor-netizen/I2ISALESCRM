import { NextResponse } from 'next/server';
import { initStore, getSkoolLeads, addSkoolLead } from '@/lib/store';
import { effectiveReadWorkspace, effectiveWriteWorkspace } from '@/lib/access';
import { computeSkoolStats, isStage, isCommunity } from '@/lib/skool';

export var dynamic = 'force-dynamic';

// The whole pipeline plus everything the page reports on it. Stats are computed
// over the unfiltered set so the headline holds still while the board is filtered.
export async function GET(req) {
  await initStore();
  try {
    var url = new URL(req.url);
    var workspaceId = await effectiveReadWorkspace(req, url.searchParams.get('workspace'));
    var setter = (url.searchParams.get('setter') || '').trim().toLowerCase();

    var all = getSkoolLeads(workspaceId);
    var rows = setter
      ? all.filter(function(l) { return (l.setter || '').toLowerCase() === setter; })
      : all;

    return NextResponse.json({
      success: true,
      data: rows,
      total: rows.length,
      stats: computeSkoolStats(all),
      // The board's own numbers when a setter is being looked at on their own.
      filteredStats: setter ? computeSkoolStats(rows) : null,
      workspaceId: workspaceId || null,
    });
  } catch (e) {
    console.error('[Skool GET Error]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// Shared by create and update: a stage or community that is sent but unrecognised is
// a caller mistake, not something to quietly normalise away.
export function validateStageAndCommunity(body) {
  if (body.stage !== undefined && !isStage(String(body.stage))) {
    return 'Unknown stage: ' + body.stage;
  }
  if (body.community !== undefined && !isCommunity(String(body.community))) {
    return 'Unknown community: ' + body.community;
  }
  return '';
}

export async function POST(req) {
  await initStore();
  try {
    var body = await req.json();
    if (!body.name || !String(body.name).trim()) {
      return NextResponse.json({ error: 'A name is required' }, { status: 400 });
    }
    var bad = validateStageAndCommunity(body);
    if (bad) return NextResponse.json({ error: bad }, { status: 400 });
    // The server decides the owning workspace, as everywhere else.
    body.workspaceId = await effectiveWriteWorkspace(req, body.workspaceId);
    var lead = addSkoolLead(body);
    console.log('[Skool] Added', lead.name, '-', lead.community, '/', lead.stage);
    return NextResponse.json({ success: true, lead: lead });
  } catch (e) {
    console.error('[Skool POST Error]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
