import { NextResponse } from 'next/server';
import { initStore, getWhatsappConfig } from '@/lib/store';

async function testSend(apiUrl, apiKey, groupId, label) {
  if (!apiUrl || !groupId) {
    return { label: label, configured: false, sent: false, reason: 'missing apiUrl or groupId' };
  }

  var msg = 'DIAGNOSTIC TEST -- ' + label + ' -- ' + new Date().toLocaleString();

  try {
    // Try format 1: phone + body + type 2
    var res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey || '',
        'Authorization': apiKey ? 'Bearer ' + apiKey : '',
      },
      body: JSON.stringify({ phone: groupId, body: msg, type: 2 }),
    });
    var status = res.status;
    var txt = await res.text();
    var format = 'phone+body+type2';

    // Retry with chatId+message if 422
    if (status === 422) {
      var r2 = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey || '' },
        body: JSON.stringify({ chatId: groupId, message: msg }),
      });
      status = r2.status;
      txt = await r2.text();
      format = 'chatId+message';
    }

    var ok = status >= 200 && status < 300;
    return {
      label: label,
      configured: true,
      groupId: groupId.substring(0, 25) + '...',
      sent: ok,
      status: status,
      format: format,
      assistroResponse: txt.substring(0, 300),
    };
  } catch (e) {
    return {
      label: label,
      configured: true,
      groupId: groupId.substring(0, 25) + '...',
      sent: false,
      error: e.message,
    };
  }
}

export async function GET(req) {
  await initStore();
  var cfg = getWhatsappConfig() || {};

  var report = {
    timestamp: new Date().toISOString(),
    serverConfig: {
      assistroApiUrl: cfg.assistroApiUrl ? 'SET (' + cfg.assistroApiUrl + ')' : 'EMPTY',
      assistroApiKey: cfg.assistroApiKey ? 'SET (' + cfg.assistroApiKey.length + ' chars)' : 'EMPTY',
      bookedCallEnabled: !!cfg.bookedCallEnabled,
      bookedCallGroupId: cfg.bookedCallGroupId || 'EMPTY',
      closedDealEnabled: !!cfg.closedDealEnabled,
      closedDealGroupId: cfg.closedDealGroupId || 'EMPTY',
      eodReportEnabled: !!cfg.eodReportEnabled,
      eodReportGroupId: cfg.eodReportGroupId || 'EMPTY',
    },
    tests: [],
  };

  // If no config at all, return early
  if (!cfg.assistroApiUrl) {
    report.diagnosis = 'NO CONFIG ON SERVER. Go to Settings, enter your Assistro API URL and API Key, and click Save. Then visit this URL again.';
    return NextResponse.json(report);
  }

  // Test each configured group
  if (cfg.bookedCallGroupId) {
    report.tests.push(await testSend(cfg.assistroApiUrl, cfg.assistroApiKey, cfg.bookedCallGroupId, 'Booked Call Group'));
  } else {
    report.tests.push({ label: 'Booked Call Group', configured: false, reason: 'No groupId set in Settings' });
  }

  if (cfg.closedDealGroupId) {
    report.tests.push(await testSend(cfg.assistroApiUrl, cfg.assistroApiKey, cfg.closedDealGroupId, 'Closed Deal Group'));
  } else {
    report.tests.push({ label: 'Closed Deal Group', configured: false, reason: 'No groupId set in Settings' });
  }

  if (cfg.eodReportGroupId) {
    report.tests.push(await testSend(cfg.assistroApiUrl, cfg.assistroApiKey, cfg.eodReportGroupId, 'EOD Report Group'));
  } else {
    report.tests.push({ label: 'EOD Report Group', configured: false, reason: 'No groupId set in Settings' });
  }

  // Generate plain English diagnosis
  var sentCount = report.tests.filter(function(t) { return t.sent; }).length;
  var configuredCount = report.tests.filter(function(t) { return t.configured; }).length;

  if (configuredCount === 0) {
    report.diagnosis = 'NO GROUP IDs CONFIGURED. Go to Settings, enter your WhatsApp Group IDs (format 120363xxx@g.us), toggle each one ON, click Save.';
  } else if (sentCount === configuredCount) {
    report.diagnosis = 'ALL CONFIGURED GROUPS WORKING. If form submissions still arent sending, the bug is in how the webhook routes call sendWhatsApp. Check the webhook routes.';
  } else if (sentCount === 0) {
    var firstError = report.tests.find(function(t) { return t.configured && !t.sent; });
    report.diagnosis = 'ALL TESTS FAILED. Status: ' + (firstError ? firstError.status : 'unknown') + '. Response: ' + (firstError ? (firstError.assistroResponse || firstError.error || 'no response') : 'unknown');
  } else {
    report.diagnosis = sentCount + ' of ' + configuredCount + ' groups working. Check the failing ones.';
  }

  return NextResponse.json(report, {
    headers: { 'Content-Type': 'application/json' },
  });
}
