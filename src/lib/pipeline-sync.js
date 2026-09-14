// Keeping the boards in step with the forms.
//
// This is called from the route handlers AFTER addBookedCall / addClosedDeal have
// returned. It never calls into them, never modifies them, and never writes to
// booked_calls or closed_deals — a pipeline row references those by id and that is
// the only direction the dependency runs.
//
// Every function here swallows its own failures. A pipeline row is a view of work
// that has already been recorded; if writing it fails, the deal is still logged, the
// WhatsApp message still goes out, and the rep still sees their submission succeed.

import { addPipelineRecord, updatePipelineRecord, matchPipelineRecord } from '@/lib/store';
import { toReportDay } from '@/lib/report-date';

// The booked call's appointment, as an instant. The form collects a day and a time
// as two free-text fields, so this is best-effort: an unparseable pair leaves the
// card with no appointment rather than a bogus one that would read "In 19710 days".
function appointmentFrom(entry) {
  var day = String(entry.bookedDay || '').trim();
  var time = String(entry.bookedTime || '').trim();
  if (!day) return '';
  var attempts = [day + ' ' + time, day];
  for (var i = 0; i < attempts.length; i++) {
    var d = new Date(attempts[i]);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  return '';
}

// A call was booked in the CRM or came in from a hosted form. One card, at `booked`.
export function syncBookedCall(entry, actor) {
  try {
    if (!entry) return null;
    var record = addPipelineRecord({
      workspaceId: entry.workspaceId,
      prospectName: entry.leadsName || '',
      prospectEmail: entry.leadsEmail || '',
      prospectPhone: entry.leadsPhone || '',
      leadSource: entry.outboundInbound || '',
      stage: 'booked',
      appointmentAt: appointmentFrom(entry),
      offer: entry.program || '',
      notes: entry.notes || '',
      setter: entry.setter || '',
      closer: entry.closer || '',
      closerEmail: entry.closerEmail || '',
      bookedCallId: entry.id || '',
    }, actor || { name: 'Booked call form', type: 'system' });
    return record;
  } catch (e) {
    console.error('[Pipeline sync] booked call:', e.message);
    return null;
  }
}

// A closer logged a close. Find the card their setter booked and move it to `won`.
//
// If nothing matches, the card is created at `won` rather than skipped: a board that
// is missing a deal the dashboard counts is worse than a board with a card whose
// earlier stages were never recorded.
export function syncClosedDeal(entry, actor) {
  try {
    if (!entry) return null;
    var who = actor || { name: 'Closed deal form', type: 'system' };
    var existing = matchPipelineRecord(entry.workspaceId, {
      prospectName: entry.leadsName,
      prospectEmail: entry.leadsEmail,
      day: entry.submittedAt ? toReportDay(entry.submittedAt) : '',
    });

    var fields = {
      stage: 'won',
      offer: entry.program || '',
      cashCollected: entry.cashCollected,
      dealTerms: entry.paymentAgreement || entry.paymentDetails || '',
      closedDealId: entry.id || '',
    };

    if (existing) {
      // The closer on the deal is the closer on the card. The setter is left alone —
      // whoever booked it booked it, and the deal form's setter field is often blank.
      if (entry.closer) fields.closer = entry.closer;
      if (entry.closerEmail) fields.closerEmail = entry.closerEmail;
      var result = updatePipelineRecord(existing.id, fields, who);
      return result.record || null;
    }

    return addPipelineRecord(Object.assign({
      workspaceId: entry.workspaceId,
      prospectName: entry.leadsName || '',
      prospectEmail: entry.leadsEmail || '',
      prospectPhone: entry.leadsPhone || '',
      leadSource: entry.outboundInbound || '',
      notes: entry.notes || '',
      setter: entry.setter || '',
      closer: entry.closer || '',
      closerEmail: entry.closerEmail || '',
    }, fields), who);
  } catch (e) {
    console.error('[Pipeline sync] closed deal:', e.message);
    return null;
  }
}
