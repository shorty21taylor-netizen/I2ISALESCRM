/* One-time pipeline catch-up, driven through the running app.
 *
 * The engine cannot be imported standalone — every module resolves through Next's
 * "@/" alias — so this drives the admin endpoint instead, which has the added
 * benefit of running against the live database rather than a second connection.
 *
 *   node scripts/backfill-pipeline.js                    # dry run, localhost
 *   node scripts/backfill-pipeline.js --commit           # write
 *   BASE=https://your-app.up.railway.app SESSION=<cookie> node scripts/backfill-pipeline.js
 *
 * SESSION is the value of the summit_session cookie for the operator account —
 * copy it out of your browser's dev tools. The API front door requires a real
 * session; there is deliberately no header that stands in for one.
 *
 * Safe to run twice: a booking that already has a card is skipped.
 */

var BASE = process.env.BASE || 'http://localhost:3000';
var SESSION = process.env.SESSION || '';
var COMMIT = process.argv.indexOf('--commit') !== -1;

function headers() {
  var h = { 'Content-Type': 'application/json' };
  if (SESSION) h.Cookie = 'summit_session=' + SESSION;
  return h;
}

async function main() {
  var url = BASE + '/api/admin/backfill-pipeline';
  var res = await fetch(url, COMMIT
    ? { method: 'POST', headers: headers(), body: JSON.stringify({ confirm: 'backfill' }) }
    : { headers: headers() });

  var d = await res.json().catch(function() { return {}; });
  if (!res.ok || !d.success) {
    console.error('FAILED:', d.error || res.status);
    if (res.status === 401) console.error('Set SESSION to your summit_session cookie value.');
    process.exit(1);
  }

  var c = d.recordCounts;
  console.log('MODE      %s', d.committed ? 'commit' : 'dry run (pass --commit to write)');
  console.log('');
  console.log('RECORD COUNTS        before   after');
  ['bookedCalls', 'closedDeals', 'eodReports', 'pipelineRecords'].forEach(function(k) {
    console.log('  %s%s%s', k.padEnd(20), String(c.before[k]).padStart(6), String(c.after[k]).padStart(8));
  });
  console.log('');
  console.log('CARDS     created %d, skipped %d (already had one)', d.created, d.skipped);
  if (d.orphanDeals) console.log('          %d deal(s) had no booking behind them', d.orphanDeals);
  console.log('');
  console.log('BY STAGE');
  Object.keys(d.byStage).sort().forEach(function(s) {
    console.log('  %s%s', s.padEnd(20), String(d.byStage[s]).padStart(6));
  });
  console.log('');
  console.log('CASH CHECK  board won $%s vs closed deals $%s -> %s',
    d.cashCheck.boardWonCash, d.cashCheck.closedDealCash,
    d.cashCheck.agrees ? 'agree' : 'DISAGREE — the deal matching is wrong');
  if (d.note) console.log('\n%s', d.note);
  if (!d.cashCheck.agrees) process.exit(2);
}

main().catch(function(e) { console.error(e); process.exit(1); });
