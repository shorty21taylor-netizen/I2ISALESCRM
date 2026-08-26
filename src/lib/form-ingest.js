// Normalizes submissions that arrive from the external n8n forms into the exact
// record shapes the CRM store already understands.
//
// The n8n Form Trigger posts a JSON object keyed by the *visible field labels*
// ("Client Name", "Cash Collected Today ($)"), not by CRM field names. Rather than
// forcing the forms to be renamed, this module matches keys loosely: it strips
// case, spaces and punctuation, so "Deal Value", "deal_value" and "dealValue" all
// resolve to the same field. Anything already using CRM names passes straight
// through, which keeps the in-app forms and the n8n forms on one code path.

export var FORM_TYPES = ['book-call', 'close-deal', 'eod-report', 'after-call'];

// EOD reports are filed in the evening Pacific. Stamping them with the server's UTC
// date pushes every report after 5pm PT onto tomorrow — and month-end ones out of
// the month-to-date rollup entirely. Override with REPORT_TIMEZONE if the team moves.
export var REPORT_TIMEZONE = process.env.REPORT_TIMEZONE || 'America/Los_Angeles';

// n8n form paths -> CRM form type, so a workflow can send its own form path.
var PATH_ALIASES = {
  'lead-booking': 'book-call',
  'leadbooking': 'book-call',
  'booked-appointment': 'book-call',
  'bookedappointment': 'book-call',
  'book-call': 'book-call',
  'bookcall': 'book-call',
  'deal-won': 'close-deal',
  'dealwon': 'close-deal',
  'closed-deal': 'close-deal',
  'closeddeal': 'close-deal',
  'close-deal': 'close-deal',
  'closedeal': 'close-deal',
  'gong': 'close-deal',
  'eod-report': 'eod-report',
  'eodreport': 'eod-report',
  'eod': 'eod-report',
  'after-call': 'after-call',
  'aftercall': 'after-call',
  'after-call-report': 'after-call',
  'aftercallreport': 'after-call',
  'call-report': 'after-call',
  'callreport': 'after-call',
  'post-call': 'after-call',
  'postcall': 'after-call',
};

export function resolveFormType(value) {
  var key = String(value || '').toLowerCase().trim();
  return PATH_ALIASES[key] || (FORM_TYPES.indexOf(key) !== -1 ? key : '');
}

function normKey(k) {
  return String(k || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

// The report's own calendar day, in the team's timezone rather than the server's.
export function todayInReportTimezone() {
  try {
    // 'en-CA' formats as YYYY-MM-DD, which is exactly the shape the store expects.
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: REPORT_TIMEZONE,
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());
  } catch (e) {
    // A runtime without full ICU data throws on an unknown zone — UTC beats crashing.
    console.error('[Ingest] Timezone stamp failed, falling back to UTC:', e.message);
    return new Date().toISOString().split('T')[0];
  }
}

// n8n can wrap the answers depending on how the workflow is wired:
//   Form Trigger -> HTTP Request with {{ $json }}      => flat object
//   Form Trigger -> HTTP Request with {{ $json.body }} => { body: {...} }
//   Webhook node passthrough                            => { data: {...} }
// Flatten one level of those wrappers, and keep top-level keys as well.
//
// Returns both the normalized lookup table and the original label for each key, so
// an unmapped answer can still be shown to a human as the question they answered.
function flatten(raw) {
  var flat = {};
  var labels = {};
  if (!raw || typeof raw !== 'object') return { flat: flat, labels: labels };
  var wrappers = ['body', 'data', 'formData', 'form_data', 'submission', 'fields', 'answers'];

  function put(key, value) {
    flat[normKey(key)] = value;
    labels[normKey(key)] = key;
  }

  Object.keys(raw).forEach(function(k) {
    var v = raw[k];
    if (wrappers.indexOf(k) !== -1 && v && typeof v === 'object' && !Array.isArray(v)) {
      Object.keys(v).forEach(function(ik) { put(ik, v[ik]); });
    } else {
      put(k, v);
    }
  });
  return { flat: flat, labels: labels };
}

// First non-empty value among the candidate key names.
function pick(flat, names) {
  for (var i = 0; i < names.length; i++) {
    var v = flat[normKey(names[i])];
    if (v === 0) return '0';
    if (v === false) return 'false';
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) v = v.join(', ');
    v = typeof v === 'object' ? JSON.stringify(v) : String(v);
    if (v.trim() !== '') return v.trim();
  }
  return '';
}

// "$12,500.00", "12500 USD", "  7 calls " -> 12500 / 7. Free-text money and count
// fields are normal on a public form; a NaN here would silently zero a rep's day.
export function toNumber(value) {
  if (value === undefined || value === null || value === '') return 0;
  var s = String(value).replace(/[^0-9.\-]/g, '');
  if (s === '' || s === '-' || s === '.') return 0;
  var n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function toInt(value) {
  return Math.round(toNumber(value));
}

function yesNo(value, fallback) {
  var s = String(value || '').toLowerCase().trim();
  if (!s) return fallback;
  if (s === 'y' || s === 'yes' || s === 'true' || s === 'qualified') return 'yes';
  if (s === 'n' || s === 'no' || s === 'false' || s === 'not qualified') return 'no';
  return s;
}

// Transport and routing keys the forms attach to every request. They are plumbing,
// not answers, so they must never surface as a field on a record.
var NON_ANSWER_KEYS = [
  'workspaceid', 'workspace', 'formtype', 'form', 'type', 'formsource', 'sourceform',
  'submittedat', 'skipwhatsapp', 'messagetext', 'apikey', 'key', 'token', 'secret',
];

// Anything the form collects that the CRM has no first-class column for is kept
// verbatim under `extra`, keyed by the question as the rep saw it. Every page that
// renders a record also renders `extra`, so a field that stops being recognised
// shows up looking out of place instead of disappearing into JSONB.
function extras(flat, labels, used) {
  var seen = {};
  used.forEach(function(n) { seen[normKey(n)] = true; });
  NON_ANSWER_KEYS.forEach(function(n) { seen[n] = true; });

  var out = {};
  Object.keys(flat).forEach(function(k) {
    if (seen[k]) return;
    if (k.indexOf('whatsapp') === 0) return;
    var v = flat[k];
    if (v === undefined || v === null || v === '') return;
    out[labels[k] || k] = typeof v === 'object' ? JSON.stringify(v) : String(v);
  });
  return out;
}

var BOOK_KEYS = {
  leadsName: ['leadsName', 'Lead Name', 'Leads Name', 'name', 'Client Name', 'Prospect Name'],
  leadsPhone: ['leadsPhone', 'Phone Number', 'phone', 'Leads Phone', 'Mobile', 'Lead Phone Number'],
  leadsEmail: ['leadsEmail', 'Email', 'Email Address'],
  program: ['program', 'Product / Package', 'Product', 'Package', 'Offer'],
  qualified: ['qualified', 'Qualified'],
  bookedDay: ['bookedDay', 'Booked Day', 'Booked Date', 'Date', 'Appointment Date', 'Call Date', 'Booked For', 'Call Date & Time', 'Appointment'],
  bookedTime: ['bookedTime', 'Booked Time', 'Time', 'Appointment Time', 'Call Time'],
  notes: ['notes', 'Notes', 'Additional Notes'],
  setter: ['setter', 'Setter', 'Setter Name', 'Booked By', 'Set By', 'Your Name'],
  closer: ['closer', 'Closer', 'Closer Name', 'Assigned Closer'],
  closerEmail: ['closerEmail', 'Closer Email'],
  outboundInbound: ['outboundInbound', 'Booked In From', 'Source', 'Lead Source', 'Channel'],
  creditScore: ['creditScore', 'Credit Score'],
  intentScore: ['intentScore', 'Intent Score'],
  goal: ['goal', 'Goal', 'Goals'],
  pain: ['pain', 'Pain', 'Pain Point', 'Pain Points'],
};

var DEAL_KEYS = {
  leadsName: ['leadsName', 'Client Name', 'Lead Name', 'Customer Name', 'name'],
  leadsPhone: ['leadsPhone', 'Phone Number', 'phone'],
  leadsEmail: ['leadsEmail', 'Email', 'Email Address'],
  program: ['program', 'Product / Package', 'Product', 'Package', 'Offer'],
  paymentDetails: ['paymentDetails', 'Payment Type', 'Payment Details', 'Payment Plan'],
  paymentProcessor: ['paymentProcessor', 'Payment Processor', 'Processor'],
  paymentAgreement: ['paymentAgreement', 'Payment Agreement', 'Agreement'],
  cashCollected: ['cashCollected', 'Deal Value', 'Cash Collected', 'Amount', 'Deal Amount'],
  setter: ['setter', 'Setter', 'Setter Name', 'Set By', 'Booked By'],
  closer: ['closer', 'Closer', 'Closer Name', 'Your Name'],
  closerEmail: ['closerEmail', 'Closer Email'],
  outboundInbound: ['outboundInbound', 'Source', 'Lead Source', 'Booked In From'],
  notes: ['notes', 'Notes', 'Additional Notes'],
};

// The EOD form is one form with two branches. Setter-only questions and closer-only
// questions both live here; whichever branch was filled in populates its own fields
// and the rest stay zero.
var EOD_KEYS = {
  salesRep: ['salesRep', 'Your Name', 'Sales Rep', 'Rep', 'name'],
  position: ['position', 'Position', 'Role'],
  closerName: ['closerName', 'Closer Name', 'Closer'],
  closerEmail: ['closerEmail', 'Closer Email', 'Email'],
  date: ['date', 'Date', 'Report Date'],

  // Closer branch
  callsTaken: ['callsTaken', 'Total Calls Today', 'Calls Taken', 'Total Calls'],
  callsTakenAndPitched: ['callsTakenAndPitched', 'Calls Offered', 'Offers Made', 'Pitched'],
  callsNoShowed: ['callsNoShowed', 'No Shows', 'No Showed', 'Calls No Showed'],
  leadsCalled: ['leadsCalled', 'Leads Called (names)', 'Leads Called', 'Leads'],
  callOutcomes: ['callOutcomes', 'Call Outcomes', 'Outcomes'],
  callsOnCalendar: ['callsOnCalendar', 'Calls On Calendar'],
  callsCanceled: ['callsCanceled', 'Canceled', 'Cancelled', 'Calls Canceled'],
  callsRescheduled: ['callsRescheduled', 'Rescheduled', 'Calls Rescheduled'],
  netNewCallsBooked: ['netNewCallsBooked', 'Net New Calls Booked', 'New Calls Booked'],

  // Setter branch
  outboundDials: ['outboundDials', 'Dials', 'Outbound Dials'],
  conversations: ['conversations', 'Conversations / Pickups', 'Conversations', 'Pickups'],
  liveCalls: ['liveCalls', 'Live Calls'],
  talkTime: ['talkTime', 'Total Talk Time', 'Talk Time'],
  sets: ['sets', 'Sets', 'Appointments Set'],
  followUpsScheduled: ['followUpsScheduled', 'Follow-Ups Scheduled', 'Follow Ups Scheduled', 'Followups'],

  // Both branches
  closes: ['closes', 'Deals Closed', 'Closes', 'Sales'],
  cashCollectedMYFM: ['cashCollectedMYFM', 'Cash Collected MYFM'],
  cashCollectedI2I: ['cashCollectedI2I', 'Cash Collected I2I'],
  cashCollected: ['cashCollected', 'Cash Collected Today ($)', 'Cash Collected Today', 'Cash Collected'],
  revenueOnDay: ['revenueOnDay', 'Revenue On Day', 'Revenue'],
  improvementPlan: ['improvementPlan', 'Areas You Need Help In', 'Help Needed', 'Improvement Plan', 'Tomorrow'],
  selfRating: ['selfRating', 'Self Rating (1-10)', 'Self Rating', 'Rating'],
};

var AFTER_CALL_KEYS = {
  leadsName: ['leadsName', 'Lead Name', 'Client Name', 'Prospect Name', 'name'],
  leadsPhone: ['leadsPhone', 'Lead Phone Number', 'Phone Number', 'phone', 'Leads Phone'],
  leadsEmail: ['leadsEmail', 'Email', 'Email Address'],
  callNotes: ['callNotes', 'Call Notes', 'Notes', 'Recap'],
  outcome: ['outcome', 'Outcome', 'Call Outcome', 'Result'],
  closer: ['closer', 'Closer', 'Closer Name', 'Your Name'],
  closerEmail: ['closerEmail', 'Closer Email'],
  nextStep: ['nextStep', 'Next Step', 'Next Steps', 'Follow Up'],
};

function usedNames(map) {
  var out = [];
  Object.keys(map).forEach(function(k) { out = out.concat(map[k]); });
  return out;
}

function normalizeBookCall(flat, labels) {
  var g = function(f) { return pick(flat, BOOK_KEYS[f]); };
  return {
    leadsName: g('leadsName'),
    leadsPhone: g('leadsPhone'),
    leadsEmail: g('leadsEmail'),
    program: g('program'),
    qualified: yesNo(g('qualified'), 'yes'),
    bookedDay: g('bookedDay'),
    bookedTime: g('bookedTime'),
    notes: g('notes'),
    setter: g('setter'),
    closer: g('closer'),
    closerEmail: g('closerEmail').toLowerCase(),
    outboundInbound: g('outboundInbound') || 'inbound',
    creditScore: g('creditScore'),
    intentScore: g('intentScore'),
    goal: g('goal'),
    pain: g('pain'),
    extra: extras(flat, labels, usedNames(BOOK_KEYS)),
  };
}

function normalizeCloseDeal(flat, labels) {
  var g = function(f) { return pick(flat, DEAL_KEYS[f]); };
  return {
    leadsName: g('leadsName'),
    leadsPhone: g('leadsPhone'),
    leadsEmail: g('leadsEmail'),
    program: g('program'),
    paymentDetails: g('paymentDetails'),
    paymentProcessor: g('paymentProcessor'),
    paymentAgreement: g('paymentAgreement'),
    cashCollected: toNumber(g('cashCollected')),
    setter: g('setter'),
    closer: g('closer'),
    closerEmail: g('closerEmail').toLowerCase(),
    outboundInbound: g('outboundInbound'),
    notes: g('notes'),
    extra: extras(flat, labels, usedNames(DEAL_KEYS)),
  };
}

// Setter | Closer, from the form's Position dropdown. Falls back to reading the
// shape of the answers when Position is missing (older submissions, in-app form).
function resolveRole(position, sets, dials, callsTaken) {
  var p = String(position || '').toLowerCase();
  if (p.indexOf('setter') !== -1) return 'setter';
  if (p.indexOf('closer') !== -1) return 'closer';
  if (sets > 0 || dials > 0) return 'setter';
  if (callsTaken > 0) return 'closer';
  return '';
}

function normalizeEOD(flat, labels) {
  var g = function(f) { return pick(flat, EOD_KEYS[f]); };

  // The n8n EOD form asks for one cash figure. Split fields still win when present
  // so the in-app form (MYFM vs I2I) keeps its finer breakdown.
  var myfm = toNumber(g('cashCollectedMYFM'));
  var i2i = toNumber(g('cashCollectedI2I'));
  var single = toNumber(g('cashCollected'));
  if (!myfm && !i2i && single) i2i = single;
  var revenue = toNumber(g('revenueOnDay')) || (myfm + i2i);

  var sets = toInt(g('sets'));
  var dials = toInt(g('outboundDials'));
  var callsTaken = toInt(g('callsTaken'));
  var position = g('position');

  // A setter's sets ARE the net-new calls booked, and the CRM already reports on
  // that column. Only fill it from Sets when the closer-only field is absent, so a
  // closer's own number is never overwritten.
  var bookedRaw = g('netNewCallsBooked');
  var netNewCallsBooked = bookedRaw !== '' ? toInt(bookedRaw) : sets;

  return {
    salesRep: g('salesRep') || g('closerName'),
    position: position,
    role: resolveRole(position, sets, dials, callsTaken),
    closerName: g('closerName'),
    closerEmail: g('closerEmail').toLowerCase(),
    date: g('date') || todayInReportTimezone(),

    netNewCallsBooked: netNewCallsBooked,
    callsOnCalendar: toInt(g('callsOnCalendar')),
    callsTaken: callsTaken,
    callsNoShowed: toInt(g('callsNoShowed')),
    callsCanceled: toInt(g('callsCanceled')),
    callsRescheduled: toInt(g('callsRescheduled')),
    callsTakenAndPitched: toInt(g('callsTakenAndPitched')),
    closes: toInt(g('closes')),

    outboundDials: dials,
    conversations: toInt(g('conversations')),
    liveCalls: toInt(g('liveCalls')),
    talkTime: g('talkTime'),
    sets: sets,
    followUpsScheduled: toInt(g('followUpsScheduled')),
    selfRating: g('selfRating'),

    cashCollectedMYFM: myfm,
    cashCollectedI2I: i2i,
    revenueOnDay: revenue,
    improvementPlan: g('improvementPlan'),
    leadsCalled: g('leadsCalled'),
    callOutcomes: g('callOutcomes'),
    extra: extras(flat, labels, usedNames(EOD_KEYS)),
  };
}

function normalizeAfterCall(flat, labels) {
  var g = function(f) { return pick(flat, AFTER_CALL_KEYS[f]); };
  return {
    leadsName: g('leadsName'),
    leadsPhone: g('leadsPhone'),
    leadsEmail: g('leadsEmail'),
    callNotes: g('callNotes'),
    outcome: g('outcome'),
    closer: g('closer'),
    closerEmail: g('closerEmail').toLowerCase(),
    nextStep: g('nextStep'),
    extra: extras(flat, labels, usedNames(AFTER_CALL_KEYS)),
  };
}

// raw -> { type, record } ready for the store's add* functions.
export function normalizeSubmission(formType, raw) {
  var f = flatten(raw);
  var flat = f.flat;
  var labels = f.labels;

  var type = resolveFormType(formType) || resolveFormType(pick(flat, ['formType', 'form', 'type']));
  if (!type) return { error: 'Unknown form type. Pass ?type=book-call | close-deal | eod-report | after-call' };

  var record;
  if (type === 'book-call') record = normalizeBookCall(flat, labels);
  else if (type === 'close-deal') record = normalizeCloseDeal(flat, labels);
  else if (type === 'after-call') record = normalizeAfterCall(flat, labels);
  else record = normalizeEOD(flat, labels);

  var workspaceId = pick(flat, ['workspaceId', 'workspace', 'Workspace']);
  if (workspaceId) record.workspaceId = workspaceId;
  record.formSource = pick(flat, ['formSource', 'source_form']) || 'n8n';

  return { type: type, record: record, flat: flat };
}
