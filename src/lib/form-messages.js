// WhatsApp message templates for the three sales forms.
//
// Both submission paths — the in-app /submit forms and the external n8n forms —
// build their notification here, so a deal posted from n8n reads exactly like one
// posted from the CRM.

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
    + '📅 Booked For: ' + (entry.bookedDay || 'TBD') + ' at ' + (entry.bookedTime || 'TBD') + '\n'
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

export function buildEODMessage(entry, timezone) {
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
    + (entry.improvementPlan ? '\n🔮 TOMORROW\n────────────────\n' + entry.improvementPlan + '\n' : '')
    + '\n⏰ ' + stamp(timezone) + '\n'
    + '═══════════════════════';
}

export function buildMessage(formType, entry, timezone) {
  if (formType === 'book-call') return buildBookedCallMessage(entry, timezone);
  if (formType === 'close-deal') return buildClosedDealMessage(entry, timezone);
  if (formType === 'eod-report') return buildEODMessage(entry, timezone);
  return '';
}
