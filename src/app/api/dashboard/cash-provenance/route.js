import { NextResponse } from 'next/server';
import { initStore, getStore, getWorkspaces, classifyOffer } from '@/lib/store';
import { effectiveReadWorkspace, matchesWorkspace } from '@/lib/access';
import { repScope } from '@/lib/rep-scope';
import { cashProvenance } from '@/lib/cash-provenance';
import { dedupeDeals } from '@/lib/dedupe-deals';

export var dynamic = 'force-dynamic';

// Where the Cash Collected / Revenue tiles came from.
//
// Scoped exactly like /api/dashboard: the same workspace resolution, and a rep
// gets nothing at all. This payload names every deal and every rep in the
// workspace — there is no honest subset of it to hand somebody who is only
// allowed to see their own numbers, so they are refused rather than filtered.
export async function GET(req) {
  await initStore();
  try {
    var url = new URL(req.url);
    var start = url.searchParams.get('start');
    var end = url.searchParams.get('end');
    var workspaceId = await effectiveReadWorkspace(req, url.searchParams.get('workspace'));

    var scope = await repScope(req);
    if (scope) {
      return NextResponse.json({ error: 'Team figures are not yours to read.' }, { status: 403 });
    }

    var store = getStore();
    var eods = (store.eodReports || []).filter(function(r) { return matchesWorkspace(r, workspaceId); });
    var deals = (store.closedDeals || []).filter(function(r) { return matchesWorkspace(r, workspaceId); });

    // Names for the workspace column, so an operator reading the combined view
    // sees "Influence2Impact" rather than a ws- id.
    var names = {};
    (getWorkspaces() || []).filter(Boolean).forEach(function(w) { names[w.id] = w.name || w.id; });

    var result = cashProvenance({
      eods: eods,
      deals: deals,
      start: start || null,
      end: end || null,
      workspaceNames: names,
      // The same line the dashboard tile draws, from the same classifier.
      isPartner: function(deal) { return classifyOffer(deal && deal.program) === 'partner'; },
      // Reported, never applied — see cash-provenance.js.
      dedupe: dedupeDeals(deals),
    });

    return NextResponse.json({ success: true, workspaceId: workspaceId || null, provenance: result });
  } catch (e) {
    console.error('[Cash provenance]', e);
    return NextResponse.json({ error: 'Could not work out where that came from.' }, { status: 500 });
  }
}
