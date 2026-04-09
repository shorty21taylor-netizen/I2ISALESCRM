import { NextResponse } from 'next/server';
import { initStore, getStore, recalcOverview, removeCloserProfile, getCloserEmailByName } from '@/lib/store';
import { saveBookedCall, saveClosedDeal, saveEODReport } from '@/lib/db';

export var dynamic = 'force-dynamic';

export async function POST(req) {
  await initStore();
  try {
    var body = await req.json();
    var keepName = (body.keepName || '').trim();
    var mergeName = (body.mergeName || '').trim();
    var keepEmail = (body.keepEmail || '').toLowerCase().trim();

    if (!keepName || !mergeName) {
      return NextResponse.json({ error: 'keepName and mergeName are required' }, { status: 400 });
    }
    if (keepName === mergeName) {
      return NextResponse.json({ error: 'Cannot merge a closer into themselves' }, { status: 400 });
    }

    var store = getStore();
    var counts = { bookedCalls: 0, closedDeals: 0, eodReports: 0 };

    // Reassign booked calls
    store.bookedCalls.forEach(function(entry) {
      var changed = false;
      if (entry.closer === mergeName) {
        entry.closer = keepName;
        counts.bookedCalls++;
        changed = true;
      }
      if (entry.setter === mergeName) {
        entry.setter = keepName;
        changed = true;
      }
      if (changed) {
        saveBookedCall(entry).catch(function(e) { console.error('[Merge] save booked call:', e.message); });
      }
    });

    // Reassign closed deals
    store.closedDeals.forEach(function(entry) {
      var changed = false;
      if (entry.closer === mergeName) {
        entry.closer = keepName;
        if (keepEmail) entry.closerEmail = keepEmail;
        counts.closedDeals++;
        changed = true;
      }
      if (entry.setter === mergeName) {
        entry.setter = keepName;
        changed = true;
      }
      if (changed) {
        saveClosedDeal(entry).catch(function(e) { console.error('[Merge] save closed deal:', e.message); });
      }
    });

    // Reassign EOD reports
    store.eodReports.forEach(function(entry) {
      if (entry.salesRep === mergeName) {
        entry.salesRep = keepName;
        counts.eodReports++;
        saveEODReport(entry).catch(function(e) { console.error('[Merge] save eod:', e.message); });
      }
    });

    // Find and delete the merged closer's profile by email key
    var mergeEmail = getCloserEmailByName(mergeName);
    if (mergeEmail) {
      await removeCloserProfile(mergeEmail);
    }

    recalcOverview();

    console.log('[Merge] Merged "' + mergeName + '" into "' + keepName + '":', counts);

    return NextResponse.json({
      success: true,
      message: 'Merged "' + mergeName + '" into "' + keepName + '"',
      counts: counts,
    });
  } catch (e) {
    console.error('[Merge API Error]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
