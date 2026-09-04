// The Skool community pipeline: shared definitions so the API, the store and the
// page all agree on what a stage is called and what counts as revenue.
//
// A lead lives in one of two communities and moves along one pipeline. Setters work
// the free community to move people into the paid one, and work the paid community
// to move people onto a closer's calendar for high ticket — so the same six stages
// serve both, and the money is tracked separately by where it came from.

export var SKOOL_COMMUNITIES = [
  { id: 'free', label: 'Free Community', blurb: 'Working them toward the paid group or a call' },
  { id: 'paid', label: 'Paid Community', blurb: 'Paying members — working them toward high ticket' },
];

export var SKOOL_STAGES = [
  { id: 'message-sent', label: 'Message Sent', short: 'Messaged', open: true },
  { id: 'in-conversation', label: 'In Conversation', short: 'In Convo', open: true },
  { id: 'booked-call', label: 'Booked Call', short: 'Booked', open: true },
  { id: 'closed', label: 'Closed', short: 'Closed', won: true },
  { id: 'no-close', label: "Didn't Close", short: 'No Close', lost: true },
  { id: 'paid-community', label: 'Paid Skool Community', short: 'Paid Member', won: true },
];

export var DEFAULT_STAGE = 'message-sent';

export function stageById(id) {
  for (var i = 0; i < SKOOL_STAGES.length; i++) {
    if (SKOOL_STAGES[i].id === id) return SKOOL_STAGES[i];
  }
  return null;
}

export function isStage(id) {
  return !!stageById(id);
}

export function stageLabel(id) {
  var s = stageById(id);
  return s ? s.label : (id || '');
}

export function isCommunity(id) {
  return id === 'free' || id === 'paid';
}

export function money(value) {
  if (value === undefined || value === null || value === '') return 0;
  var s = String(value).replace(/[^0-9.\-]/g, '');
  if (s === '' || s === '-' || s === '.') return 0;
  var n = parseFloat(s);
  return isNaN(n) ? 0 : Math.round((n + Number.EPSILON) * 100) / 100;
}

function emptyBucket() {
  return {
    leads: 0,
    communityCash: 0,
    highTicketCash: 0,
    cash: 0,
    booked: 0,
    closed: 0,
    noClose: 0,
    upgrades: 0,
    stages: {},
  };
}

function countInto(bucket, lead) {
  bucket.leads++;
  bucket.communityCash += money(lead.communityCash);
  bucket.highTicketCash += money(lead.highTicketCash);
  bucket.cash = Math.round((bucket.communityCash + bucket.highTicketCash) * 100) / 100;
  bucket.stages[lead.stage] = (bucket.stages[lead.stage] || 0) + 1;
  if (lead.stage === 'booked-call') bucket.booked++;
  if (lead.stage === 'closed') bucket.closed++;
  if (lead.stage === 'no-close') bucket.noClose++;
  // An upgrade is the event, not the current stage: someone moved into the paid
  // community and stays counted even after they go on to book a high-ticket call.
  if (lead.joinedPaidAt) bucket.upgrades++;
}

// Everything the page reports, computed in one pass so the sections, the setter
// board and the headline can never disagree with each other.
export function computeSkoolStats(leads) {
  var overall = emptyBucket();
  var byCommunity = { free: emptyBucket(), paid: emptyBucket() };
  var setterMap = {};

  (leads || []).forEach(function(lead) {
    if (!lead) return;
    countInto(overall, lead);
    if (byCommunity[lead.community]) countInto(byCommunity[lead.community], lead);

    var setter = (lead.setter || '').trim() || 'Unassigned';
    if (!setterMap[setter]) {
      setterMap[setter] = Object.assign({ name: setter }, emptyBucket());
    }
    countInto(setterMap[setter], lead);
  });

  var setters = Object.keys(setterMap).map(function(k) { return setterMap[k]; });
  setters.sort(function(a, b) { return (b.cash - a.cash) || (b.leads - a.leads); });

  return { overall: overall, byCommunity: byCommunity, setters: setters };
}
