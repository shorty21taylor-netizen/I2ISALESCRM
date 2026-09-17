// Handing the finished EOD arithmetic to Summit Sales AI and reading back what it
// means. Server-only: the key is resolved through getApiKey() and never
// returned, logged or put on a response.
//
// Every figure the model sees was already computed in eod-metrics.js. It is told
// so, and told to quote the numbers exactly rather than derive any of its own.

import Anthropic from '@anthropic-ai/sdk';
import { getApiKey } from '@/lib/ai-key';

// Re-exported so callers have one import for the feature, and so a server module
// can keep reaching for aggregateEod without knowing about the split.
export { aggregateEod, businessDaysBetween } from '@/lib/eod-metrics';

export var EOD_ANALYSIS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    daysAnalyzed: { type: 'integer' },
    repsAnalyzed: { type: 'integer' },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    headline: { type: 'string' },
    funnelLeaks: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          stage: { type: 'string' },
          metric: { type: 'string' },
          observation: { type: 'string' },
          evidence: { type: 'array', items: { type: 'string' } },
          fix: { type: 'string' },
        },
        required: ['stage', 'metric', 'observation', 'evidence', 'fix'],
      },
    },
    repFlags: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          rep: { type: 'string' },
          severity: { type: 'string', enum: ['low', 'medium', 'high'] },
          issue: { type: 'string' },
          evidence: { type: 'array', items: { type: 'string' } },
          coachingAction: { type: 'string' },
        },
        required: ['rep', 'severity', 'issue', 'evidence', 'coachingAction'],
      },
    },
    trends: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          title: { type: 'string' },
          direction: { type: 'string', enum: ['up', 'down', 'flat'] },
          observation: { type: 'string' },
          evidence: { type: 'array', items: { type: 'string' } },
        },
        required: ['title', 'direction', 'observation', 'evidence'],
      },
    },
    planReview: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          rep: { type: 'string' },
          pattern: { type: 'string' },
          repeating: { type: 'boolean' },
          note: { type: 'string' },
        },
        required: ['rep', 'pattern', 'repeating', 'note'],
      },
    },
    dataIntegrity: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          issue: { type: 'string' },
          reps: { type: 'array', items: { type: 'string' } },
          note: { type: 'string' },
        },
        required: ['issue', 'reps', 'note'],
      },
    },
    topFix: { type: 'string' },
  },
  required: ['daysAnalyzed', 'repsAnalyzed', 'confidence', 'headline', 'funnelLeaks',
    'repFlags', 'trends', 'planReview', 'dataIntegrity', 'topFix'],
};

var SYSTEM = [
  'You are Summit Sales AI, a sales operations analyst reading end-of-day reports from a high-ticket',
  'closing team. Every number you are given has already been calculated. Never recalculate, never',
  'estimate a figure that isn’t in the data, and quote figures exactly as supplied.',
  '',
  'Your job is to find where the money is leaking and who needs coaching.',
  '',
  '- Work the funnel in order — dials → booked → on calendar → taken → pitched → closed → cash — and',
  '  name the single stage with the worst drop-off before anything else.',
  '- A high no-show or cancel rate is a confirmation and booking-quality problem, not a closing problem.',
  '  A healthy pitched rate with a poor close rate is a closing problem. Say which one you are looking at.',
  '- Flag a rep only on a pattern across 3 or more reported days, and only when their number is an outlier',
  '  against the team, not just low in isolation. Name the behavior and one concrete coaching action.',
  '  Never speculate about a rep’s attitude, motivation, or personal life.',
  '- Read the improvement plans. If a rep writes substantially the same plan on multiple days, set',
  '  repeating: true — that means they identified a problem and did not fix it, which matters more than',
  '  the plan’s content.',
  '- Report missing EOD days under dataIntegrity. A rep who doesn’t report can’t be measured, and thin',
  '  data weakens every other finding — say so.',
  '- If fewer than 5 reports or fewer than 3 reporting days are present, set confidence to "low" and say',
  '  there isn’t enough data rather than manufacturing findings.',
  '- Write for an operator. Short, specific, numbers-first, no filler, no motivational language.',
  '',
  'A rate given as null means its denominator was zero, so the rate is unknowable. Treat it as missing',
  'data. Never describe it as 0%, and never call it a collapse.',
].join('\n');

function modelId() {
  return (process.env.SUMMIT_AI_MODEL || '').trim() || 'claude-opus-5';
}

export async function analyzeEod(aggregate, opts) {
  var apiKey = await getApiKey();
  if (!apiKey) return { error: 'AI not configured' };

  var client = (opts && opts.client) || new Anthropic({ apiKey: apiKey });
  var model = modelId();

  var prompt = [
    'These are the end-of-day figures for ' + aggregate.repCount + ' rep(s) across '
      + aggregate.range.businessDays + ' business day(s), '
      + aggregate.range.from + ' to ' + aggregate.range.to + '.',
    aggregate.setterReportCount
      ? aggregate.setterReportCount + ' setter reports were filed in this range. They are NOT in the'
        + ' funnel below, because a setter does not pitch or close.'
      : '',
    aggregate.plansTruncated ? 'The improvement plans are the most recent 200 in the range.' : '',
    '',
    JSON.stringify(aggregate),
  ].filter(Boolean).join('\n');

  try {
    var response = await client.messages.create({
      model: model,
      max_tokens: 4000,
      system: SYSTEM,
      tools: [{
        name: 'eod_analysis',
        description: 'Return the analysis of these end-of-day reports.',
        input_schema: EOD_ANALYSIS_SCHEMA,
        strict: true,
      }],
      tool_choice: { type: 'tool', name: 'eod_analysis' },
      messages: [{ role: 'user', content: prompt }],
    });

    var block = (response.content || []).filter(function(b) {
      return b && b.type === 'tool_use' && b.name === 'eod_analysis';
    })[0];
    if (!block || !block.input) {
      return { error: 'The analysis came back in an unexpected shape. Try it again.' };
    }
    return { result: block.input, model: model };
  } catch (e) {
    // Never surface the upstream body or a stack — it can carry request details.
    console.error('[EOD analyst]', e && e.message);
    if (e instanceof Anthropic.AuthenticationError) return { error: 'The AI key was rejected. Check it in Settings.' };
    if (e instanceof Anthropic.RateLimitError) return { error: 'Rate limited by the AI provider. Try again shortly.' };
    return { error: 'The analysis could not be completed. Try it again in a moment.' };
  }
}
