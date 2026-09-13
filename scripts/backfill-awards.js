/* One-time award catch-up, driven through the running app.
 *
 * The engine cannot be imported standalone — every module resolves through
 * Next's "@/" alias — so this drives the admin endpoint instead, which has the
 * added benefit of running against the live database rather than a second
 * connection to it.
 *
 *   node scripts/backfill-awards.js                      # dry run, localhost
 *   node scripts/backfill-awards.js --commit             # write
 *   BASE=https://your-app.up.railway.app node scripts/backfill-awards.js
 *
 * Requires OPERATOR_EMAIL for the x-user-email header (defaults to the owner).
 */

var BASE = process.env.BASE || 'http://localhost:3000';
var WHO = process.env.OPERATOR_EMAIL || 'shorty21taylor@gmail.com';
var COMMIT = process.argv.indexOf('--commit') !== -1;

async function main() {
  var url = BASE + '/api/admin/backfill-awards';
  var res = await fetch(url, COMMIT
    ? { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-user-email': WHO },
        body: JSON.stringify({ confirm: 'backfill' }) }
    : { headers: { 'x-user-email': WHO } });

  var d = await res.json();
  if (!res.ok || !d.success) { console.error('FAILED:', d.error || res.status); process.exit(1); }

  var c = d.recordCounts;
  console.log('MODE    %s', d.committed ? 'commit' : 'dry run (pass --commit to write)');
  console.log('BEFORE  booked_calls=%d  closed_deals=%d  eod_reports=%d',
    c.before.bookedCalls, c.before.closedDeals, c.before.eodReports);
  console.log('');
  d.perRep.forEach(function(r) {
    console.log('  ' + (r.name + ' <' + r.email + '>').padEnd(38) + r.awards.join(', '));
  });
  console.log('\n%s %d award(s) across %d rep(s)',
    d.committed ? 'GRANTED' : 'WOULD GRANT', d.totalGranted, d.reps);

  if (d.unbackedMetrics && d.unbackedMetrics.length) {
    console.log('\nDARK METRICS (never granted until the data exists):');
    d.unbackedMetrics.forEach(function(m) { console.log('  - ' + m); });
  }

  console.log('\nAFTER   booked_calls=%d  closed_deals=%d  eod_reports=%d',
    c.after.bookedCalls, c.after.closedDeals, c.after.eodReports);
  console.log(c.unchanged ? 'RECORD COUNTS UNCHANGED' : '*** RECORD COUNTS CHANGED — STOP ***');
  process.exit(c.unchanged ? 0 : 1);
}

main().catch(function(e) { console.error(e); process.exit(1); });
