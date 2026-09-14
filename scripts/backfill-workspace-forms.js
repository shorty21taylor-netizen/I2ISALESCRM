#!/usr/bin/env node
//
// Moves the original workspace's submit setup into its own workspace-scoped rows,
// and attributes any sales record that predates workspace scoping.
//
//   node scripts/backfill-workspace-forms.js                 # dry run
//   node scripts/backfill-workspace-forms.js --commit        # apply
//   node scripts/backfill-workspace-forms.js --slug=i2i      # pick the workspace
//
// A wrapper around the admin endpoint rather than a direct database script: the
// '@/' import alias does not resolve under plain node, and going through the API
// means this runs the same code path the app does instead of a second copy that
// can drift.

var BASE = process.env.CRM_URL || 'http://localhost:3000';
var EMAIL = process.env.CRM_OPERATOR_EMAIL || 'shorty21taylor@gmail.com';
var PASSWORD = process.env.CRM_TEAM_PASSWORD || '';

var commit = process.argv.indexOf('--commit') !== -1;
var slugArg = process.argv.filter(function(a) { return a.indexOf('--slug=') === 0; })[0];
var slug = slugArg ? slugArg.split('=')[1] : 'i2i';

function line(label, value) {
  console.log('  ' + String(label).padEnd(28) + value);
}

async function main() {
  if (!PASSWORD) {
    console.error('Set CRM_TEAM_PASSWORD (and CRM_URL for a remote deployment) first.');
    process.exit(1);
  }

  var signIn = await fetch(BASE + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!signIn.ok) {
    console.error('Could not sign in as the operator:', signIn.status);
    process.exit(1);
  }
  var cookie = (signIn.headers.get('set-cookie') || '').split(';')[0];

  var url = BASE + '/api/admin/backfill-workspace-forms?slug=' + encodeURIComponent(slug);
  var res = await fetch(url, { headers: { cookie: cookie } });
  var dry = await res.json();
  if (!res.ok) {
    console.error(dry.error || 'Dry run failed.');
    if (dry.workspaces) console.error('Workspaces:', JSON.stringify(dry.workspaces, null, 2));
    process.exit(1);
  }

  console.log('\nTarget workspace');
  line('name', dry.target.name);
  line('id', dry.target.id);
  line('slug', dry.target.slug);

  console.log('\nWould insert');
  line('forms', dry.wouldInsert.forms.length);
  line('booking link', dry.wouldInsert.booking ? 'yes' : 'no (already set or none)');
  line('whatsapp routes', dry.wouldInsert.routes.length);
  if (dry.wouldInsert.routesWithNoSource.length) {
    line('no group id to copy', dry.wouldInsert.routesWithNoSource.join(', '));
  }

  console.log('\nSales records');
  Object.keys(dry.records).forEach(function(t) {
    var r = dry.records[t];
    line(t, r.total + ' rows, ' + r.nullWorkspace + ' unattributed');
  });

  if (dry.otherWorkspaces.length) {
    console.log('\nLeft alone');
    dry.otherWorkspaces.forEach(function(w) { line(w.name, w.note); });
  }

  if (!commit) {
    console.log('\nDry run only. Re-run with --commit to apply.\n');
    return;
  }

  var applied = await fetch(BASE + '/api/admin/backfill-workspace-forms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: cookie },
    body: JSON.stringify({ confirm: 'backfill', slug: slug }),
  });
  var out = await applied.json();
  if (!applied.ok) {
    console.error(out.error || 'Backfill failed.');
    process.exit(1);
  }

  console.log('\nApplied');
  line('forms inserted', out.inserted.forms);
  line('integrations inserted', out.inserted.integrations);
  line('routes inserted', out.inserted.routes);
  Object.keys(out.recordsAttributed).forEach(function(t) {
    line(t + ' attributed', out.recordsAttributed[t]);
  });
  if (out.routesStillMissing.length) {
    console.log('\n  Still with no destination: ' + out.routesStillMissing.join(', '));
    console.log('  Set them in Workspace settings, or submissions to them are refused.');
  }
  console.log('\nAfter');
  Object.keys(out.records.after).forEach(function(t) {
    var r = out.records.after[t];
    line(t, r.total + ' rows, ' + r.nullWorkspace + ' unattributed');
  });
  console.log('\n' + out.note + '\n');
}

main().catch(function(e) { console.error(e); process.exit(1); });
