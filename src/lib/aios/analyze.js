// The "Analyze" button behind the reporting pages.
//
// Same tool catalogue, same access context and same refusals as a chat turn — the
// only difference is that the question is written here rather than typed, and the
// look-up budget is larger because finding a pattern takes more reads than
// answering "how much cash yesterday".
//
// The point of the fixed prompt is that the answer is comparable week to week. An
// operator typing "what's wrong" twice gets two differently-shaped answers; this
// always produces the same sections in the same order, so a change in the output
// means a change on the floor rather than a change in phrasing.

export var SURFACES = {
  'after-call': {
    label: 'After-Call Reports',
    lead: 'Start from the after-call recaps: get_after_call_outcomes, then list_booked_calls and '
      + 'get_team_metrics for the same window so outcomes sit against the funnel that produced them.',
    focus: 'what is happening ON the calls — objections, outcome mix, which closers convert the same '
      + 'lead quality differently, and whether the prospects arriving are the ones the offer is for.',
  },
  'eod': {
    label: 'EOD Reports',
    lead: 'Start from the filed reports: list_eod_reports and get_team_metrics, then get_daily_series '
      + 'for the shape of the window and compare_periods against the window before it.',
    focus: 'activity and consistency — who is filing, dials and conversations against sets, which days '
      + 'break the pattern, and whether effort is translating into calls on the calendar.',
  },
  'metrics': {
    label: 'Team Metrics',
    lead: 'Start wide: get_team_metrics and compare_periods, then get_daily_series, then narrow with '
      + 'get_leaderboard and get_program_mix where a number looks unusual.',
    focus: 'the whole funnel end to end, and which single stage is costing the most money.',
  },
};

export function isSurface(id) {
  return Object.prototype.hasOwnProperty.call(SURFACES, id);
}

// The diagnosis this is actually for: is the floor's problem the leads it is being
// sent, or what it does with them? Those have opposite fixes and the offer owner
// spends real money getting it wrong, so the rule is spelled out rather than left
// to the model's instinct.
var DIAGNOSIS = [
  'Then say whether what you found is a MARKETING problem, a SALES problem, or both, and show your',
  'reasoning from the numbers you looked up.',
  '',
  'Read it this way:',
  '- Points at MARKETING / lead quality: calls booked but not showing, no-shows concentrated in one',
  '  source, weak credit or intent scores on the bookings, prospects arriving who are not the offer\'s',
  '  buyer, a show rate falling while set volume climbs.',
  '- Points at SALES / execution: prospects show but are not pitched, offers made but not closing,',
  '  the same lead quality converting well for one closer and badly for another, long talk time with',
  '  nothing to show, one objection recurring across recaps.',
  '- If set volume is healthy and show rate is healthy and close rate is not, it is sales. If sets are',
  '  healthy and shows are not, it is marketing. Say which of those you are seeing.',
].join('\n');

export function buildAnalysisPrompt(surfaceId, range) {
  var s = SURFACES[surfaceId] || SURFACES.metrics;
  var window = range && range.id === 'custom' && range.start && range.end
    ? 'the range ' + range.start + ' to ' + range.end
    : 'the ' + (range && range.id ? range.id : 'month') + ' window';

  return [
    'Analyse this floor over ' + window + ' and report what the numbers show. You are reading the '
      + s.label + ' surface, so weight it toward ' + s.focus,
    '',
    s.lead,
    'Call get_data_quality before you call any rate surprising — a rate built on a field nobody fills',
    'in is not a finding, it is a gap, and saying so is more useful than a confident wrong answer.',
    '',
    'Write it in exactly these sections, in this order, and nothing else:',
    '',
    '**What is working**',
    'Two to four things the numbers genuinely support. Each one with the figure behind it. If nothing',
    'in this window is working, say that plainly rather than padding it.',
    '',
    '**What is costing you**',
    'Two to four problems, worst first. For each: the figure, and where in the funnel it happens. Put a',
    'number on the cost where the data lets you — "shows are down 14 points on last month, which at your',
    'close rate is roughly $X" — and say when it does not.',
    '',
    '**Sales or marketing**',
    DIAGNOSIS,
    '',
    '**Do this next**',
    'Three actions, most valuable first, each one a thing a person could start on Monday. Name who does',
    'it. No generic advice — it has to follow from a number you just quoted.',
    '',
    'Rules: every figure comes from a tool call, never from memory or estimate. A null rate is "not',
    'measurable", never zero. If the window is too thin to conclude anything, the honest answer is that',
    'it is too thin and how much data you would need — do not manufacture a pattern out of four calls.',
  ].join('\n');
}
