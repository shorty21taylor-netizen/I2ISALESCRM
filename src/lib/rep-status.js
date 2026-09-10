// Whether a rep is reachable right now.
//
// This is presence, not a record: nothing here counts toward anyone's numbers,
// and nothing here is history. The list is deliberately short — a picker with
// fifteen states gets set once and then lies forever, whereas five states people
// recognise on sight tend to get kept current.

export var STATUSES = [
  { id: 'available', label: 'Available',     tone: 'good',  detail: 'On the floor and ready for calls' },
  { id: 'call',      label: 'On a call',     tone: 'live',  detail: 'Live with a prospect right now' },
  { id: 'meeting',   label: 'In a meeting',  tone: 'busy',  detail: 'Internal — not a sales call' },
  { id: 'focus',     label: 'Heads down',    tone: 'focus', detail: 'Working, would rather not be pulled' },
  { id: 'off',       label: 'Off the floor', tone: 'off',   detail: 'Done for now' },
];

export var DEFAULT_STATUS = 'available';

// How long a busy status holds before it drops back to Available on its own.
// A status that never expires is worse than no status at all: an "In a meeting"
// left over from Tuesday teaches the whole floor to ignore the light.
export var DURATIONS = [
  { id: '30',   label: '30 min',            minutes: 30 },
  { id: '60',   label: '1 hour',            minutes: 60 },
  { id: '120',  label: '2 hours',           minutes: 120 },
  { id: '240',  label: '4 hours',           minutes: 240 },
  { id: 'open', label: 'Until I change it', minutes: 0 },
];

export var MAX_STATUS_MINUTES = 600;
export var MAX_NOTE = 60;

export function statusById(id) {
  var want = String(id || '').trim();
  for (var i = 0; i < STATUSES.length; i++) {
    if (STATUSES[i].id === want) return STATUSES[i];
  }
  return null;
}

// What a rep's status actually is right now, which is not always the last thing
// they picked: a busy status whose expiry has passed reads as Available again.
export function effectiveStatus(profile) {
  var chosen = (profile && profile.status) || DEFAULT_STATUS;
  var until = (profile && profile.statusUntil) || '';
  var lapsed = false;

  if (chosen !== DEFAULT_STATUS && until) {
    var t = Date.parse(until);
    if (!isNaN(t) && t <= Date.now()) { chosen = DEFAULT_STATUS; lapsed = true; }
  }

  var def = statusById(chosen) || statusById(DEFAULT_STATUS);
  var quiet = lapsed || def.id === DEFAULT_STATUS;
  return {
    id: def.id,
    label: def.label,
    tone: def.tone,
    detail: def.detail,
    note: quiet ? '' : ((profile && profile.statusNote) || ''),
    until: quiet ? '' : until,
    setAt: quiet ? '' : ((profile && profile.statusSetAt) || ''),
  };
}
