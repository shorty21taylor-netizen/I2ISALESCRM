import { NextResponse } from 'next/server';
import { initStore, getStore } from '@/lib/store';

export var dynamic = 'force-dynamic';

export async function GET(req) {
  await initStore();
  var store = getStore();

  var profiles = store.closerProfiles || {};
  var profileEmails = Object.keys(profiles);
  var profileNames = profileEmails.map(function(e) { return { email: e, name: profiles[e].name || e }; });

  // Find EODs that don't match any profile
  var orphanedEODs = [];
  store.eodReports.forEach(function(e) {
    var email = (e.closerEmail || '').toLowerCase();
    var name = (e.salesRep || e.closerName || '').toLowerCase().trim();

    var matchedByEmail = email && profileEmails.some(function(pe) { return pe === email; });
    var matchedByName = profileNames.some(function(p) { return p.name.toLowerCase().trim() === name; });

    if (!matchedByEmail && !matchedByName) {
      orphanedEODs.push({
        id: e.id,
        date: e.date,
        salesRep: e.salesRep || e.closerName,
        closerEmail: e.closerEmail || 'none',
        submittedAt: e.submittedAt,
      });
    }
  });

  // Find duplicate profiles (same name, different email)
  var nameMap = {};
  profileNames.forEach(function(p) {
    var key = p.name.toLowerCase().trim();
    if (!nameMap[key]) nameMap[key] = [];
    nameMap[key].push(p.email);
  });
  var duplicates = {};
  Object.keys(nameMap).forEach(function(k) {
    if (nameMap[k].length > 1) duplicates[k] = nameMap[k];
  });

  // Find EODs with closerEmail field vs without
  var withEmail = store.eodReports.filter(function(e) { return e.closerEmail; }).length;
  var withoutEmail = store.eodReports.filter(function(e) { return !e.closerEmail; }).length;

  return NextResponse.json({
    profiles: profileNames.length,
    totalEODs: store.eodReports.length,
    eodsWithEmail: withEmail,
    eodsWithoutEmail: withoutEmail,
    orphanedEODs: orphanedEODs,
    duplicateProfiles: duplicates,
    allProfileNames: profileNames.map(function(p) { return p.name + ' (' + p.email + ')'; }),
    allEODNames: Array.from(new Set(store.eodReports.map(function(e) {
      return (e.salesRep || e.closerName || 'unknown') + (e.closerEmail ? ' [' + e.closerEmail + ']' : ' [no email]');
    }))),
  });
}
