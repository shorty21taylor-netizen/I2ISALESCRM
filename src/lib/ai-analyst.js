// Reading the after-call reports and saying what is costing the team money.
//
// Server-only. The key never leaves this process: it is resolved through
// getApiKey(), which reads the environment OR the encrypted key the operator set
// in Settings, and it is never returned, logged or put on a response.
//
// The corpus is built from what closers actually wrote. Everything the model says
// has to be groundable in it, so the prompt is written to refuse rather than to
// fill space — a confident invention about a named rep is worse than a shrug.

import Anthropic from '@anthropic-ai/sdk';
import { getApiKey } from '@/lib/ai-key';
import { toReportDay } from '@/lib/report-date';

// Where the writing actually lives. An after-call record carries callNotes, and
// anything the form asked that the CRM has no column for lands in `extra` — so a
// shop that added "Objection" or "Why no close" to their form still gets read.
var NOTE_FIELDS = ['callNotes', 'notes', 'summary', 'nextStep'];
var MAX_NOTE_CHARS = 800;
var MAX_REPORTS = 300;

function text(v) {
  return String(v === null || v === undefined ? '' : v).trim();
}

function notesOf(report) {
  var parts = [];
  NOTE_FIELDS.forEach(function(f) {
    var v = text(report[f]);
    if (v) parts.push(v);
  });
  // Free text the form collected that the CRM has no column for.
  var extra = report.extra || {};
  Object.keys(extra).forEach(function(k) {
    var v = text(extra[k]);
    if (v && v.length > 12 && parts.indexOf(v) === -1) parts.push(k + ': ' + v);
  });
  var joined = parts.join(' | ');
  return joined.length > MAX_NOTE_CHARS ? joined.slice(0, MAX_NOTE_CHARS) + '…' : joined;
}

// Evenly across the range, not the first 300 — a month sampled from its first
// week describes that week, and the operator would not know.
function sampleEvenly(rows, cap) {
  if (rows.length <= cap) return rows;
  var step = rows.length / cap;
  var out = [];
  for (var i = 0; i < cap; i++) out.push(rows[Math.floor(i * step)]);
  return out;
}

// The cache key. One implementation, shared by the route that writes an analysis
// and the route that shares one, so the two can never disagree about which
// workspace's answer they are holding.
export function analysisKey(workspaceId, scope, from, to) {
  return 'aftercall:' + (workspaceId || 'none') + ':' + (scope || 'all')
    + ':' + (from || 'all') + ':' + (to || 'all');
}

export function buildCorpus(reports, opts) {
  var options = opts || {};
  var all = (reports || []).filter(Boolean);

  var withNotes = [];
  var dropped = 0;
  all.forEach(function(r) {
    // Scoping is done by the caller, which hands us a repIdentity — the one
    // implementation of "whose record is this". Matching the email alone would
    // hand a manager's own name every call they ever filed on a rep's behalf.
    if (options.identity && !options.identity.owns(r, 'closerEmail', 'closer')) return;
    var notes = notesOf(r);
    // A record with no writing on it tells the model nothing and still costs
    // tokens. Dropped, and counted, so the page can say how thin the data was.
    if (!notes) { dropped++; return; }
    withNotes.push({ r: r, notes: notes });
  });

  withNotes.sort(function(a, b) {
    return String(a.r.submittedAt || '').localeCompare(String(b.r.submittedAt || ''));
  });

  var total = withNotes.length;
  var kept = sampleEvenly(withNotes, MAX_REPORTS);

  return {
    total: total,
    dropped: dropped,
    sampled: total > MAX_REPORTS,
    reports: kept.map(function(row, i) {
      var r = row.r;
      return {
        i: i + 1,
        date: toReportDay(r.submittedAt) || '',
        closer: text(r.closer) || 'Unknown',
        setter: text(r.setter),
        program: text(r.program),
        outcome: text(r.outcome),
        notes: row.notes,
      };
    }),
  };
}

// The exact shape the model must return. Declared as a tool's input_schema and
// then forced, so the answer arrives as validated JSON rather than markdown that
// has to be guessed at.
export var ANALYSIS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    callsAnalyzed: { type: 'integer' },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    headline: { type: 'string' },
    objections: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          name: { type: 'string' },
          count: { type: 'integer' },
          pct: { type: 'number' },
          quotes: { type: 'array', items: { type: 'string' } },
          rebuttal: { type: 'string' },
        },
        required: ['name', 'count', 'pct', 'quotes', 'rebuttal'],
      },
    },
    patterns: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          title: { type: 'string' },
          observation: { type: 'string' },
          evidence: { type: 'array', items: { type: 'string' } },
          impact: { type: 'string' },
        },
        required: ['title', 'observation', 'evidence', 'impact'],
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
    upstreamFlags: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          area: { type: 'string', enum: ['marketing', 'lead source', 'offer', 'setter', 'targeting'] },
          issue: { type: 'string' },
          evidence: { type: 'array', items: { type: 'string' } },
          fix: { type: 'string' },
        },
        required: ['area', 'issue', 'evidence', 'fix'],
      },
    },
    topFix: { type: 'string' },
  },
  required: ['callsAnalyzed', 'confidence', 'headline', 'objections', 'patterns', 'repFlags', 'upstreamFlags', 'topFix'],
};

var SYSTEM = [
  'You are Summit Sales AI, a high-ticket sales operations analyst. You are reading',
  'after-call reports written by closers. Your job is to find what is costing the team money.',
  '',
  'Rules:',
  '- Ground every claim in the supplied reports. Quote real fragments. Never invent a quote, a name, or a number.',
  '- An objection counts only when the notes actually describe it. Do not pad the list to look thorough.',
  '- Flag a rep only on a pattern across 3 or more of their calls, never a single bad call. Name the specific',
  '  behavior, not a personality judgment, and give one concrete coaching action.',
  '- Upstream flaws are problems that happened before the call: wrong-fit leads, a promise made in an ad the',
  '  offer does not keep, unqualified bookings, a setter overselling. If the same objection appears on most',
  '  calls, treat it as an upstream problem, not a closing problem.',
  '- If fewer than 5 reports have real notes, set confidence to "low" and say plainly that there is not enough',
  '  data rather than manufacturing findings.',
  '- Write for an operator. Short, specific, no filler, no motivational language.',
].join('\n');

// The model. Overridable per install, defaulting to the same one the rest of the
// CRM's AI runs on rather than a version pinned into the source.
function modelId() {
  return (process.env.SUMMIT_AI_MODEL || '').trim() || 'claude-opus-5';
}

export async function analyzeAfterCalls(corpus, opts) {
  var apiKey = await getApiKey();
  if (!apiKey) {
    return { error: 'AI not configured' };
  }

  var client = (opts && opts.client) || new Anthropic({ apiKey: apiKey });
  var model = modelId();

  var prompt = [
    'Analyse these ' + corpus.reports.length + ' after-call reports and report what they show.',
    corpus.sampled
      ? 'They are an even sample across the range, drawn from ' + corpus.total + ' reports in total.'
      : '',
    corpus.dropped
      ? corpus.dropped + ' further reports were filed with no written notes and are not included.'
      : '',
    '',
    JSON.stringify(corpus.reports),
  ].filter(Boolean).join('\n');

  try {
    var response = await client.messages.create({
      model: model,
      max_tokens: 8000,
      system: SYSTEM,
      tools: [{
        name: 'report_analysis',
        description: 'Return the analysis of these after-call reports.',
        input_schema: ANALYSIS_SCHEMA,
        strict: true,
      }],
      tool_choice: { type: 'tool', name: 'report_analysis' },
      messages: [{ role: 'user', content: prompt }],
    });

    // Read the tool-use block. Never parse markdown or hope for clean JSON in a
    // text block — the whole point of forcing the tool is that this is typed.
    var block = (response.content || []).filter(function(b) {
      return b && b.type === 'tool_use' && b.name === 'report_analysis';
    })[0];
    if (!block || !block.input) {
      return { error: 'The analysis came back in an unexpected shape. Try it again.' };
    }
    return { result: block.input, model: model };
  } catch (e) {
    // Never surface the upstream body or a stack — it can carry request details.
    console.error('[AI analyst]', e && e.message);
    if (e instanceof Anthropic.AuthenticationError) return { error: 'The AI key was rejected. Check it in Settings.' };
    if (e instanceof Anthropic.RateLimitError) return { error: 'Rate limited by the AI provider. Try again shortly.' };
    return { error: 'The analysis could not be completed. Try it again in a moment.' };
  }
}
