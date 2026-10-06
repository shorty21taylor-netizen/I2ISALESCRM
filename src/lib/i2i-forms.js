// The answer lists the Influence2Impact floor actually reports against.
//
// Lifted verbatim from the three GoHighLevel surveys the team has been filling in
// — the closers' End-of-Call Report and the setters' Booked Call and End-of-Day
// Reports — so a rep moving onto the internal forms sees the same questions with
// the same wording and the same choices, and last month's answers and this
// month's are the same strings.
//
// Verbatim includes the emoji. "🟢 Closed" is what the floor has been picking and
// what their existing records say; silently normalising it here would split one
// answer into two across the move.
//
// Code, not stored rows, for the same reason INTERNAL_FORMS is code: a workspace
// that has not been set up still has to show the right choices rather than an
// empty dropdown.

// Every offer the floor sells. The order is theirs.
export var PROGRAMS = [
  'Funding Program',
  'Inner Circle',
  'Digital Program',
  'DFY Funnel',
  'DFY SKool Build',
  'ADS Management',
  'DFY Funding',
];

// How the call came to be booked. This lands in `outboundInbound`, which every
// screen already labels "Source" and whose filter builds its own list from the
// values it finds — so richer answers need no other change.
export var BOOKING_SOURCES = ['DM', 'Phone', 'Free Skool', 'Paid Skool', 'Other'];

export var LEAD_TEMPERATURES = ['Hot', 'Warm', 'Cold'];

// ---- the closer's end-of-call report ----

export var CALL_OUTCOMES = ['🟢 Closed', '🟡 Follow-Up', '🔴 Lost'];

// Which branch an outcome opens. Matched on the word, not the emoji, so a record
// filed from the old GHL form — or by someone whose keyboard dropped the emoji —
// still routes.
export function outcomeKind(outcome) {
  var o = String(outcome || '').toLowerCase();
  if (o.indexOf('closed') !== -1) return 'closed';
  if (o.indexOf('follow') !== -1) return 'follow-up';
  if (o.indexOf('lost') !== -1) return 'lost';
  return '';
}

export var PROGRAM_DURATIONS = ['1 Month', '3 Months', '6 Months', '12 Months', 'Other / N/A'];

export var PAYMENT_PLATFORMS = ['Stripe', 'Whop', 'Wire Transfer', 'PayPal', 'Zelle', 'Cash App', 'Other'];

export var PAYMENT_TYPES = ['Paid in Full', 'Payment Plan', 'Custom'];

export var PAYMENT_FREQUENCIES = ['Weekly', 'Biweekly / Every 2 Weeks', 'Monthly', 'Custom'];

// A payment type that opens the schedule questions. "Paid in Full" has no next
// payment to ask about.
export function needsSchedule(paymentType) {
  var t = String(paymentType || '').toLowerCase();
  return t.indexOf('plan') !== -1 || t.indexOf('custom') !== -1;
}

export var FOLLOWUP_REASONS = [
  'Needs to Think About It',
  'Needs to Speak With Spouse / Partner',
  'Payment / Financial Concern',
  'Waiting for Money / Payday',
  'Needs More Information',
  'Not Ready Yet',
  'Follow-Up Call Required',
  'Other',
];

export var LOST_REASONS = [
  'Price / Can’t Afford',
  'Not Qualified',
  'Not Ready',
  'Bad Timing',
  'Spouse / Partner',
  'Doesn’t See the Value',
  'Not Interested',
  'Chose Another Solution',
  'Other',
];

// ---- the setter's end-of-day ----

export var SETTER_TYPES = ['DM Setter', 'Phone Setter'];

// Two lists, deliberately. The DM form asks what stopped a reply ("No Response")
// and the phone form what stopped a pickup ("No Answer"); they are the same
// question about different work and the floor's own forms keep them apart.
export var DM_OBJECTIONS = [
  'No Response',
  'Not Interested',
  'Price / Financial Concern',
  'Not Ready / Timing',
  'Needs More Information',
  'Already Working With Someone',
  'Other',
];

export var PHONE_OBJECTIONS = [
  'No Answer',
  'Not Interested',
  'Price / Financial Concern',
  'Not Ready / Timing',
  'Needs More Information',
  'Already Working With Someone',
  'Other',
];

export var LEAD_SOURCES = ['Free Skool', 'Paid Skool', 'Other'];
