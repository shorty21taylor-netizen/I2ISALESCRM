// Normalizes submissions that arrive from the external n8n forms into the exact
// record shapes the CRM store already understands.
//
// The n8n Form Trigger posts a JSON object keyed by the *visible field labels*
// ("Client Name", "Cash Collected Today ($)"), not by CRM field names. Rather than
// forcing the forms to be renamed, this module matches keys loosely: it strips
// case, spaces and punctuation, so "Deal Value", "deal_value" and "dealValue" all
// resolve to the same field. Anything already using CRM names passes straight
// through, which keeps the in-app forms and the n8n forms on one code path.

export var FORM_TYPES = ['book-call', 'close-deal', 'eod-report'];

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
};

export function resolveFormType(value) {
  var key = String(value || '').toLowerCase().trim();
  return PATH_ALIASES[key] || (FORM_TYPES.indexOf(key) !== -1 ? key : '');
}

function normKey(k) {
  return String(k || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

// n8n can wrap the answers depending on how the workflow is wired:
//   Form Trigger -> HTTP Request with {{ $json }}      => flat object
//   Form Trigger -> HTTP Request with {{ $json.body }} => { body: {...} }
//   Webhook node passthrough                            => { data: {...} }
// Flatten one level of those wrappers, and keep top-level keys as well.
function flatten(raw) {
  var out = {};
  if (!raw || typeof raw !== 'object') return out;
  var wrappers = ['body', 'data', 'formData', 'form_data', 'submission', 'fields', 'answers'];
  Object.keys(raw).forEach(function(k) {
    var v = raw[k];
    if (wrappers.indexOf(k) !== -1 && v && typeof v === 'object' && !Array.isArray(v)) {
      Object.keys(v).forEach(function(ik) { out[normKey(ik)] = v[ik]; });
    } else {
      out[normKey(k)] = v;
    }
  });
  return out;
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

// Anything the form collects that the CRM has no first-class column for is kept
// verbatim under `extra` so nothing a rep typed is thrown away.
function extras(flat, used) {
  var seen = {};
  used.forEach(function(n) { seen[normKey(n)] = true; });
  var out = {};
  Object.keys(flat).forEach(function(k) {
    if (seen[k]) return;
    if (k === 'workspaceid' || k === 'formtype' || k === 'formsource' || k === 'submittedat') return;
    if (k.indexOf('whatsapp') === 0 || k === 'skipwhatsapp' || k === 'messagetext') return;
    var v = flat[k];
    if (v === undefined || v === null || v === '') return;
    out[k] = typeof v === 'object' ? JSON.stringify(v) : String(v);
  });
  return out;
}

var BOOK_KEYS = {
  leadsName: ['leadsName', 'Lead Name', 'Leads Name', 'name', 'Client Name', 'Prospect Name'],
  leadsPhone: ['leadsPhone', 'Phone Number', 'phone', 'Leads Phone', 'Mobile'],
  leadsEmail: ['leadsEmail', 'Email', 'Email Address'],
  program: ['program', 'Product / Package', 'Product', 'Package', 'Offer'],
  qualified: ['qualified', 'Qualified'],
  bookedDay: ['bookedDay', 'Booked Day', 'Booked Date', 'Date', 'Appointment Date', 'Call Date'],
  bookedTime: ['bookedTime', 'Booked Time', 'Time', 'Appointment Time', 'Call Time'],
  notes: ['notes', 'Notes', 'Additional Notes'],
  setter: ['setter', 'Setter', 'Setter Name', 'Booked By', 'Your Name'],
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
  setter: ['setter', 'Setter', 'Setter Name'],
  closer: ['closer', 'Closer', 'Closer Name', 'Your Name'],
  closerEmail: ['closerEmail', 'Closer Email'],
  outboundInbound: ['outboundInbound', 'Source', 'Lead Source', 'Booked In From'],
  notes: ['notes', 'Notes', 'Additional Notes'],
};

var EOD_KEYS = {
  salesRep: ['salesRep', 'Your Name', 'Sales Rep', 'Rep', 'name'],
  closerName: ['closerName', 'Closer Name', 'Closer'],
  closerEmail: ['closerEmail', 'Closer Email', 'Email'],
  date: ['date', 'Date', 'Report Date'],
  netNewCallsBooked: ['netNewCallsBooked', 'Net New Calls Booked', 'New Calls Booked'],
  callsOnCalendar: ['callsOnCalendar', 'Calls On Calendar'],
  callsTaken: ['callsTaken', 'Total Calls Today', 'Calls Taken', 'Total Calls'],
  callsNoShowed: ['callsNoShowed', 'No Shows', 'No Showed', 'Calls No Showed'],
  callsCanceled: ['callsCanceled', 'Canceled', 'Cancelled', 'Calls Canceled'],
  callsRescheduled: ['callsRescheduled', 'Rescheduled', 'Calls Rescheduled'],
  callsTakenAndPitched: ['callsTakenAndPitched', 'Calls Offered', 'Offers Made', 'Pitched'],
  closes: ['closes', 'Closes', 'Deals Closed', 'Sales'],
  outboundDials: ['outboundDials', 'Outbound Dials', 'Dials'],
  cashCollectedMYFM: ['cashCollectedMYFM', 'Cash Collected MYFM'],
  cashCollectedI2I: ['cashCollectedI2I', 'Cash Collected I2I'],
  cashCollected: ['cashCollected', 'Cash Collected Today ($)', 'Cash Collected Today', 'Cash Collected'],
  revenueOnDay: ['revenueOnDay', 'Revenue On Day', 'Revenue'],
  improvementPlan: ['improvementPlan', 'Areas You Need Help In', 'Help Needed', 'Improvement Plan', 'Tomorrow'],
  leadsCalled: ['leadsCalled', 'Leads Called (names)', 'Leads Called', 'Leads'],
  callOutcomes: ['callOutcomes', 'Call Outcomes', 'Outcomes'],
};

function usedNames(map) {
  var out = [];
  Object.keys(map).forEach(function(k) { out = out.concat(map[k]); });
  return out;
}

function normalizeBookCall(flat) {
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
    extra: extras(flat, usedNames(BOOK_KEYS)),
  };
}

function normalizeCloseDeal(flat) {
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
    extra: extras(flat, usedNames(DEAL_KEYS)),
  };
}

function normalizeEOD(flat) {
  var g = function(f) { return pick(flat, EOD_KEYS[f]); };
  // The n8n EOD form asks for one cash figure. Split fields still win when present
  // so the in-app form (MYFM vs I2I) keeps its finer breakdown.
  var myfm = toNumber(g('cashCollectedMYFM'));
  var i2i = toNumber(g('cashCollectedI2I'));
  var single = toNumber(g('cashCollected'));
  if (!myfm && !i2i && single) i2i = single;
  var revenue = toNumber(g('revenueOnDay')) || (myfm + i2i);

  return {
    salesRep: g('salesRep') || g('closerName'),
    closerName: g('closerName'),
    closerEmail: g('closerEmail').toLowerCase(),
    date: g('date') || new Date().toISOString().split('T')[0],
    netNewCallsBooked: toInt(g('netNewCallsBooked')),
    callsOnCalendar: toInt(g('callsOnCalendar')),
    callsTaken: toInt(g('callsTaken')),
    callsNoShowed: toInt(g('callsNoShowed')),
    callsCanceled: toInt(g('callsCanceled')),
    callsRescheduled: toInt(g('callsRescheduled')),
    callsTakenAndPitched: toInt(g('callsTakenAndPitched')),
    closes: toInt(g('closes')),
    outboundDials: toInt(g('outboundDials')),
    cashCollectedMYFM: myfm,
    cashCollectedI2I: i2i,
    revenueOnDay: revenue,
    improvementPlan: g('improvementPlan'),
    leadsCalled: g('leadsCalled'),
    callOutcomes: g('callOutcomes'),
    extra: extras(flat, usedNames(EOD_KEYS)),
  };
}

// raw -> { type, record } ready for the store's add* functions.
export function normalizeSubmission(formType, raw) {
  var flat = flatten(raw);
  var type = resolveFormType(formType) || resolveFormType(pick(flat, ['formType', 'form', 'type']));
  if (!type) return { error: 'Unknown form type. Pass ?type=book-call | close-deal | eod-report' };

  var record;
  if (type === 'book-call') record = normalizeBookCall(flat);
  else if (type === 'close-deal') record = normalizeCloseDeal(flat);
  else record = normalizeEOD(flat);

  var workspaceId = pick(flat, ['workspaceId', 'workspace', 'Workspace']);
  if (workspaceId) record.workspaceId = workspaceId;
  record.formSource = pick(flat, ['formSource', 'source_form']) || 'n8n';

  return { type: type, record: record, flat: flat };
}
