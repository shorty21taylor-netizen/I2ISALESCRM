// WhatsApp message templates for the three sales forms.
//
// Both submission paths — the in-app /submit forms and the external n8n forms —
// build their notification here, so a deal posted from n8n reads exactly like one
// posted from the CRM.

import { eodRole } from '@/lib/eod-role';

var OFFER_LABELS = {
  'saas': 'SaaS (Fund2Grow)',
  'coaching': 'Coaching (Digital Programs)',
  'dfy-funding': 'DFY Funding (Inner Circle)',
};

export function offerLabel(p) {
  return OFFER_LABELS[(p || '').toLowerCase()] || p || 'N/A';
}

export function stamp(timezone) {
  return new Date().toLocaleString('en-US', {
    timeZone: timezone || 'America/New_York',
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

// The appointment, written the way somebody reads it rather than the way an
// <input type="time"> stores it. "2026-10-05 at 17:00" is a database field posted
// into a group chat; "Mon, Oct 5 at 5:00 PM ET" is an appointment.
//
// The zone is LABELLED, not converted. bookedDay and bookedTime are wall-clock
// strings a setter typed, and nothing records which zone they typed them in — so
// shifting the hours would be inventing a fact. The floor runs on Eastern, which
// is what the timestamp at the bottom of every one of these messages has always
// used, so the label says what the number already means.
var ET = 'ET';
var EASTERN = 'America/New_York';

export function clockTime(raw) {
  var value = String(raw === null || raw === undefined ? '' : raw).trim();
  if (!value) return '';

  // An ISO instant carrying its own zone — "…T17:00:00Z", "…T17:00-04:00" — is a
  // real moment rather than a wall-clock string, so it is CONVERTED to Eastern.
  // Reading 17:00Z off as "5:00 PM" would move the appointment four hours.
  if (/\d{4}-\d{2}-\d{2}T/.test(value) && /(Z|[+-]\d{2}:?\d{2})$/.test(value)) {
    var instant = new Date(value);
    if (!isNaN(instant.getTime())) {
      return instant.toLocaleTimeString('en-US', {
        timeZone: EASTERN, hour: 'numeric', minute: '2-digit', hour12: true,
      });
    }
  }

  // Everything else is a wall-clock string in whatever shape the upstream form
  // had: a bare time, a zoneless ISO stamp, or something a human already typed.
  var iso = value.match(/[T ](\d{1,2}):(\d{2})/);
  var bare = value.match(/^(\d{1,2}):(\d{2})/);
  var parts = iso || bare;
  if (!parts) return value;

  var hour = parseInt(parts[1], 10);
  var minute = parts[2];
  if (!isFinite(hour) || hour < 0 || hour > 23) return value;

  // Already carrying a meridiem — trust it rather than re-deriving one, or
  // "5:00pm" comes back as "5:00 AM". No leading \b: in "5:00pm" there is no word
  // boundary between the 0 and the p.
  var meridiem = value.match(/(?:^|[^a-z])([ap])\.?\s*m\.?(?![a-z])/i);
  if (meridiem) {
    var suffix = meridiem[1].toLowerCase() === 'p' ? 'PM' : 'AM';
    var shown = hour % 12;
    return (shown === 0 ? 12 : shown) + ':' + minute + ' ' + suffix;
  }

  var h12 = hour % 12;
  return (h12 === 0 ? 12 : h12) + ':' + minute + ' ' + (hour < 12 ? 'AM' : 'PM');
}

export function callDate(raw) {
  var value = String(raw === null || raw === undefined ? '' : raw).trim();
  if (!value) return '';
  var m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return value;
  // Built from the parts, never `new Date('2026-10-05')` — that is UTC midnight,
  // which renders as the 4th anywhere west of Greenwich and would move somebody's
  // appointment a day earlier in the message announcing it.
  var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function bookedFor(entry) {
  var day = callDate(entry && entry.bookedDay);
  var time = clockTime(entry && entry.bookedTime);
  if (!day && !time) return 'TBD';
  if (!time) return day;
  if (!day) return time + ' ' + ET;
  return day + ' at ' + time + ' ' + ET;
}

function money(n) {
  return '$' + Number(n || 0).toLocaleString();
}

function line(emoji, label, value) {
  return value ? emoji + ' ' + label + ': ' + value + '\n' : '';
}

export function buildBookedCallMessage(entry, timezone) {
  return '📞 NEW BOOKED CALL 📞\n'
    + '═══════════════════════\n\n'
    + '👤 Lead: ' + (entry.leadsName || 'N/A') + '\n'
    + '📱 Phone: ' + (entry.leadsPhone || 'N/A') + '\n'
    + line('📧', 'Email', entry.leadsEmail)
    + '🎯 Program: ' + offerLabel(entry.program) + '\n'
    + '✅ Qualified: ' + (entry.qualified || 'N/A') + '\n'
    + '📅 Booked For: ' + bookedFor(entry) + '\n'
    + '🔗 Source: ' + (entry.outboundInbound || 'N/A') + '\n\n'
    + '👥 Setter: ' + (entry.setter || 'N/A') + '\n'
    + '🎯 Closer: ' + (entry.closer || 'N/A') + '\n'
    + line('💳', 'Credit Score', entry.creditScore)
    + line('🌡️', 'Intent Score', entry.intentScore)
    + (entry.goal ? '\n🏁 Goal: ' + entry.goal + '\n' : '')
    + (entry.pain ? '😖 Pain: ' + entry.pain + '\n' : '')
    + (entry.notes ? '\n📝 Notes: ' + entry.notes + '\n' : '')
    + '\n⏰ ' + stamp(timezone) + '\n'
    + '═══════════════════════';
}

export function buildClosedDealMessage(entry, timezone) {
  return '🔥💰 CLOSED DEAL 💰🔥\n'
    + '═══════════════════════\n\n'
    + '👤 Lead: ' + (entry.leadsName || 'N/A') + '\n'
    + '📱 Phone: ' + (entry.leadsPhone || 'N/A') + '\n'
    + '📧 Email: ' + (entry.leadsEmail || 'N/A') + '\n'
    + '🎯 Program: ' + offerLabel(entry.program) + '\n\n'
    + '💵 Cash Collected: ' + money(entry.cashCollected) + '\n'
    + '💳 Payment: ' + (entry.paymentDetails || 'N/A') + '\n'
    + '🏦 Processor: ' + (entry.paymentProcessor || 'N/A') + '\n'
    + '📄 Agreement: ' + (entry.paymentAgreement || 'N/A') + '\n\n'
    + '👥 Setter: ' + (entry.setter || 'N/A') + '\n'
    + '🎯 Closer: ' + (entry.closer || 'N/A') + '\n'
    + line('🔗', 'Source', entry.outboundInbound)
    + (entry.notes ? '\n📝 Notes: ' + entry.notes + '\n' : '')
    + '\n🚀 Let\'s go! Another one! 🚀\n\n'
    + '⏰ ' + stamp(timezone) + '\n'
    + '═══════════════════════';
}

// A setter's day and a closer's day are different reports behind one form. Rendering
// a setter through the closer template posts a wall of zeros to the group.
function buildSetterEODMessage(entry, timezone) {
  var contactRate = entry.outboundDials > 0
    ? Math.round((entry.conversations / entry.outboundDials) * 100) : 0;
  return '📋 EOD REPORT — SETTER 📋\n'
    + '═══════════════════════\n\n'
    + '👤 Sales Rep: ' + (entry.salesRep || 'N/A') + '\n'
    + '📅 Date: ' + (entry.date || 'Today') + '\n\n'
    + '📊 ACTIVITY\n'
    + '────────────────\n'
    + '📱 Dials: ' + (entry.outboundDials || 0) + '\n'
    + '🗣️ Conversations: ' + (entry.conversations || 0) + '\n'
    + '☎️ Live Calls: ' + (entry.liveCalls || 0) + '\n'
    + '⏱️ Talk Time: ' + (entry.talkTime || 'N/A') + '\n'
    + '📈 Contact Rate: ' + contactRate + '%\n\n'
    + '🎯 OUTPUT\n'
    + '────────────────\n'
    + '📅 Sets: ' + (entry.sets || 0) + '\n'
    + '🔁 Follow-Ups Scheduled: ' + (entry.followUpsScheduled || 0) + '\n'
    + '🏆 Deals Closed: ' + (entry.closes || 0) + '\n'
    + '💵 Cash Collected: ' + money(entry.cashCollectedMYFM + entry.cashCollectedI2I) + '\n'
    + line('🎯', 'Closer', entry.closerName)
    + line('⭐', 'Self Rating', entry.selfRating ? entry.selfRating + '/10' : '')
    + (entry.improvementPlan ? '\n🔮 NEEDS HELP WITH\n────────────────\n' + entry.improvementPlan + '\n' : '')
    + '\n⏰ ' + stamp(timezone) + '\n'
    + '═══════════════════════';
}

// The inbox funnel. A DM setter's day went out on the closer template until now,
// which posted a wall of zeros to the group — calls taken, no-shows, pitches — for
// somebody who never touched a phone, and left out every number they do work on.
function buildDmSetterEODMessage(entry, timezone) {
  var replyRate = entry.newLeads > 0
    ? Math.round((entry.conversations / entry.newLeads) * 100) : 0;
  return '📋 EOD REPORT — DM SETTER 📋\n'
    + '═══════════════════════\n\n'
    + '👤 Sales Rep: ' + (entry.salesRep || 'N/A') + '\n'
    + '📅 Date: ' + (entry.date || 'Today') + '\n\n'
    + '📥 THE INBOX\n'
    + '────────────────\n'
    + '🆕 New Leads: ' + (entry.newLeads || 0) + '\n'
    + '💬 Conversations: ' + (entry.conversations || 0) + '\n'
    + '📈 Reply Rate: ' + replyRate + '%\n'
    + '👻 Ghosted: ' + (entry.leadsGhosted || 0) + '\n'
    + '♻️ Reactivated: ' + (entry.leadsReactivated || 0) + '\n\n'
    + '🎯 OUTPUT\n'
    + '────────────────\n'
    + '📅 Calls Booked: ' + (entry.netNewCallsBooked || 0) + '\n'
    + '✅ Sets Showed: ' + (entry.setsShowed || 0) + '\n'
    + '🏆 Deals Closed: ' + (entry.closes || 0) + '\n'
    + '💵 Cash Collected: ' + money(entry.cashCollectedMYFM + entry.cashCollectedI2I) + '\n'
    + (entry.commonThemes ? '\n🗣️ COMMON THEMES\n────────────────\n' + entry.commonThemes + '\n' : '')
    + (entry.biggestBottleneck ? '\n🧱 BIGGEST BOTTLENECK\n────────────────\n' + entry.biggestBottleneck + '\n' : '')
    + '\n⏰ ' + stamp(timezone) + '\n'
    + '═══════════════════════';
}

export function buildEODMessage(entry, timezone) {
  // eodRole(), not the raw label. It is the one implementation of this question,
  // and it reads the numbers on the record alongside the label — which is what
  // catches a report whose stated position does not match what is on it.
  var role = eodRole(entry);
  if (role === 'setter') return buildSetterEODMessage(entry, timezone);
  if (role === 'dm-setter') return buildDmSetterEODMessage(entry, timezone);
  return '📋 EOD REPORT 📋\n'
    + '═══════════════════════\n\n'
    + '👤 Sales Rep: ' + (entry.salesRep || 'N/A') + '\n'
    + '📅 Date: ' + (entry.date || 'Today') + '\n\n'
    + '📊 CALL METRICS\n'
    + '────────────────\n'
    + '📞 Net New Booked: ' + (entry.netNewCallsBooked || 0) + '\n'
    + '📅 On Calendar: ' + (entry.callsOnCalendar || 0) + '\n'
    + '✅ Calls Taken: ' + (entry.callsTaken || 0) + '\n'
    + '❌ No Showed: ' + (entry.callsNoShowed || 0) + '\n'
    + '🚫 Canceled: ' + (entry.callsCanceled || 0) + '\n'
    + '🔄 Rescheduled: ' + (entry.callsRescheduled || 0) + '\n\n'
    + '🎯 PERFORMANCE\n'
    + '────────────────\n'
    + '🗣️ Taken & Pitched: ' + (entry.callsTakenAndPitched || 0) + '\n'
    + '🏆 Closes: ' + (entry.closes || 0) + '\n'
    + '📱 Outbound Dials: ' + (entry.outboundDials || 0) + '\n\n'
    + '💰 REVENUE\n'
    + '────────────────\n'
    + '💵 Cash MYFM: ' + money(entry.cashCollectedMYFM) + '\n'
    + '💵 Cash I2I: ' + money(entry.cashCollectedI2I) + '\n'
    + '📈 Revenue: ' + money(entry.revenueOnDay) + '\n'
    + (entry.leadsCalled ? '\n📇 Leads Called\n────────────────\n' + entry.leadsCalled + '\n' : '')
    + (entry.callOutcomes ? '\n🗒️ Outcomes\n────────────────\n' + entry.callOutcomes + '\n' : '')
    + line('⭐', 'Self Rating', entry.selfRating ? entry.selfRating + '/10' : '')
    + (entry.improvementPlan ? '\n🔮 TOMORROW\n────────────────\n' + entry.improvementPlan + '\n' : '')
    + '\n⏰ ' + stamp(timezone) + '\n'
    + '═══════════════════════';
}

export function buildAfterCallMessage(entry, timezone) {
  return '📝 AFTER-CALL REPORT 📝\n'
    + '═══════════════════════\n\n'
    + '👤 Lead: ' + (entry.leadsName || 'N/A') + '\n'
    + '📱 Phone: ' + (entry.leadsPhone || 'N/A') + '\n'
    + line('📧', 'Email', entry.leadsEmail)
    + line('🎯', 'Closer', entry.closer)
    + line('✅', 'Outcome', entry.outcome)
    + (entry.callNotes ? '\n🗒️ Notes\n────────────────\n' + entry.callNotes + '\n' : '')
    + (entry.nextStep ? '\n➡️ Next Step: ' + entry.nextStep + '\n' : '')
    + '\n⏰ ' + stamp(timezone) + '\n'
    + '═══════════════════════';
}

export function buildMessage(formType, entry, timezone) {
  if (formType === 'book-call') return buildBookedCallMessage(entry, timezone);
  if (formType === 'close-deal') return buildClosedDealMessage(entry, timezone);
  if (formType === 'eod-report') return buildEODMessage(entry, timezone);
  if (formType === 'after-call') return buildAfterCallMessage(entry, timezone);
  return '';
}
