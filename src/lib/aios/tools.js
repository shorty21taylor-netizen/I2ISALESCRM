// The fixed catalogue of things Summit AIOS is allowed to look up.
//
// The model never writes a query. It picks a name from this list and fills in
// typed parameters, and every parameter is checked against an allowlist here
// before it reaches a handler. Nothing on this page is interpolated into a query
// string of any kind — the handlers call the same computation layer the
// dashboards call, so an answer in chat and the same number on a page come out
// of one engine and cannot disagree.
import { RANGE_IDS, isDay } from '@/lib/aios/range';

// Result caps. The spec's ceiling is 2,000 rows; each list tool also carries a
// much smaller default, because a chat answer that quotes 2,000 rows is not an
// answer.
export var MAX_ROWS = 2000;
var DEFAULT_LIMIT = 25;

var GROUPS = ['closers', 'setters', 'dmSetters', 'all'];
var BOARDS = ['closers', 'setters'];

// A date range, as three properties every tool that takes one shares.
function rangeProps() {
  return {
    range: {
      type: 'string',
      enum: RANGE_IDS,
      description: 'Which window to measure. Use "custom" only when the question names specific dates.',
    },
    start: {
      anyOf: [{ type: 'string', format: 'date' }, { type: 'null' }],
      description: 'Start day as YYYY-MM-DD. Required when range is "custom", otherwise null.',
    },
    end: {
      anyOf: [{ type: 'string', format: 'date' }, { type: 'null' }],
      description: 'End day as YYYY-MM-DD. Required when range is "custom", otherwise null.',
    },
  };
}
var RANGE_KEYS = ['range', 'start', 'end'];

// Nullable properties are written as anyOf rather than a type array: a strict
// schema accepts anyOf, and a type array is not part of the subset it supports.
function repProp(desc) {
  return { anyOf: [{ type: 'string' }, { type: 'null' }], description: desc };
}

function limitProp() {
  return {
    anyOf: [{ type: 'integer' }, { type: 'null' }],
    description: 'How many rows to return, 1-' + MAX_ROWS + '. Null means ' + DEFAULT_LIMIT + '.',
  };
}

// Every tool is declared strict, which requires additionalProperties:false and
// every property listed in required — so the model cannot smuggle an extra key
// past the validator by inventing one.
function tool(name, description, props, required) {
  return {
    name: name,
    description: description,
    strict: true,
    input_schema: {
      type: 'object',
      properties: props,
      required: required,
      additionalProperties: false,
    },
  };
}

function withRange(props) {
  var out = rangeProps();
  Object.keys(props || {}).forEach(function(k) { out[k] = props[k]; });
  return out;
}

export var TOOLS = [
  tool('get_team_metrics',
    'Team-wide funnel, conversion rates and cash for a date range: dials, conversations, calls booked, on calendar, shows, no-shows, cancels, reschedules, offers made, closes, cash collected, cash per show, cash per offer, show rate, close rate. This is the first tool to reach for on any "how did we do" question.',
    withRange({}), RANGE_KEYS),

  tool('get_rep_metrics',
    'One rep\'s own funnel, rates and cash over a date range, matched by the name they file under. Use when a question is about a specific person.',
    withRange({ rep_name: repProp('The rep\'s name as it appears on their reports. Null means the person asking.') }),
    RANGE_KEYS.concat(['rep_name'])),

  tool('list_reps',
    'Who is on the floor in this window and what they do — name, group (closer, setter, DM setter) and how many days they filed. Use this to resolve a name before asking for someone\'s numbers.',
    withRange({ group: { anyOf: [{ type: 'string', enum: GROUPS }, { type: 'null' }], description: 'Narrow to one group, or null for everyone.' } }),
    RANGE_KEYS.concat(['group'])),

  tool('get_leaderboard',
    'The closer or setter board for a date range, ranked. Closers rank on cash; setters rank on calls set.',
    withRange({
      board: { type: 'string', enum: BOARDS, description: 'Which board to rank.' },
      limit: limitProp(),
    }),
    RANGE_KEYS.concat(['board', 'limit'])),

  tool('get_daily_series',
    'Day by day across the range: dials, conversations, sets, shows, offers, closes, no-shows and cash. Use for trends, streaks, best and worst days.',
    withRange({}), RANGE_KEYS),

  tool('compare_periods',
    'The same team metrics for a range and for the equal-length window immediately before it, with the change between them. Use for "are we up or down" questions.',
    withRange({}), RANGE_KEYS),

  tool('list_closed_deals',
    'Individual closed deals in the range: closer, setter, program, cash collected, inbound or outbound, and the day. Deals are deduplicated first, so a close filed by both the setter and the closer counts once.',
    withRange({ rep_name: repProp('Only this rep\'s deals, or null for everyone in scope.'), limit: limitProp() }),
    RANGE_KEYS.concat(['rep_name', 'limit'])),

  tool('list_booked_calls',
    'Individual booked-call forms in the range: setter, closer, prospect qualification and the day.',
    withRange({ rep_name: repProp('Only this rep\'s bookings, or null for everyone in scope.'), limit: limitProp() }),
    RANGE_KEYS.concat(['rep_name', 'limit'])),

  tool('list_eod_reports',
    'Individual end-of-day reports in the range, with the numbers each rep filed for that day.',
    withRange({ rep_name: repProp('Only this rep\'s reports, or null for everyone in scope.'), limit: limitProp() }),
    RANGE_KEYS.concat(['rep_name', 'limit'])),

  tool('get_data_quality',
    'How trustworthy the numbers in this range are: which EOD fields the floor is actually filling in, which values were rejected as impossible, and whether the closes on EODs agree with the deal forms. Use this before calling a rate surprising.',
    withRange({}), RANGE_KEYS),

  tool('get_program_mix',
    'What was sold in the range, by program, plus the inbound/outbound split of cash and deals.',
    withRange({}), RANGE_KEYS),

  tool('get_after_call_outcomes',
    'The recap closers filed after their calls in the range, grouped by outcome.',
    withRange({}), RANGE_KEYS),

  tool('get_awards',
    'A rep\'s career award standing: which of the twenty milestones they hold, which they are closest to, and how far along each one is.',
    { rep_name: repProp('Whose awards. Null means the person asking.') },
    ['rep_name']),

  tool('get_onboarding_status',
    'How far a rep is through onboarding: percent complete, which checkpoints are done, and what is still owed.',
    { rep_name: repProp('Whose onboarding. Null means the person asking.') },
    ['rep_name']),
];

export function toolByName(name) {
  for (var i = 0; i < TOOLS.length; i++) {
    if (TOOLS[i].name === name) return TOOLS[i];
  }
  return null;
}

// ---- validation ----
//
// This runs on every tool call before a handler sees it. It is the access
// control, not the system prompt: an instruction in a prompt is a request, and
// the model is free to ignore a request.
function fail(message) {
  return { ok: false, error: message };
}

export function validateCall(name, rawInput) {
  var spec = toolByName(name);
  if (!spec) return fail('There is no tool called "' + name + '".');

  var input = rawInput && typeof rawInput === 'object' && !Array.isArray(rawInput) ? rawInput : {};
  var props = spec.input_schema.properties;
  var clean = {};

  var keys = Object.keys(input);
  for (var i = 0; i < keys.length; i++) {
    if (!Object.prototype.hasOwnProperty.call(props, keys[i])) {
      return fail('"' + keys[i] + '" is not a parameter of ' + name + '.');
    }
  }

  if (Object.prototype.hasOwnProperty.call(props, 'range')) {
    var range = input.range;
    if (RANGE_IDS.indexOf(range) === -1) {
      return fail('range must be one of: ' + RANGE_IDS.join(', ') + '.');
    }
    clean.range = range;
    if (range === 'custom') {
      if (!isDay(input.start) || !isDay(input.end)) {
        return fail('A custom range needs both start and end as YYYY-MM-DD.');
      }
      clean.start = input.start.trim();
      clean.end = input.end.trim();
    } else {
      clean.start = null;
      clean.end = null;
    }
  }

  if (Object.prototype.hasOwnProperty.call(props, 'group')) {
    var g = input.group;
    if (g === null || g === undefined || g === '') clean.group = null;
    else if (GROUPS.indexOf(g) === -1) return fail('group must be one of: ' + GROUPS.join(', ') + '.');
    else clean.group = g;
  }

  if (Object.prototype.hasOwnProperty.call(props, 'board')) {
    if (BOARDS.indexOf(input.board) === -1) return fail('board must be one of: ' + BOARDS.join(', ') + '.');
    clean.board = input.board;
  }

  if (Object.prototype.hasOwnProperty.call(props, 'rep_name')) {
    var rn = input.rep_name;
    if (rn === null || rn === undefined || String(rn).trim() === '') clean.rep_name = null;
    else if (typeof rn !== 'string') return fail('rep_name must be a name, as text.');
    else {
      var name2 = rn.trim().replace(/\s+/g, ' ');
      // A name is a name. Anything longer, or carrying an @, is not one — and a
      // handler should never be handed something shaped like an address or a
      // pasted blob to match against.
      if (name2.length > 80 || name2.indexOf('@') !== -1) {
        return fail('rep_name must be a person\'s name, not an email address.');
      }
      clean.rep_name = name2;
    }
  }

  if (Object.prototype.hasOwnProperty.call(props, 'limit')) {
    var lim = input.limit;
    if (lim === null || lim === undefined) clean.limit = DEFAULT_LIMIT;
    else {
      var num = parseInt(lim, 10);
      if (!isFinite(num) || num < 1) return fail('limit must be a whole number of at least 1.');
      clean.limit = Math.min(num, MAX_ROWS);
    }
  }

  return { ok: true, input: clean };
}
