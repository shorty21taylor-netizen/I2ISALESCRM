// Server-side scheduler — runs setInterval to check time every 60s
// Triggers: EOD reminder (8 PM), Morning digest (6 AM), Admin morning report (6 AM)
// All times are timezone-aware, skips weekends

import { getBookedCallsForDate, getStore } from '@/lib/store';
import { saveCustomMessage as saveCustomMessageDB, deleteCustomMessageDB } from '@/lib/db';

var schedule = {
  eodReminder: { hour: 20, minute: 0, enabled: true, lastRun: null },
  morningDigest: { hour: 6, minute: 0, enabled: true, lastRun: null },
  adminMorningReport: { hour: 6, minute: 0, enabled: true, lastRun: null },
};

var config = {
  assistroApiUrl: '',
  assistroApiKey: '',
  timezone: 'America/New_York',
  baseUrl: '',
  crmUrl: '',
  eodReminder: { groupId: '' },
  morningDigest: { groupId: '' },
  adminMorningReport: { groupId: '' },
  customMessages: [],
};

var intervalId = null;
var running = false;

export function getSchedulerConfig() {
  return config;
}

export function getSchedulerState() {
  return {
    running: running,
    schedule: schedule,
    config: {
      timezone: config.timezone,
      crmUrl: config.crmUrl,
      hasApiUrl: !!config.assistroApiUrl,
      hasApiKey: !!config.assistroApiKey,
      eodReminderGroupId: config.eodReminder.groupId,
      morningDigestGroupId: config.morningDigest.groupId,
      adminMorningReportGroupId: config.adminMorningReport.groupId,
    },
  };
}

export function updateSchedulerConfig(updates) {
  if (updates.assistroApiUrl !== undefined) config.assistroApiUrl = updates.assistroApiUrl;
  if (updates.assistroApiKey !== undefined) config.assistroApiKey = updates.assistroApiKey;
  if (updates.timezone !== undefined) config.timezone = updates.timezone;
  if (updates.baseUrl !== undefined) config.baseUrl = updates.baseUrl;
  if (updates.crmUrl !== undefined) config.crmUrl = updates.crmUrl;
  if (updates.eodReminder) Object.assign(config.eodReminder, updates.eodReminder);
  if (updates.morningDigest) Object.assign(config.morningDigest, updates.morningDigest);
  if (updates.adminMorningReport) Object.assign(config.adminMorningReport, updates.adminMorningReport);
  if (updates.customMessages) config.customMessages = updates.customMessages;
  // Schedule enable/disable overrides
  if (updates.eodReminderEnabled !== undefined) schedule.eodReminder.enabled = updates.eodReminderEnabled;
  if (updates.morningDigestEnabled !== undefined) schedule.morningDigest.enabled = updates.morningDigestEnabled;
  if (updates.adminMorningReportEnabled !== undefined) schedule.adminMorningReport.enabled = updates.adminMorningReportEnabled;
  console.log('[Scheduler] Config updated');
}

function getNow() {
  try {
    var now = new Date();
    var tzString = now.toLocaleString('en-US', { timeZone: config.timezone });
    var tzDate = new Date(tzString);
    return {
      hour: tzDate.getHours(),
      minute: tzDate.getMinutes(),
      dayOfWeek: tzDate.getDay(),
      dateStr: tzDate.getFullYear() + '-' + String(tzDate.getMonth() + 1).padStart(2, '0') + '-' + String(tzDate.getDate()).padStart(2, '0'),
    };
  } catch (e) {
    var fallback = new Date();
    return {
      hour: fallback.getHours(),
      minute: fallback.getMinutes(),
      dayOfWeek: fallback.getDay(),
      dateStr: fallback.toISOString().split('T')[0],
    };
  }
}

function shouldRun(task, now) {
  if (!task.enabled) return false;
  // Skip weekends
  if (now.dayOfWeek === 0 || now.dayOfWeek === 6) return false;
  // Check hour and minute (within 1 minute window)
  if (now.hour !== task.hour) return false;
  if (now.minute !== task.minute) return false;
  // Already ran today?
  if (task.lastRun && task.lastRun.startsWith(now.dateStr)) return false;
  return true;
}

async function sendToGroup(message, groupId) {
  if (!config.assistroApiUrl || !groupId) return;
  try {
    await fetch(config.assistroApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': config.assistroApiKey ? ('Bearer ' + config.assistroApiKey) : '',
      },
      body: JSON.stringify({ phone: groupId, body: message, type: 2 }),
    });
    console.log('[Scheduler] Group message sent to', groupId);
  } catch (e) {
    console.error('[Scheduler] Group send error:', e.message);
  }
}

async function sendDirect(message, phone) {
  if (!config.assistroApiUrl || !phone) return;
  try {
    await fetch(config.assistroApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': config.assistroApiKey ? ('Bearer ' + config.assistroApiKey) : '',
      },
      body: JSON.stringify({ phone: phone, body: message, type: 1 }),
    });
    console.log('[Scheduler] Direct message sent to', phone);
  } catch (e) {
    console.error('[Scheduler] Direct send error:', e.message);
  }
}

// ============================================
// BUILT-IN TASKS
// ============================================

export async function runEODReminder() {
  var groupId = config.eodReminder.groupId;
  if (!groupId) { console.log('[Scheduler] EOD reminder skipped — no group ID'); return; }

  var link = config.crmUrl ? config.crmUrl + '/submit' : 'the CRM';
  var msg = 'EOD REMINDER \u23F0\n'
    + '\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n\n'
    + 'Team \u2014 it\'s time to submit your End of Day report!\n\n'
    + '\uD83D\uDC49 Submit your EOD here:\n'
    + link + '\n\n'
    + 'Make sure you fill out:\n'
    + '\u2022 Net new calls booked\n'
    + '\u2022 Calls taken & pitched\n'
    + '\u2022 Closes & cash collected (MYFM + I2I)\n'
    + '\u2022 Outbound dials\n'
    + '\u2022 Revenue on the day\n'
    + '\u2022 Your improvement plan for tomorrow\n\n'
    + 'Get it in before you clock out! \uD83D\uDCAA\n'
    + '\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550';

  await sendToGroup(msg, groupId);
  schedule.eodReminder.lastRun = new Date().toISOString();
  console.log('[Scheduler] EOD reminder sent');
}

export async function runMorningDigest() {
  var groupId = config.morningDigest.groupId;
  if (!groupId) { console.log('[Scheduler] Morning digest skipped — no group ID'); return; }

  var now = getNow();
  var calls = getBookedCallsForDate(now.dateStr);

  var msg = '\u2600\uFE0F MORNING CALL DIGEST\n'
    + '\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n'
    + now.dateStr + '\n\n';

  if (calls.length === 0) {
    msg += 'No calls booked for today yet.\nLet\'s fill that calendar! \uD83D\uDCAA';
  } else {
    msg += calls.length + ' call' + (calls.length === 1 ? '' : 's') + ' booked for today:\n\n';
    calls.forEach(function(call, i) {
      msg += (i + 1) + '. *' + call.leadsName + '*\n';
      msg += '   Closer: ' + (call.closer || 'TBD') + '\n';
      msg += '   Time: ' + (call.bookedTime || 'TBD') + '\n';
      msg += '   Program: ' + (call.program || 'N/A') + '\n';
      if (call.leadsPhone) msg += '   Phone: ' + call.leadsPhone + '\n';
      msg += '\n';
    });
  }

  msg += '\n\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550';

  await sendToGroup(msg, groupId);
  schedule.morningDigest.lastRun = new Date().toISOString();
  console.log('[Scheduler] Morning digest sent,', calls.length, 'calls');
}

export async function runAdminMorningReport() {
  var groupId = config.adminMorningReport.groupId;
  if (!groupId) { console.log('[Scheduler] Admin report skipped — no group ID'); return; }
  if (!config.assistroApiUrl) { console.log('[Scheduler] Admin report skipped — no API URL'); return; }

  if (config.baseUrl) {
    try {
      // Step 1: Generate report content only
      var reportRes = await fetch(config.baseUrl + '/api/admin-morning-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generateOnly: true }),
      });
      var reportData = await reportRes.json();
      var msg = reportData.message;

      if (!msg) {
        console.error('[Scheduler] Admin report — could not generate content');
        return;
      }

      // Step 2: Send via /api/notify (same multi-format path as test buttons)
      var sendRes = await fetch(config.baseUrl + '/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assistroApiUrl: config.assistroApiUrl,
          assistroApiKey: config.assistroApiKey,
          whatsappGroupId: groupId,
          message: msg,
        }),
      });
      var sendData = await sendRes.json();

      schedule.adminMorningReport.lastRun = new Date().toISOString();
      console.log('[Scheduler] Admin morning report', sendData.sent ? 'sent to group' : 'FAILED', sendData.format || sendData.error || '');
    } catch (e) {
      console.error('[Scheduler] Admin report error:', e.message);
    }
  } else {
    console.log('[Scheduler] Admin report skipped — no baseUrl configured');
  }
}

async function runTask(name, now) {
  console.log('[Scheduler] Running task:', name);
  try {
    if (name === 'eodReminder') await runEODReminder();
    if (name === 'morningDigest') await runMorningDigest();
    if (name === 'adminMorningReport') await runAdminMorningReport();
  } catch (e) {
    console.error('[Scheduler] Task error (' + name + '):', e.message);
  }
}

// ============================================
// CUSTOM MESSAGES
// ============================================

export function addCustomMessage(msg) {
  var entry = {
    id: 'msg-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
    title: msg.title || 'Untitled',
    message: msg.message || '',
    destination: msg.destination || 'group',
    groupId: msg.groupId || '',
    phone: msg.phone || '',
    frequency: msg.frequency || 'once',
    hour: parseInt(msg.hour) || 9,
    minute: parseInt(msg.minute) || 0,
    dayOfWeek: parseInt(msg.dayOfWeek) || 1,
    date: msg.date || '',
    includeWeekends: msg.includeWeekends || false,
    enabled: true,
    lastRun: null,
    createdAt: new Date().toISOString(),
  };
  config.customMessages.push(entry);
  saveCustomMessageDB(entry).catch(function(e) { console.error('[DB] Save message error:', e.message); });
  return entry;
}

export function removeCustomMessage(id) {
  config.customMessages = config.customMessages.filter(function(m) { return m.id !== id; });
  deleteCustomMessageDB(id).catch(function(e) { console.error('[DB] Delete message error:', e.message); });
}

export function updateCustomMessage(id, updates) {
  var msg = config.customMessages.find(function(m) { return m.id === id; });
  if (msg) {
    if (updates.enabled !== undefined) msg.enabled = updates.enabled;
    if (updates.title !== undefined) msg.title = updates.title;
    if (updates.message !== undefined) msg.message = updates.message;
    if (updates.destination !== undefined) msg.destination = updates.destination;
    if (updates.groupId !== undefined) msg.groupId = updates.groupId;
    if (updates.phone !== undefined) msg.phone = updates.phone;
    if (updates.frequency !== undefined) msg.frequency = updates.frequency;
    if (updates.hour !== undefined) msg.hour = parseInt(updates.hour);
    if (updates.minute !== undefined) msg.minute = parseInt(updates.minute);
    if (updates.dayOfWeek !== undefined) msg.dayOfWeek = parseInt(updates.dayOfWeek);
    if (updates.date !== undefined) msg.date = updates.date;
    if (updates.includeWeekends !== undefined) msg.includeWeekends = updates.includeWeekends;
    saveCustomMessageDB(msg).catch(function(e) { console.error('[DB] Update message error:', e.message); });
  }
  return msg;
}

export function getCustomMessages() {
  return config.customMessages;
}

function replacePlaceholders(text) {
  var now = new Date();
  return text
    .replace(/\{date\}/g, now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }))
    .replace(/\{day\}/g, now.toLocaleDateString('en-US', { weekday: 'long' }))
    .replace(/\{team_count\}/g, String(Object.keys(getStore().closerProfiles || {}).length))
    .replace(/\{crmlink\}/g, config.crmUrl || 'Summit CRM');
}

export async function sendCustomMessageNow(msg) {
  console.log('[Scheduler] Sending custom message:', msg.title);
  var text = replacePlaceholders(msg.message);
  try {
    if (msg.destination === 'group' && msg.groupId) {
      await sendToGroup(text, msg.groupId);
    } else if (msg.destination === 'direct' && msg.phone) {
      await sendDirect(text, msg.phone);
    }
  } catch (e) {
    console.error('[Scheduler] Custom message error:', e.message);
  }
}

// ============================================
// TICK — runs every 60 seconds
// ============================================

async function tick() {
  var now = getNow();

  // Run built-in scheduled tasks
  var taskNames = Object.keys(schedule);
  for (var i = 0; i < taskNames.length; i++) {
    var name = taskNames[i];
    if (shouldRun(schedule[name], now)) {
      await runTask(name, now);
    }
  }

  // Run custom scheduled messages
  if (config.customMessages && config.customMessages.length > 0) {
    for (var j = 0; j < config.customMessages.length; j++) {
      var msg = config.customMessages[j];
      if (!msg.enabled) continue;
      if (msg.lastRun === now.dateStr) continue;

      var shouldFire = false;

      if (msg.frequency === 'daily') {
        if (now.hour === msg.hour && now.minute === msg.minute) {
          if (now.dayOfWeek !== 0 && now.dayOfWeek !== 6) shouldFire = true;
          if (msg.includeWeekends) shouldFire = true;
        }
      }

      if (msg.frequency === 'weekly') {
        if (now.dayOfWeek === msg.dayOfWeek && now.hour === msg.hour && now.minute === msg.minute) {
          shouldFire = true;
        }
      }

      if (msg.frequency === 'once') {
        if (now.dateStr === msg.date && now.hour === msg.hour && now.minute === msg.minute) {
          shouldFire = true;
        }
      }

      if (shouldFire) {
        msg.lastRun = now.dateStr;
        await sendCustomMessageNow(msg);
      }
    }
  }
}

// ============================================
// INIT / STOP
// ============================================

export function loadCustomMessagesFromDB(messages) {
  if (messages && messages.length > 0) {
    config.customMessages = messages;
    console.log('[Scheduler] Loaded', messages.length, 'custom messages from DB');
  }
}

export function initScheduler(baseUrl) {
  if (running) return;
  if (baseUrl) config.baseUrl = baseUrl;
  running = true;
  intervalId = setInterval(tick, 60000);
  console.log('[Scheduler] Started — checking every 60s, timezone:', config.timezone);
}

export function stopScheduler() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  running = false;
  console.log('[Scheduler] Stopped');
}
