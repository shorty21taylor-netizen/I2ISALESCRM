// The written half of the sales report: two to three paragraphs on what is
// working and what is not. When ANTHROPIC_API_KEY is set the summary is written
// by Claude from the same numbers the report shows; without a key the CRM writes
// it from rules, so the report is never blank and never waits on a network call.
import Anthropic from '@anthropic-ai/sdk';

function pctText(v) {
  return v === null || v === undefined ? 'not measurable' : v + '%';
}

function money(v) {
  return '$' + Math.round(v || 0).toLocaleString('en-US');
}

// The summary is prose, so the dates in it read as prose too.
function prettyDay(day) {
  if (!day) return day;
  var d = new Date(day + 'T12:00:00');
  if (isNaN(d.getTime())) return day;
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function pluralize(count, one, many) {
  return count === 1 ? one : (many || one + 's');
}

// The handful of observations a sales manager would actually act on, ranked so
// the biggest leak in the funnel comes first.
export function findSignals(m) {
  var strengths = [];
  var problems = [];
  var r = m.rates;
  var v = m.volume;

  if (r.closeRateOfOffers !== null) {
    if (r.closeRateOfOffers >= 30) {
      strengths.push({
        key: 'close-rate',
        text: 'closers are converting ' + pctText(r.closeRateOfOffers) + ' of the offers they make',
      });
    } else if (r.closeRateOfOffers < 18) {
      problems.push({
        key: 'close-rate',
        weight: 100,
        text: 'only ' + pctText(r.closeRateOfOffers) + ' of offers are closing, so ' +
          v.offeredNoClose + ' ' + pluralize(v.offeredNoClose, 'prospect') +
          ' heard the pitch and walked',
      });
    }
  }

  if (r.showRate !== null) {
    if (r.showRate >= 75) {
      strengths.push({ key: 'show-rate', text: 'the calendar is holding at a ' + pctText(r.showRate) + ' show rate' });
    } else if (r.showRate < 60) {
      problems.push({
        key: 'show-rate',
        weight: 90,
        text: 'the show rate is ' + pctText(r.showRate) + ' — ' + v.noShowed +
          ' booked ' + pluralize(v.noShowed, 'call') + ' never happened',
      });
    }
  }

  if (r.pitchRate !== null && r.pitchRate < 70 && v.showedNotPitched > 0) {
    problems.push({
      key: 'pitch-rate',
      weight: 80,
      text: v.showedNotPitched + ' ' + pluralize(v.showedNotPitched, 'call') +
        ' were taken without an offer being made (' + pctText(r.pitchRate) + ' pitch rate)',
    });
  }

  if (r.cancelRate !== null && r.cancelRate >= 15) {
    problems.push({
      key: 'cancel-rate',
      weight: 60,
      text: pctText(r.cancelRate) + ' of booked calls were cancelled outright',
    });
  }

  if (r.dialToSet !== null && v.dials > 0) {
    if (r.dialToSet >= 4) {
      strengths.push({ key: 'dial-to-set', text: 'setters are booking a call every ' + Math.round(100 / r.dialToSet) + ' dials' });
    } else if (r.dialToSet < 1.5) {
      problems.push({
        key: 'dial-to-set',
        weight: 70,
        text: 'it is taking roughly ' + Math.round(100 / Math.max(r.dialToSet, 0.01)) +
          ' dials to book one call',
      });
    }
  }

  if (m.cash.collected > 0 && m.cash.perOffer > 0) {
    strengths.push({ key: 'cash-per-offer', text: 'every offer made is worth ' + money(m.cash.perOffer) + ' on average' });
  }

  if (m.cash.duplicatesRemoved > 0) {
    problems.push({
      key: 'duplicates',
      weight: 40,
      text: m.cash.duplicatesRemoved + ' duplicate ' + pluralize(m.cash.duplicatesRemoved, 'deal') +
        ' worth ' + money(m.cash.duplicateCash) + ' were filed twice and merged',
    });
  }

  if (m.reporting.eodsFiled === 0) {
    problems.push({ key: 'no-eods', weight: 120, text: 'no EOD reports were filed in this range, so the activity numbers are blind' });
  }

  problems.sort(function(a, b) { return b.weight - a.weight; });
  return { strengths: strengths, problems: problems };
}

function topRep(rows, field) {
  if (!rows || !rows.length) return null;
  var best = rows[0];
  for (var i = 1; i < rows.length; i++) {
    if ((rows[i][field] || 0) > (best[field] || 0)) best = rows[i];
  }
  return (best[field] || 0) > 0 ? best : null;
}

export function deterministicNarrative(m) {
  var sig = findSignals(m);
  var v = m.volume;
  var r = m.rates;
  var paras = [];

  var headline = 'Between ' + prettyDay(m.range.start) + ' and ' + prettyDay(m.range.end) + ' the team collected ' +
    money(m.cash.collected) + ' across ' + m.cash.dealCount + ' ' + pluralize(m.cash.dealCount, 'deal') +
    ', at an average of ' + money(m.cash.avgDeal) + ' per deal. That came off ' +
    v.dials.toLocaleString('en-US') + ' outbound ' + pluralize(v.dials, 'dial') + ', ' +
    v.sets + ' ' + pluralize(v.sets, 'call') + ' booked, ' + v.taken + ' held and ' +
    v.pitched + ' ' + pluralize(v.pitched, 'offer') + ' made, closing ' + v.closes + '. ' +
    m.range.repsReporting + ' ' + pluralize(m.range.repsReporting, 'rep') + ' reported across ' +
    m.range.daysReported + ' ' + pluralize(m.range.daysReported, 'day') + '.';
  paras.push(headline);

  var good = 'What is working: ';
  if (sig.strengths.length) {
    good += sig.strengths.slice(0, 3).map(function(s) { return s.text; }).join('; ') + '. ';
  } else {
    good += 'nothing in this range clears the bar the team normally holds, so treat every stage below as open. ';
  }
  var bestCloser = topRep(m.groups.closers, 'cash');
  if (bestCloser) {
    good += bestCloser.name + ' led the closers with ' + money(bestCloser.cash) + ' on ' +
      bestCloser.closes + ' ' + pluralize(bestCloser.closes, 'close') +
      (bestCloser.closeRate !== null ? ' at a ' + pctText(bestCloser.closeRate) + ' close rate' : '') + '. ';
  }
  var bestSetter = topRep(m.groups.setters, 'sets');
  if (bestSetter) {
    good += bestSetter.name + ' set the most calls at ' + bestSetter.sets + '. ';
  }
  var bestDm = topRep(m.groups.dmSetters, 'sets');
  if (bestDm) {
    good += 'On DMs, ' + bestDm.name + ' booked ' + bestDm.sets + '. ';
  }
  paras.push(good.trim());

  var bad = 'What is not working: ';
  if (sig.problems.length) {
    bad += sig.problems.slice(0, 3).map(function(p) { return p.text; }).join('; ') + '. ';
    var first = sig.problems[0];
    if (first.key === 'close-rate') {
      bad += 'The leak is on the call itself, not in front of it — the pipeline is delivering offers and they are not converting, so call reviews and objection handling are where the next point of margin is.';
    } else if (first.key === 'show-rate' || first.key === 'cancel-rate') {
      bad += 'The leak is between booking and the call — confirmation cadence and reminder sequences will recover more revenue here than any change to the pitch.';
    } else if (first.key === 'pitch-rate') {
      bad += 'Calls are being taken without an offer being made, which means qualification or call control is breaking down before the pitch.';
    } else if (first.key === 'dial-to-set') {
      bad += 'The leak is at the top — list quality and opener are costing more dials per booked call than the funnel can carry.';
    } else {
      bad += 'Fix reporting hygiene first; the rest of the numbers cannot be trusted until every rep is filing.';
    }
  } else {
    bad += 'no stage of the funnel is outside its normal band in this range. The constraint is volume, not conversion — the same rates applied to more dials is the fastest path to more cash.';
  }
  paras.push(bad.trim());

  return paras.join('\n\n');
}

// A compact fact sheet, so the model summarizes the report rather than inventing one.
function factSheet(m) {
  return {
    range: m.range,
    volume: m.volume,
    rates: m.rates,
    cash: m.cash,
    source: m.source,
    reporting: {
      eodsFiled: m.reporting.eodsFiled,
      afterCallsFiled: m.reporting.afterCallsFiled,
      afterCallOutcomes: m.reporting.afterCallOutcomes,
      bookedForms: m.reporting.bookedForms,
    },
    programs: m.programs.slice(0, 6),
    closers: m.groups.closers.slice(0, 10),
    setters: m.groups.setters.slice(0, 10),
    dmSetters: m.groups.dmSetters.slice(0, 10),
  };
}

var SYSTEM = [
  'You are the sales operations analyst for Summit Closing Group, a high-ticket',
  'sales team. You are writing the closing summary of an internal performance',
  'report that the numbers above it already state in full.',
  '',
  'Write two to three paragraphs of plain prose. No headings, no bullet points,',
  'no markdown. The first paragraph says what the period did. The second says what',
  'is working and names the reps carrying it. The third says what is not working',
  'and where in the funnel the money is leaking, and it ends with the single',
  'change that would recover the most revenue.',
  '',
  'Use only the figures given. Never invent a number, a name, or a comparison to',
  'a prior period that is not in the data. If a rate is null it was not measurable',
  '— say so rather than treating it as zero. Be direct: this is read by the people',
  'whose numbers these are.',
].join('\n');

export async function generateNarrative(metrics) {
  var fallback = deterministicNarrative(metrics);
  if (!process.env.ANTHROPIC_API_KEY) {
    return { text: fallback, source: 'computed' };
  }

  try {
    var client = new Anthropic();
    var response = await client.beta.messages.create({
      model: 'claude-opus-5',
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-06-01'],
      fallbacks: [{ model: 'claude-opus-4-8' }],
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium' },
      system: SYSTEM,
      messages: [{
        role: 'user',
        content: 'Here is the report data as JSON. Write the closing summary.\n\n' +
          JSON.stringify(factSheet(metrics)),
      }],
    });

    if (response.stop_reason === 'refusal') return { text: fallback, source: 'computed' };

    var text = '';
    for (var i = 0; i < response.content.length; i++) {
      if (response.content[i].type === 'text') text += response.content[i].text;
    }
    text = text.trim();
    return text ? { text: text, source: 'claude' } : { text: fallback, source: 'computed' };
  } catch (err) {
    // A report that renders with a computed summary beats a report that 500s.
    console.error('[report-narrative] falling back to the computed summary:', err && err.message);
    return { text: fallback, source: 'computed' };
  }
}
