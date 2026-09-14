// The setter and closer pipelines: one record, two views.
//
// A prospect-appointment is a single row. The setter board and the closer board are
// two role-scoped renderings of it, with different visible columns and different
// edit permissions. There is deliberately no setter table and no closer table —
// two tables would mean two sources of truth, and within a week the setter's board
// and the closer's board would disagree about whether a call showed.
//
// Dependency-free on purpose, like skool.js: the store, the API routes, the webhook
// and the page all read the stage model from here, so they can never drift.

import { REPORT_TIMEZONE } from '@/lib/report-date';

// The single stage column that drives both boards. `terminal` marks the stages a
// record stops moving through on its own; `won` and `lost` say which way it ended.
export var PIPELINE_STAGES = [
  { id: 'new',        label: 'New',            short: 'New' },
  { id: 'contacted',  label: 'Contacted',      short: 'Contacted' },
  { id: 'qualified',  label: 'Qualified',      short: 'Qualified' },
  { id: 'booked',     label: 'Booked',         short: 'Booked' },
  { id: 'confirmed',  label: 'Confirmed',      short: 'Confirmed' },
  { id: 'showed',     label: 'Showed',         short: 'Showed' },
  { id: 'pitched',    label: 'Pitched',        short: 'Pitched' },
  { id: 'follow_up',  label: 'Follow-up',      short: 'Follow-up' },
  { id: 'won',        label: 'Won',            short: 'Won',      won: true,  terminal: true },
  { id: 'lost',       label: 'Lost',           short: 'Lost',     lost: true, terminal: true },
  { id: 'no_show',    label: 'No-show',        short: 'No-show',  lost: true, terminal: true },
  { id: 'dq',         label: 'Disqualified',   short: 'DQ',       lost: true, terminal: true },
];

export var DEFAULT_STAGE = 'new';
export var BOOKED_STAGE = 'booked';

export function stageById(id) {
  for (var i = 0; i < PIPELINE_STAGES.length; i++) {
    if (PIPELINE_STAGES[i].id === id) return PIPELINE_STAGES[i];
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

export function isWonStage(id) {
  var s = stageById(id);
  return !!(s && s.won);
}

// ============================================
// THE TWO BOARDS
// ============================================
//
// Each board renders a subset of the same stage column. A column can hold more than
// one stage — the setter does not care whether the closer has pitched yet, only that
// the call is now with them, so `showed`, `pitched` and `follow_up` collapse into one
// column on their board and are six separate columns on the closer's.
//
// `drop` is the stage a card lands on when it is dragged into that column. A column
// covering several stages drops onto the first, which is always the earliest.

export var SETTER_COLUMNS = [
  { id: 'new',         label: 'New',         stages: ['new'] },
  { id: 'contacted',   label: 'Contacted',   stages: ['contacted'] },
  { id: 'qualified',   label: 'Qualified',   stages: ['qualified'] },
  { id: 'booked',      label: 'Booked',      stages: ['booked', 'confirmed'] },
  { id: 'with-closer', label: 'With closer', stages: ['showed', 'pitched', 'follow_up'] },
  { id: 'closed',      label: 'Closed',      stages: ['won'], won: true },
];

export var SETTER_LANES = [
  { id: 'no-show', label: 'No-show', stages: ['no_show'], lost: true },
  { id: 'dead',    label: 'Dead',    stages: ['lost', 'dq'], lost: true },
];

export var CLOSER_COLUMNS = [
  { id: 'booked',    label: 'Booked',    stages: ['booked'] },
  { id: 'confirmed', label: 'Confirmed', stages: ['confirmed'] },
  { id: 'showed',    label: 'Showed',    stages: ['showed'] },
  { id: 'pitched',   label: 'Pitched',   stages: ['pitched'] },
  { id: 'follow_up', label: 'Follow-up', stages: ['follow_up'] },
  { id: 'won',       label: 'Won',       stages: ['won'], won: true },
];

export var CLOSER_LANES = [
  { id: 'lost',    label: 'Lost',    stages: ['lost'], lost: true },
  { id: 'no-show', label: 'No-show', stages: ['no_show'], lost: true },
];

export function boardFor(view) {
  if (view === 'setter') {
    return { view: 'setter', columns: SETTER_COLUMNS, lanes: SETTER_LANES };
  }
  return { view: 'closer', columns: CLOSER_COLUMNS, lanes: CLOSER_LANES };
}

// Which board a role opens on. Managers and above get a toggle, but they still have
// to land on one of them.
export function defaultView(role) {
  return String(role || '').toLowerCase() === 'setter' ? 'setter' : 'closer';
}

// The stage a drop into this column means.
export function dropStage(column) {
  return column && column.stages && column.stages.length ? column.stages[0] : DEFAULT_STAGE;
}

// ============================================
// WHO MAY MOVE WHAT
// ============================================
//
// Enforced in the API route, not here and not in the UI — this is the shared table
// both ends read so the board can grey out what the server would refuse anyway.
//
// A setter works a lead up to the point it lands on a calendar. Once the closer has
// taken the call, the outcome is the closer's to record: the setter still sees the
// card and its full outcome, but cannot move it. A closer picks it up at `booked`
// and cannot rewrite the prospecting that came before.

export var SETTER_MOVABLE = ['new', 'contacted', 'qualified', 'booked', 'confirmed', 'dq'];
export var CLOSER_MOVABLE = ['booked', 'confirmed', 'showed', 'pitched', 'follow_up', 'won', 'lost', 'no_show'];

export function seniorRole(role) {
  var r = String(role || '').toLowerCase();
  return r === 'operator' || r === 'owner' || r === 'admin' || r === 'manager';
}

// `relation` is how this caller is attached to the record: 'setter', 'closer',
// 'senior' or '' for neither. Both ends of a move are checked: a setter whose card
// is sitting in `booked` must not be able to send it straight to `won`, which is the
// closer's outcome to record and feeds the commission numbers.
export function canMove(relation, fromStage, toStage) {
  // The stage is checked before the role, so "manager" is not a way past a typo.
  if (!isStage(toStage)) return { ok: false, reason: 'Unknown stage: ' + toStage };
  if (relation === 'senior') return { ok: true };

  var allowed = null;
  if (relation === 'setter') allowed = SETTER_MOVABLE;
  else if (relation === 'closer') allowed = CLOSER_MOVABLE;

  if (!allowed) {
    return { ok: false, reason: 'This record is not yours to move.' };
  }
  if (allowed.indexOf(fromStage) === -1) {
    if (relation === 'setter') {
      return { ok: false, reason: 'This call is with the closer now — it is theirs to move.' };
    }
    return { ok: false, reason: 'A closer picks a record up once it is booked.' };
  }
  if (allowed.indexOf(toStage) === -1) {
    if (relation === 'setter') {
      return { ok: false, reason: 'Only the closer can record the outcome of a call.' };
    }
    return { ok: false, reason: 'A closer cannot move a record back into prospecting.' };
  }
  return { ok: true };
}

// May this caller move this card at all? Used by the board to decide whether a card
// is draggable. The server checks again on every move — this only keeps the UI honest.
export function canMoveFrom(relation, fromStage) {
  if (relation === 'senior') return true;
  if (relation === 'setter') return SETTER_MOVABLE.indexOf(fromStage) !== -1;
  if (relation === 'closer') return CLOSER_MOVABLE.indexOf(fromStage) !== -1;
  return false;
}

// ============================================
// STALE CARDS
// ============================================
//
// This is where the money leaks, so it is a first-class part of the record rather
// than something the page works out on its own: a call nobody confirmed, a pitch
// nobody followed up, a lead nobody called back.

var HOUR = 3600 * 1000;
var DAY = 24 * HOUR;

function age(value, now) {
  if (!value) return null;
  var t = new Date(value).getTime();
  if (isNaN(t)) return null;
  return now - t;
}

// Returns '' when the card is fine, or a short reason when it needs attention.
export function staleReason(record, now) {
  if (!record) return '';
  var stage = record.stage;
  var ref = now === undefined || now === null ? Date.now() : now;

  // Terminal stages are done. Nobody needs chasing about a card that has landed.
  if (stage === 'won' || stage === 'lost' || stage === 'dq') return '';

  if (stage === 'booked' || stage === 'confirmed') {
    var until = age(record.appointmentAt, ref);
    // Negative age = the appointment is still ahead of us.
    if (until !== null && until < 0 && until > -DAY) {
      var quiet = age(record.lastActivityAt || record.stageChangedAt || record.createdAt, ref);
      if (quiet === null || quiet > DAY) return 'Call within 24h, not confirmed';
    }
    return '';
  }

  if (stage === 'showed') {
    var sat = age(record.stageChangedAt, ref);
    if (sat !== null && sat > 2 * DAY) return 'Showed 48h ago, no outcome';
    return '';
  }

  if (stage === 'follow_up') {
    var fu = age(record.stageChangedAt, ref);
    if (fu !== null && fu > 7 * DAY) return 'Follow-up older than 7 days';
    return '';
  }

  if (stage === 'new' || stage === 'contacted') {
    var cold = age(record.stageChangedAt || record.createdAt, ref);
    if (cold !== null && cold > 3 * DAY) return 'No contact in 3 days';
    return '';
  }

  // no_show is not chased by the clock — it is chased by a person deciding to rebook.
  return '';
}

export function isStale(record, now) {
  return !!staleReason(record, now);
}

// ============================================
// THE APPOINTMENT, IN WORDS
// ============================================
//
// Days are bucketed in the team's timezone everywhere else in the app, so they are
// bucketed in the team's timezone here too. A 6pm Pacific call must read "Today" to
// a rep working that floor, not "Tomorrow" because the server is in UTC.

function dayKey(value) {
  if (!value) return '';
  var d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: REPORT_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(d);
  } catch (e) {
    return d.toISOString().split('T')[0];
  }
}

function clockTime(value) {
  var d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: REPORT_TIMEZONE, hour: 'numeric', minute: '2-digit',
    }).format(d);
  } catch (e) {
    return '';
  }
}

// Whole days between two day-keys, so "tomorrow" never depends on the time of day.
function daysBetween(fromKey, toKey) {
  if (!fromKey || !toKey) return null;
  var a = Date.parse(fromKey + 'T00:00:00Z');
  var b = Date.parse(toKey + 'T00:00:00Z');
  if (isNaN(a) || isNaN(b)) return null;
  return Math.round((b - a) / DAY);
}

// 'Today 2:00 PM', 'Tomorrow 9:30 AM', 'In 3 days', 'Sep 2, 4:00 PM'.
export function appointmentLabel(value, now) {
  if (!value) return '';
  var when = dayKey(value);
  if (!when) return '';
  var today = dayKey(now === undefined || now === null ? new Date() : new Date(now));
  var delta = daysBetween(today, when);
  var time = clockTime(value);

  if (delta === 0) return time ? 'Today ' + time : 'Today';
  if (delta === 1) return time ? 'Tomorrow ' + time : 'Tomorrow';
  if (delta === -1) return time ? 'Yesterday ' + time : 'Yesterday';
  if (delta !== null && delta > 1 && delta <= 7) return 'In ' + delta + ' days' + (time ? ' · ' + time : '');
  if (delta !== null && delta < -1 && delta >= -7) return Math.abs(delta) + ' days ago';

  var d = new Date(value);
  if (isNaN(d.getTime())) return '';
  try {
    var date = new Intl.DateTimeFormat('en-US', {
      timeZone: REPORT_TIMEZONE, month: 'short', day: 'numeric',
    }).format(d);
    return time ? date + ', ' + time : date;
  } catch (e) {
    return when;
  }
}

export function money(value) {
  if (value === undefined || value === null || value === '') return 0;
  var s = String(value).replace(/[^0-9.\-]/g, '');
  if (s === '' || s === '-' || s === '.') return 0;
  var n = parseFloat(s);
  return isNaN(n) ? 0 : Math.round((n + Number.EPSILON) * 100) / 100;
}

// ============================================
// BOARD HEADLINE NUMBERS
// ============================================
//
// The two figures each role actually cares about, computed over the records that
// role can see so the header can never disagree with the columns under it.

function inMonth(value, ref) {
  var key = dayKey(value);
  var now = dayKey(ref);
  return !!key && !!now && key.slice(0, 7) === now.slice(0, 7);
}

function inLastWeek(value, ref) {
  var t = new Date(value).getTime();
  if (isNaN(t)) return false;
  var delta = ref - t;
  return delta >= 0 && delta <= 7 * DAY;
}

export function computePipelineStats(records, view, now) {
  var ref = now === undefined || now === null ? Date.now() : now;
  var rows = (records || []).filter(Boolean);

  var byStage = {};
  var stale = 0;
  var wonCash = 0;
  var wonCount = 0;
  var reachedCloser = 0;   // showed or beyond — the denominator for a show rate
  var bookedEver = 0;
  var bookedThisWeek = 0;
  var setsThisMonth = 0;

  rows.forEach(function(r) {
    byStage[r.stage] = (byStage[r.stage] || 0) + 1;
    if (isStale(r, ref)) stale++;

    if (r.stage === 'won') {
      wonCount++;
      wonCash += money(r.cashCollected);
    }

    // "Was this ever a real appointment?" — a card that reached booked counts even
    // after it has moved on, which is the only way a show rate means anything.
    var booked = !!r.bookedAt || ['booked', 'confirmed', 'showed', 'pitched', 'follow_up', 'won', 'lost', 'no_show']
      .indexOf(r.stage) !== -1;
    if (booked) {
      bookedEver++;
      if (inLastWeek(r.bookedAt || r.createdAt, ref)) bookedThisWeek++;
      if (inMonth(r.bookedAt || r.createdAt, ref)) setsThisMonth++;
    }
    if (['showed', 'pitched', 'follow_up', 'won', 'lost'].indexOf(r.stage) !== -1) reachedCloser++;
  });

  var showRate = bookedEver ? Math.round((reachedCloser / bookedEver) * 100) : 0;
  var closeRate = reachedCloser ? Math.round((wonCount / reachedCloser) * 100) : 0;

  return {
    total: rows.length,
    byStage: byStage,
    stale: stale,
    wonCount: wonCount,
    wonCash: Math.round(wonCash * 100) / 100,
    bookedEver: bookedEver,
    bookedThisWeek: bookedThisWeek,
    setsThisMonth: setsThisMonth,
    showRate: showRate,
    closeRate: closeRate,
    // The two the header actually prints, already picked for the role.
    headline: view === 'setter'
      ? [{ label: 'Sets this month', value: String(setsThisMonth) }, { label: 'Show rate', value: showRate + '%' }]
      : [{ label: 'Booked this week', value: String(bookedThisWeek) }, { label: 'Close rate', value: closeRate + '%' }],
  };
}
