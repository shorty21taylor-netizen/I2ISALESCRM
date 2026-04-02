// Server-side scheduler — runs setInterval to check time every 60s
// Triggers: EOD reminder (6 PM), Daily summary (8 AM), Morning digest (8:30 AM)
// All times are timezone-aware, skips weekends

import { isWhatsAppConfigured, sendGroupMessage, sendDirectMessage } from '@/lib/whatsapp';
import { getDailyTeamSummary, getBookedCallsForDate, getStore } from '@/lib/store';

var schedulerState = {
  running: false,
  intervalId: null,
  baseUrl: '',
  timezone: 'America/New_York',
  eodReminderEnabled: true,
  eodReminderTime: '18:00',
  dailySummaryEnabled: true,
  dailySummaryTime: '08:00',
  morningDigestEnabled: true,
  morningDigestTime: '08:30',
  lastRun: {
    eodReminder: null,
    dailySummary: null,
    morningDigest: null,
  },
};

export function getSchedulerState() {
  return {
    running: schedulerState.running,
    timezone: schedulerState.timezone,
    eodReminderEnabled: schedulerState.eodReminderEnabled,
    eodReminderTime: schedulerState.eodReminderTime,
    dailySummaryEnabled: schedulerState.dailySummaryEnabled,
    dailySummaryTime: schedulerState.dailySummaryTime,
    morningDigestEnabled: schedulerState.morningDigestEnabled,
    morningDigestTime: schedulerState.morningDigestTime,
    lastRun: schedulerState.lastRun,
    whatsappConfigured: isWhatsAppConfigured(),
  };
}

export function updateSchedulerConfig(config) {
  if (config.timezone !== undefined) schedulerState.timezone = config.timezone;
  if (config.eodReminderEnabled !== undefined) schedulerState.eodReminderEnabled = config.eodReminderEnabled;
  if (config.eodReminderTime !== undefined) schedulerState.eodReminderTime = config.eodReminderTime;
  if (config.dailySummaryEnabled !== undefined) schedulerState.dailySummaryEnabled = config.dailySummaryEnabled;
  if (config.dailySummaryTime !== undefined) schedulerState.dailySummaryTime = config.dailySummaryTime;
  if (config.morningDigestEnabled !== undefined) schedulerState.morningDigestEnabled = config.morningDigestEnabled;
  if (config.morningDigestTime !== undefined) schedulerState.morningDigestTime = config.morningDigestTime;
}

function getNowInTimezone() {
  try {
    var now = new Date();
    var tzString = now.toLocaleString('en-US', { timeZone: schedulerState.timezone });
    var tzDate = new Date(tzString);
    return tzDate;
  } catch (e) {
    return new Date();
  }
}

function getTimeString(date) {
  var h = String(date.getHours()).padStart(2, '0');
  var m = String(date.getMinutes()).padStart(2, '0');
  return h + ':' + m;
}

function getDateString(date) {
  var y = date.getFullYear();
  var m = String(date.getMonth() + 1).padStart(2, '0');
  var d = String(date.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + d;
}

function isWeekend(date) {
  var day = date.getDay();
  return day === 0 || day === 6;
}

function alreadyRanToday(taskKey) {
  if (!schedulerState.lastRun[taskKey]) return false;
  var now = getNowInTimezone();
  var todayStr = getDateString(now);
  return schedulerState.lastRun[taskKey].startsWith(todayStr);
}

export async function runEODReminder() {
  var message = '⏰ *EOD Reminder*\n\nHey team! Time to submit your end-of-day reports.\n\nHead to Summit CRM → Submit → End-of-Day Report\n\nMake sure to log your:\n• Net new calls booked\n• Calls on calendar\n• Calls taken & pitched\n• Closes & cash collected\n• Outbound dials\n• Improvement plan';
  var result = await sendGroupMessage(message);
  schedulerState.lastRun.eodReminder = new Date().toISOString();
  console.log('[Scheduler] EOD reminder sent');
  return result;
}

export async function runDailySummary() {
  var today = getDateString(getNowInTimezone());
  var summary = getDailyTeamSummary(today);

  var message = '📊 *Daily Team Performance Summary*\n' + today + '\n\n';
  message += '💰 Total Revenue: $' + summary.totalRevenue.toLocaleString() + '\n';
  message += '🎯 Total Closes: ' + summary.totalCloses + '\n';
  message += '📞 Total Dials: ' + summary.totalDials + '\n';
  message += '📋 EOD Reports: ' + summary.eodCount + '\n';
  message += '💵 Cash (MYFM): $' + summary.cashMYFM.toLocaleString() + '\n';
  message += '💵 Cash (I2I): $' + summary.cashI2I.toLocaleString() + '\n';

  if (summary.closers.length > 0) {
    message += '\n*Top Performers:*\n';
    summary.closers.slice(0, 5).forEach(function(c, i) {
      message += (i + 1) + '. ' + c.name + ' — $' + c.revenue.toLocaleString() + ' (' + c.closes + ' closes)\n';
    });
  }

  var result = await sendDirectMessage(null, message);
  schedulerState.lastRun.dailySummary = new Date().toISOString();
  console.log('[Scheduler] Daily summary sent');
  return result;
}

export async function runMorningDigest() {
  var today = getDateString(getNowInTimezone());
  var calls = getBookedCallsForDate(today);

  var message = '☀️ *Morning Booked Calls Digest*\n' + today + '\n\n';

  if (calls.length === 0) {
    message += 'No calls booked for today yet. Let\'s fill that calendar! 💪';
  } else {
    message += calls.length + ' call' + (calls.length === 1 ? '' : 's') + ' booked for today:\n\n';
    calls.forEach(function(call, i) {
      message += (i + 1) + '. *' + call.leadsName + '* — ' + (call.program || 'N/A') + '\n';
      message += '   Closer: ' + (call.closer || 'TBD') + ' | Time: ' + (call.bookedTime || 'TBD') + '\n';
    });
  }

  var result = await sendGroupMessage(message);
  schedulerState.lastRun.morningDigest = new Date().toISOString();
  console.log('[Scheduler] Morning digest sent');
  return result;
}

async function tick() {
  if (!isWhatsAppConfigured()) return;

  var now = getNowInTimezone();
  if (isWeekend(now)) return;

  var currentTime = getTimeString(now);

  // EOD Reminder
  if (schedulerState.eodReminderEnabled && currentTime === schedulerState.eodReminderTime && !alreadyRanToday('eodReminder')) {
    try { await runEODReminder(); } catch (e) { console.error('[Scheduler] EOD reminder error:', e.message); }
  }

  // Daily Summary (to admin)
  if (schedulerState.dailySummaryEnabled && currentTime === schedulerState.dailySummaryTime && !alreadyRanToday('dailySummary')) {
    try { await runDailySummary(); } catch (e) { console.error('[Scheduler] Daily summary error:', e.message); }
  }

  // Morning Digest (to group)
  if (schedulerState.morningDigestEnabled && currentTime === schedulerState.morningDigestTime && !alreadyRanToday('morningDigest')) {
    try { await runMorningDigest(); } catch (e) { console.error('[Scheduler] Morning digest error:', e.message); }
  }
}

export function initScheduler(baseUrl) {
  if (schedulerState.running) return;
  schedulerState.baseUrl = baseUrl || '';
  schedulerState.running = true;
  schedulerState.intervalId = setInterval(tick, 60000);
  console.log('[Scheduler] Started — checking every 60s');
}

export function stopScheduler() {
  if (schedulerState.intervalId) {
    clearInterval(schedulerState.intervalId);
    schedulerState.intervalId = null;
  }
  schedulerState.running = false;
  console.log('[Scheduler] Stopped');
}
