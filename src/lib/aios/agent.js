// The Summit AIOS turn: a bounded tool loop over the fixed catalogue.
//
// The model is handed a list of tool names and typed parameters. It never sees a
// table, a column, or a connection string, and nothing it produces is ever
// concatenated into a query — the handlers read the same store the dashboards
// read. The loop is capped at eight tool calls so a confused turn costs a few
// seconds rather than a bill.
import Anthropic from '@anthropic-ai/sdk';
import { TOOLS, validateCall } from '@/lib/aios/tools';
import { runTool } from '@/lib/aios/handlers';
import { RANGE_LABELS } from '@/lib/aios/range';
import { todayInReportTimezone, REPORT_TIMEZONE } from '@/lib/report-date';
import { getApiKey } from '@/lib/ai-key';

export var MAX_TOOL_CALLS = 8;

function systemPrompt(ctx) {
  var lines = [
    'You are Summit AIOS, the assistant built into Summit OS — the CRM a high-ticket sales floor runs on.',
    'You answer questions about this floor\'s own numbers by calling the tools you have been given.',
    '',
    'Today is ' + todayInReportTimezone() + '. The team sells in ' + REPORT_TIMEZONE + ' and every day',
    'bucket you are shown is a Pacific day, so "today" means the Pacific day, not UTC.',
    '',
    'How to answer:',
    '- Call a tool before quoting any figure. You have no numbers of your own and you must never estimate,',
    '  extrapolate, or carry a number over from an earlier answer without checking it again.',
    '- A null rate means it was not measurable — usually because the field it divides by is not being',
    '  filled in. Say so. Never report a null as zero.',
    '- Tool results carry a "caveats" list when the underlying data is patchy. If a caveat undermines the',
    '  number you are about to quote, say it in the same breath as the number.',
    '- Cash always follows the deal forms, which are deduplicated: a close filed by both the setter and the',
    '  closer is one deal.',
    '- Disqualifications are not captured on any form. If asked, say the CRM does not collect them rather',
    '  than reaching for a number that looks close.',
    '- Be short and direct. These are the numbers of the people reading you. Lead with the answer, then the',
    '  one thing worth doing about it. No preamble, no restating the question.',
    '- Format figures the way the floor says them: $12,400, 68% show rate, 31 calls.',
    '',
    'Date ranges you can ask for: ' + Object.keys(RANGE_LABELS).map(function(k) {
      return k + ' (' + RANGE_LABELS[k] + ')';
    }).join(', ') + '. Use custom only when the question names specific dates.',
    '',
  ];

  if (ctx.canSeeTeam) {
    lines.push('The person asking is ' + (ctx.selfName || ctx.access.email) + ', a '
      + (ctx.access.isOperator ? 'operator' : 'manager') + '. They can see the whole floor, every rep by name.');
  } else {
    lines.push('The person asking is ' + (ctx.selfName || ctx.access.email) + ', a rep. They can see their own');
    lines.push('numbers and team-level totals, but not another named person\'s cash, commission, or deal list.');
    lines.push('The tools enforce this, so a refusal will come back as a "denied" field rather than data.');
    lines.push('When that happens, tell them plainly what they can and cannot see. Do not apologise at length,');
    lines.push('and do not try a different tool to get at the same thing another way.');
  }

  return lines.join('\n');
}

function textOf(response) {
  var out = '';
  for (var i = 0; i < response.content.length; i++) {
    if (response.content[i].type === 'text') out += response.content[i].text;
  }
  return out.trim();
}

// The SDK hands back a parsed object; a string here would mean something went
// wrong upstream, and parsing it is safer than matching on it.
function inputOf(block) {
  if (block.input && typeof block.input === 'object') return block.input;
  if (typeof block.input === 'string') {
    try { return JSON.parse(block.input); } catch (e) { return {}; }
  }
  return {};
}

// history: prior turns as [{ role, text }]. Tool traffic is not replayed — the
// figures would be stale by the next question, and the model must look them up
// again rather than trusting its own transcript.
// `deps.client` exists so the loop itself can be exercised without buying tokens;
// in every real call it is absent and the SDK client below is used.
export async function askAios(ctx, question, history, deps) {
  var apiKey = (deps && deps.client) ? '' : await getApiKey();
  if (!(deps && deps.client) && !apiKey) {
    return {
      error: ctx.canSeeTeam
        ? 'Summit AIOS needs an Anthropic API key before it can answer. Add one in '
          + 'Settings → Summit AIOS and this tab starts working immediately.'
        : 'Summit AIOS is not switched on yet. Ask your operator to add an Anthropic key in Settings.',
      status: 503,
    };
  }

  var client = (deps && deps.client) || new Anthropic({ apiKey: apiKey });
  var messages = [];
  (history || []).slice(-10).forEach(function(m) {
    if (!m || !m.text) return;
    messages.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.text });
  });
  messages.push({ role: 'user', content: question });

  var trace = [];
  var calls = 0;

  for (var turn = 0; turn < MAX_TOOL_CALLS + 1; turn++) {
    var response;
    try {
      response = await client.beta.messages.create({
        model: 'claude-opus-5',
        max_tokens: 8000,
        betas: ['server-side-fallback-2026-06-01'],
        fallbacks: [{ model: 'claude-opus-4-8' }],
        thinking: { type: 'adaptive' },
        output_config: { effort: 'medium' },
        system: systemPrompt(ctx),
        tools: TOOLS,
        messages: messages,
      });
    } catch (err) {
      console.error('[AIOS] model call failed:', err && err.message);
      return { error: 'Summit AIOS could not reach the model just now. Try that again in a moment.', status: 502 };
    }

    if (response.stop_reason === 'refusal') {
      return { text: 'I can’t answer that one.', trace: trace };
    }

    if (response.stop_reason !== 'tool_use') {
      return { text: textOf(response) || 'I could not find an answer to that in the CRM.', trace: trace };
    }

    messages.push({ role: 'assistant', content: response.content });

    // Every tool result for this turn goes back in ONE user message, in the same
    // order the model asked for them.
    var results = [];
    for (var i = 0; i < response.content.length; i++) {
      var block = response.content[i];
      if (block.type !== 'tool_use') continue;

      if (calls >= MAX_TOOL_CALLS) {
        results.push({
          type: 'tool_result', tool_use_id: block.id, is_error: true,
          content: 'Look-up budget for this question is spent. Answer from what you already have, and say '
            + 'which part you could not check.',
        });
        continue;
      }
      calls++;

      var raw = inputOf(block);
      var checked = validateCall(block.name, raw);
      if (!checked.ok) {
        trace.push({ tool: block.name, ok: false, note: checked.error });
        results.push({ type: 'tool_result', tool_use_id: block.id, is_error: true, content: checked.error });
        continue;
      }

      var payload;
      try {
        payload = await runTool(ctx, block.name, checked.input);
      } catch (e) {
        console.error('[AIOS] tool', block.name, 'failed:', e && e.message);
        trace.push({ tool: block.name, ok: false, note: 'failed' });
        results.push({
          type: 'tool_result', tool_use_id: block.id, is_error: true,
          content: 'That look-up failed. Do not retry it; answer without it and say what is missing.',
        });
        continue;
      }

      trace.push({ tool: block.name, ok: !payload.denied, input: checked.input });
      results.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(payload) });
    }

    messages.push({ role: 'user', content: results });
  }

  return {
    text: 'That took more look-ups than one question is allowed. Try asking it in narrower pieces.',
    trace: trace,
  };
}
