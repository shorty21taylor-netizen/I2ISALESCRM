import { NextResponse } from 'next/server';
import { getAllCloserProfiles, getStore, initStore, archiveCloser, restoreCloser, setSetterEligibility, renameCloser, getWorkspaceUserList, setMemberActive } from '@/lib/store';
import { effectiveReadWorkspace, effectiveWriteWorkspace, resolveAccess, ALL_WORKSPACES as ACCESS_ALL } from '@/lib/access';
import { scopeProfiles } from '@/lib/rep-roster-scope';
import { todayInReportTimezone, toReportDay } from '@/lib/report-date';

// Remove a rep from the roster, or put them back. Records are never touched.
export async function POST(req) {
  await initStore();
  try {
    // A manager runs their own floor. This was pinned to one hardcoded address,
    // so on any workspace but the first nobody could take a leaver off the board.
    var access = await resolveAccess(req);
    if (!access.canSeeTeam) {
      return NextResponse.json({ error: 'Manager access required' }, { status: 403 });
    }
    var target = await effectiveWriteWorkspace(req, null);
    var body = await req.json();
    var action = body.action;
    if (!body.email) return NextResponse.json({ error: 'email required' }, { status: 400 });

    var result;
    if (action === 'archive' || action === 'restore') {
      var leaving = action === 'archive';
      // Somebody comes off the floor in two places: the closer profile the boards
      // read, and the roster membership that lets them sign in. Archiving only the
      // first left a leaver able to log in, and left a rep who had never filed
      // anything — who has no profile at all — impossible to remove.
      result = leaving ? archiveCloser(body.email) : restoreCloser(body.email);
      await setMemberActive(target, body.email, !leaving).catch(function(e) {
        console.error('[Closers] roster membership:', e.message);
      });
      // No closer profile is not a failure when the roster row was the point.
      if (result && result.error) result = { profile: null };
    } else if (action === 'setter-exclude') result = setSetterEligibility(body.email, false);
    else if (action === 'setter-include') result = setSetterEligibility(body.email, true);
    else if (action === 'rename') result = renameCloser(body.email, body.name);
    else return NextResponse.json({ error: "action must be 'archive', 'restore', 'rename', 'setter-exclude' or 'setter-include'" }, { status: 400 });

    if (result.error) return NextResponse.json({ error: result.error }, { status: 404 });
    return NextResponse.json({ success: true, action: action, closer: result.profile });
  } catch (e) {
    console.error('[Closers POST Error]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET(req) {
  await initStore();
  try {
    await initStore();
    // The roster a caller sees is their own workspace's. This list drives the EOD
    // tracker, the closers screen and every rep picker, so an unscoped version of
    // it put one client's whole floor on another client's compliance report.
    var workspaceId = await effectiveReadWorkspace(req, new URL(req.url).searchParams.get('workspace'));
    var profiles = scopeProfiles(getAllCloserProfiles(), workspaceId);
    var store = getStore();
    var today = todayInReportTimezone();

    // A closer profile is created by whichever form first carried somebody's
    // email, so this list used to show only people who had already filed
    // something. Anybody added to the roster — which is how a manager onboards a
    // rep — was invisible here until their first submission, so adding them
    // looked like it had silently failed. The roster is folded in, and a rep who
    // has filed nothing yet shows with zeros rather than not at all.
    // The combined view belongs to no single workspace, so ask for every roster
    // rather than one that does not exist — otherwise a rep who has filed nothing
    // yet vanishes the moment an operator switches to All Workspaces.
    var roster = Array.isArray(workspaceId) || workspaceId === ACCESS_ALL
      ? (getStore().workspaceUsers || [])
      : await getWorkspaceUserList(workspaceId).catch(function() { return []; });
    if (Array.isArray(workspaceId)) {
      roster = roster.filter(function(u) { return workspaceId.indexOf(u.workspaceId) !== -1; });
    }
    (roster || []).forEach(function(member) {
      if (!member || !member.email) return;
      var key = String(member.email).toLowerCase();
      if (profiles[key]) {
        // Prefer the roster's name: it is what a manager typed, where a profile
        // name is whatever a form happened to carry.
        if (member.name) profiles[key] = Object.assign({}, profiles[key], { name: profiles[key].name || member.name });
        return;
      }
      profiles[key] = {
        email: key,
        name: member.name || key.split('@')[0],
        registeredAt: member.joinedAt || '',
        archived: member.active === false,
        archivedAt: member.deactivatedAt || null,
        excludedFromSetterBoard: false,
        fromRosterOnly: true,
      };
    });

    var closers = Object.values(profiles).map(function(profile) {
      var name = profile.name;

      var bookedCalls = store.bookedCalls.filter(function(b) { return b.closer === name; }).length;
      var closedDeals = store.closedDeals.filter(function(d) { return (d.closer || d.closerName) === name; });
      var eodReports = store.eodReports.filter(function(e) { return (e.salesRep || e.closerName) === name; });

      var totalRevenue = closedDeals.reduce(function(s, d) { return s + (d.cashCollected || d.dealValue || 0); }, 0);
      var totalDials = eodReports.reduce(function(s, e) { return s + (e.outboundDials || e.totalDials || 0); }, 0);
      var totalCloses = closedDeals.length;
      var totalCallsTaken = eodReports.reduce(function(s, e) { return s + (e.callsTaken || 0); }, 0);
      var closeRate = totalCallsTaken > 0 ? Math.round((totalCloses / totalCallsTaken) * 1000) / 10 : 0;

      // Today's stats
      var todayEODs = eodReports.filter(function(e) { return e.date === today; });
      var todayDials = todayEODs.reduce(function(s, e) { return s + (e.outboundDials || e.totalDials || 0); }, 0);
      var todayCloses = todayEODs.reduce(function(s, e) { return s + (e.closes || 0); }, 0);
      var todayCash = todayEODs.reduce(function(s, e) { return s + (e.cashCollectedMYFM || 0) + (e.cashCollectedI2I || 0); }, 0);

      // Last activity
      var allDates = []
        .concat(store.bookedCalls.filter(function(b) { return b.closer === name; }).map(function(b) { return b.submittedAt; }))
        .concat(closedDeals.map(function(d) { return d.submittedAt; }))
        .concat(eodReports.map(function(e) { return e.submittedAt; }))
        .filter(Boolean)
        .sort()
        .reverse();

      return {
        name: profile.name,
        email: profile.email,
        archived: !!profile.archived,
        excludedFromSetterBoard: !!profile.excludedFromSetterBoard,
        archivedAt: profile.archivedAt || null,
        registeredAt: profile.registeredAt,
        lastLogin: profile.lastLogin,
        lastActivity: allDates[0] || null,
        stats: {
          bookedCalls: bookedCalls,
          closedDeals: totalCloses,
          eodReports: eodReports.length,
          totalRevenue: totalRevenue,
          totalDials: totalDials,
          closeRate: closeRate,
        },
        today: {
          dials: todayDials,
          closes: todayCloses,
          cash: todayCash,
        },
      };
    });

    // A removed rep drops off the roster but keeps every record they filed, so the
    // Closers page and the EOD compliance tracker stop expecting work from someone
    // who has left. ?includeArchived=1 brings them back for the "show removed" view.
    var includeArchived = false;
    try {
      includeArchived = new URL(req.url).searchParams.get('includeArchived') === '1';
    } catch (e) { includeArchived = false; }
    if (!includeArchived) {
      closers = closers.filter(function(c) { return !c.archived; });
    }

    // Deduplicate by normalized email (lowercase + trim).
    // Same email = same person; different/missing emails stay separate.
    var seenEmail = {};
    closers = closers.filter(function(c) {
      var e = (c.email || '').toLowerCase().trim();
      if (!e) return true;
      if (seenEmail[e]) return false;
      seenEmail[e] = true;
      return true;
    });

    closers.sort(function(a, b) { return b.stats.totalRevenue - a.stats.totalRevenue; });

    return NextResponse.json({ success: true, closers: closers, count: closers.length });
  } catch (e) {
    console.error('[Closers API Error]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
