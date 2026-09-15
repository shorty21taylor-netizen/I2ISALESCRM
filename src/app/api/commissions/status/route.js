import { NextResponse } from 'next/server';
import { updateCommissionStatus, initStore, getStore } from '@/lib/store';
import { resolveAccess, matchesWorkspace } from '@/lib/access';

// Marking a commission paid is a money decision, so it belongs to whoever runs that
// workspace — and only for deals that are actually theirs. Unscoped, a rep could
// approve their own, and one client's manager could settle another client's books.
export async function POST(req) {
  await initStore();
  try {
    var access = await resolveAccess(req);
    if (!access.signedIn) {
      return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
    }
    if (!access.canSeeTeam) {
      return NextResponse.json({ error: 'Not permitted' }, { status: 403 });
    }

    var body = await req.json();
    if (!body.dealId || !body.status) {
      return NextResponse.json({ error: 'dealId and status required' }, { status: 400 });
    }
    if (['pending', 'approved', 'paid'].indexOf(body.status) === -1) {
      return NextResponse.json({ error: 'status must be pending, approved, or paid' }, { status: 400 });
    }

    // The deal has to sit in a workspace this caller can act in. 404, not 403 —
    // a 403 would confirm the deal exists somewhere else.
    var filter = access.canSeeAll ? null : access.workspaceIds;
    var existing = (getStore().closedDeals || []).filter(function (d) {
      return d.id === body.dealId;
    })[0];
    if (!existing || !matchesWorkspace(existing, filter)) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    }

    var deal = updateCommissionStatus(body.dealId, body.status);
    if (!deal) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, deal: deal });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
