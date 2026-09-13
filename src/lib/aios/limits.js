// What Summit AIOS is allowed to spend.
//
// Two ceilings, both enforced server-side before a single token is bought: one
// per rep so nobody corners the budget, one per org so a bad afternoon cannot
// empty it. Counted in Pacific days, like every other figure in this CRM.
import { aiosAskedToday, noteAiosAsk } from '@/lib/store';
import { todayInReportTimezone } from '@/lib/report-date';

export var PER_REP_PER_DAY = 50;
export var PER_ORG_PER_DAY = 500;

export function checkLimit(email) {
  var day = todayInReportTimezone();
  var used = aiosAskedToday(email, day);
  if (used.rep >= PER_REP_PER_DAY) {
    return {
      ok: false,
      status: 429,
      error: 'You have asked Summit AIOS ' + used.rep + ' questions today, which is the daily limit. '
        + 'It resets at midnight Pacific.',
      used: used,
    };
  }
  if (used.org >= PER_ORG_PER_DAY) {
    return {
      ok: false,
      status: 429,
      error: 'Summit AIOS has answered ' + used.org + ' questions across the company today, which is the '
        + 'daily limit. It resets at midnight Pacific.',
      used: used,
    };
  }
  return { ok: true, day: day, used: used, repRemaining: PER_REP_PER_DAY - used.rep };
}

export function recordAsk(email, day) {
  return noteAiosAsk(email, day || todayInReportTimezone());
}
