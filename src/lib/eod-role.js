// Which funnel an EOD report belongs to. One implementation, because three
// different boards ask the question and a disagreement between them shows up as
// somebody's numbers appearing twice or not at all.
//
// Three jobs, three funnels:
//   closer     — takes the call, pitches, closes. Starts at a booked call.
//   setter     — works the phone. Starts at a dial.
//   dm-setter  — works the inbox. Starts at a new lead.
//
// The stored `role` is read, but never trusted alone. The ingest decided it from
// the shape of the answers for years and got it wrong in both directions, and
// those records are history — history is not rewritten, so the numbers on the
// record get a vote alongside the label.

function n(v) {
  var f = parseFloat(v);
  return isFinite(f) ? f : 0;
}

function labelled(e) {
  var role = String((e && e.role) || '').toLowerCase();
  var position = String((e && e.position) || '').toLowerCase();
  if (role.indexOf('dm') !== -1 || position.indexOf('dm') !== -1) return 'dm-setter';
  if (role === 'setter' || position.indexOf('setter') !== -1) return 'setter';
  if (role === 'closer' || position.indexOf('closer') !== -1) return 'closer';
  return '';
}

export function eodRole(e) {
  if (!e) return '';
  var said = labelled(e);

  // A DM setter reports the closes and the cash their booked calls produced.
  // They did not take those calls, so counting the report as a closer's day
  // would put closes against nobody's pitches and wreck the close rate. The
  // label wins here, in both directions: only a DM report is DM, and a DM
  // report is never anything else.
  if (said === 'dm-setter') return 'dm-setter';

  // An unlabelled report that worked leads and made no dials is the inbox.
  if (!said && n(e.newLeads) > 0 && !n(e.outboundDials) && !n(e.callsTaken)) return 'dm-setter';

  // Evidence of closing outranks the label, because for a long stretch the
  // ingest stamped 'setter' on any closer who picked up a phone.
  var closing = n(e.callsTaken) > 0
    || n(e.callsTakenAndPitched) > 0
    || n(e.callsOnCalendar) > 0;
  if (closing) return 'closer';

  if (said) return said;
  if (n(e.sets) > 0 || n(e.conversations) > 0 || n(e.outboundDials) > 0) return 'setter';
  // Nothing on it either way. Counted as a closer's quiet day, which is what a
  // blank EOD has always been.
  return 'closer';
}

export function isDmSetterReport(e) { return eodRole(e) === 'dm-setter'; }
export function isSetterReport(e) { return eodRole(e) === 'setter'; }
export function isCloserReport(e) { return eodRole(e) === 'closer'; }
