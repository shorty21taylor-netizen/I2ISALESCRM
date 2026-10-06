// A GoHighLevel survey submission, turned into a Summit record.
//
// The floor files its reports on three hosted surveys — the closers' End-of-Call
// Report and the setters' Booked Call and End-of-Day Reports. This is the one
// place that knows what their questions are called, so a workflow in GHL can
// point a webhook here and map nothing.
//
// The keys below are the custom-field keys GHL actually sends, taken from the
// published surveys rather than guessed. They arrive in several shapes depending
// on how the workflow is wired — `contact.closers_name`, `closers_name`, or the
// question's label — so every candidate is tried.
//
// Nothing here writes. It returns what to write and lets the route decide, which
// keeps the workspace rule in one place: the route resolves the workspace from
// the location id, and this module never sees one.

import { outcomeKind } from '@/lib/i2i-forms';

function norm(k) {
  return String(k || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Flatten whatever GHL wrapped the answers in. Workflows send
// { customData: {...} }, { contact: {...} }, a flat object, or all three at once.
export function flattenSurvey(raw) {
  var flat = {};
  function put(k, v) {
    var key = norm(k);
    if (!key) return;
    if (flat[key] === undefined || flat[key] === '' || flat[key] === null) flat[key] = v;
  }
  function walk(obj, depth) {
    if (!obj || typeof obj !== 'object' || depth > 3) return;
    Object.keys(obj).forEach(function(k) {
      var v = obj[k];
      if (v && typeof v === 'object' && !Array.isArray(v)) { walk(v, depth + 1); return; }
      put(k, v);
    });
  }
  walk(raw, 0);
  return flat;
}

function pick(flat, names) {
  for (var i = 0; i < names.length; i++) {
    var v = flat[norm(names[i])];
    if (v === 0) return '0';
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) v = v.join(', ');
    v = String(v).trim();
    if (v !== '') return v;
  }
  return '';
}

function has(flat, names) {
  for (var i = 0; i < names.length; i++) {
    if (flat[norm(names[i])] !== undefined) return true;
  }
  return false;
}

// Which of the three reports this is.
//
// An explicit ?type= on the webhook URL always wins — one workflow per survey is
// the setup we document, and a stated answer beats a deduced one. The fallback
// reads the questions that only one of the surveys asks, so a workflow wired
// without the parameter still lands on the right board rather than the default
// one.
export function surveyFormType(flat, requested) {
  var want = String(requested || '').toLowerCase().trim();
  if (want === 'book-call' || want === 'close-deal' || want === 'after-call' || want === 'eod-report') {
    return want;
  }
  if (has(flat, ['call_outcome', 'contact.call_outcome'])) return 'after-call';
  if (has(flat, ['setter_type', 'contact.setter_type'])) return 'eod-report';
  if (has(flat, ['booking_source', 'contact.booking_source', 'lead_temperature'])) return 'book-call';
  return '';
}

var RECORDING_KEYS = [
  'call_recording', 'call_recording_link', 'recording', 'recording_url',
  'recording_link', 'callrecordinglink', 'contact.call_recording',
  'contact.call_recording_link', 'contact.recording_link', 'gong_link', 'fathom_link',
];

export function recordingFrom(flat) {
  return pick(flat, RECORDING_KEYS);
}

// ---- the setters' Booked Call Report ----

export function toBookedCall(flat) {
  return {
    leadsName: pick(flat, ['lead_name', 'prospect_name', 'full_name', 'first_name', 'name', 'contact.name']),
    leadsEmail: pick(flat, ['lead_email', 'prospect_email', 'email', 'contact.email']),
    leadsPhone: pick(flat, ['phone', 'contact.phone']),
    program: pick(flat, ['contact.programservice', 'programservice', 'program_service', 'program']),
    setter: pick(flat, ['contact.setters_name', 'setters_name', 'setter']),
    closer: pick(flat, ['contact.closers_name', 'closers_name', 'assigned_closer', 'closer']),
    bookedDay: pick(flat, ['contact.schedule_date__time', 'schedule_date__time', 'schedule_date', 'booked_day']),
    bookedTime: pick(flat, ['booked_time', 'schedule_time']),
    // Their Booking Source lands where every screen already says "Source".
    outboundInbound: pick(flat, ['contact.booking_source', 'booking_source']),
    // Lead Temperature, under the name the record and the message have always used.
    intentScore: pick(flat, ['contact.lead_temperature', 'lead_temperature']),
    goal: pick(flat, ['contact.main_goal__what_do_they_need_help_with', 'main_goal__what_do_they_need_help_with', 'main_goal']),
    notes: pick(flat, ['contact.important_notes_for_the_closer', 'important_notes_for_the_closer', 'notes']),
    qualified: 'yes',
    formSource: 'ghl-survey',
  };
}

// ---- the closers' End-of-Call Report ----

// Everything the outcome branch asked for, kept together so both records carry
// the same account of the call. None of it needs a column: addAfterCallReport and
// addClosedDeal both pass `extra` through untouched.
function callDetail(flat) {
  return {
    program: pick(flat, ['contact.programservice', 'programservice', 'program']),
    programDuration: pick(flat, ['contact.program_duration', 'program_duration']),
    paymentPlatform: pick(flat, ['contact.payment_platform_used', 'payment_platform_used']),
    prospectPaidThemselves: pick(flat, ['contact.did_the_prospect_use_their_own_payment_methodcard', 'did_the_prospect_use_their_own_payment_methodcard']),
    payerName: pick(flat, ['contact.name_of_person_who_paid__cardholder_name', 'name_of_person_who_paid__cardholder_name']),
    payerEmail: pick(flat, ['contact.email_of_person_who_paid__cardholder', 'email_of_person_who_paid__cardholder']),
    paymentType: pick(flat, ['contact.payment_type', 'payment_type']),
    paymentStructure: pick(flat, ['contact.payment_structure', 'payment_structure']),
    paymentFrequency: pick(flat, ['contact.payment_frequency', 'payment_frequency']),
    nextPaymentDate: pick(flat, ['contact.next_payment_date', 'next_payment_date']),
    nextPaymentAmount: pick(flat, ['contact.next_payment_amount', 'next_payment_amount']),
    remainingPayments: pick(flat, ['contact.number_of_remaining_payments', 'number_of_remaining_payments']),
    followUpReason: pick(flat, ['contact.reason_for_followup', 'reason_for_followup']),
    followUpDate: pick(flat, ['contact.followup_date', 'followup_date']),
    lostReason: pick(flat, ['contact.reason_lost', 'reason_lost']),
    totalDealValue: pick(flat, ['contact.total_deal_value', 'total_deal_value']),
  };
}

export function toAfterCall(flat) {
  var detail = callDetail(flat);
  var outcome = pick(flat, ['contact.call_outcome', 'call_outcome', 'outcome']);
  return {
    leadsName: pick(flat, ['prospect_name', 'lead_name', 'full_name', 'name', 'contact.name']),
    leadsEmail: pick(flat, ['prospect_email', 'lead_email', 'email', 'contact.email']),
    leadsPhone: pick(flat, ['phone', 'contact.phone']),
    closer: pick(flat, ['contact.closers_name', 'closers_name', 'closer']),
    outcome: outcome,
    nextStep: detail.followUpReason || '',
    callNotes: pick(flat, ['contact.additional_notes', 'additional_notes', 'notes']),
    extra: detail,
    formSource: 'ghl-survey',
  };
}

// The money, and only when the outcome says there is money. Built from the same
// answers as the report above so the two can never disagree about the call.
export function toClosedDeal(flat) {
  var detail = callDetail(flat);
  var cash = pick(flat, ['contact.cash_collected', 'cash_collected']);
  return {
    leadsName: pick(flat, ['prospect_name', 'lead_name', 'full_name', 'name', 'contact.name']),
    leadsEmail: pick(flat, ['prospect_email', 'lead_email', 'email', 'contact.email']),
    leadsPhone: pick(flat, ['phone', 'contact.phone']),
    program: detail.program,
    // Cash collected is what landed; the deal value is kept beside it. An empty
    // cash box means the whole deal value was taken, which is how their form reads.
    cashCollected: cash || detail.totalDealValue,
    paymentProcessor: detail.paymentPlatform,
    paymentAgreement: detail.paymentType,
    paymentDetails: detail.paymentStructure,
    closer: pick(flat, ['contact.closers_name', 'closers_name', 'closer']),
    setter: pick(flat, ['contact.setters_name', 'setters_name', 'setter']),
    notes: pick(flat, ['contact.additional_notes', 'additional_notes', 'notes']),
    extra: detail,
    formSource: 'ghl-survey',
  };
}

export function closedOnThisCall(flat) {
  return outcomeKind(pick(flat, ['contact.call_outcome', 'call_outcome', 'outcome'])) === 'closed';
}

// ---- the setters' End-of-Day ----

// Their form branches on Setter Type, and so does this: a phone day and an inbox
// day are different reports. The position is stated on the record rather than
// inferred, because eodRole() reads it to decide which board the day lands on —
// and a phone setter's report must carry none of the closer call figures, or
// evidence-of-closing would outrank the label and file it wrongly.
export function toEod(flat) {
  var type = pick(flat, ['contact.setter_type', 'setter_type']);
  var dm = String(type).toLowerCase().indexOf('dm') !== -1;
  var base = {
    salesRep: pick(flat, ['contact.setters_name', 'setters_name', 'setter', 'sales_rep']),
    closerEmail: '',
    date: pick(flat, ['contact.date_today', 'date_today', 'date']),
    improvementPlan: pick(flat, ['contact.any_important_notes__issues_from_today', 'any_important_notes__issues_from_today', 'notes']),
    netNewCallsBooked: pick(flat, ['contact.total_calls_booked', 'total_calls_booked']),
    formSource: 'ghl-survey',
  };

  if (dm) {
    return Object.assign(base, {
      position: 'DM Setter', role: 'dm-setter',
      newLeads: pick(flat, ['contact.total_new_dms__conversations_started', 'total_new_dms__conversations_started']),
      conversations: pick(flat, ['contact.total_replies__conversations_had', 'total_replies__conversations_had']),
      followUpsScheduled: pick(flat, ['contact.total_followups_sent', 'total_followups_sent']),
      commonThemes: base.improvementPlan,
      extra: {
        mainObjections: pick(flat, ['contact.main_objection_heard_today', 'main_objection_heard_today']),
      },
    });
  }

  return Object.assign(base, {
    position: 'Setter', role: 'setter',
    outboundDials: pick(flat, ['contact.total_calls_made', 'total_calls_made']),
    conversations: pick(flat, ['contact.total_people_reached__conversations_had', 'total_people_reached__conversations_had']),
    followUpsScheduled: pick(flat, ['contact.total_followups_made', 'total_followups_made']),
    sets: pick(flat, ['contact.total_calls_booked', 'total_calls_booked']),
    extra: {
      leadSourceWorked: pick(flat, ['contact.lead_source__list_worked', 'lead_source__list_worked']),
      mainObjection: pick(flat, ['contact.main_objection__reason_people_didnt_book', 'main_objection__reason_people_didnt_book']),
    },
  });
}
