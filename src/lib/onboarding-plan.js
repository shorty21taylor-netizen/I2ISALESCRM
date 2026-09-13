// What a new closer or setter has to get through before the floor is fully open
// to them, and who owns each part of it.
//
// The plan is code, not data, on purpose: it is the company's standard, the same
// for everyone, and it should change by deliberate edit rather than by someone
// quietly deleting a step from a settings screen. What IS per-workspace — the
// Loom walkthroughs, the login details, the offer doc link — attaches to these
// steps by id and is edited in Admin.
//
// Step kinds, because "done" does not mean the same thing for all of them:
//   owner  — the company's job, not the rep's. Ticked by an admin. It appears on
//            the rep's list anyway so they can see whether it was actually done
//            for them, which is the whole point of Phase 0.
//   access — a seat the rep has to prove they can log into.
//   task   — read it, watch it, receive it. The rep ticks it.
//   demo   — the rep does it back live and a manager confirms. "Watched it" is
//            not proof, so a rep can mark themselves ready but cannot pass it.
//   attest — the rep signs a sentence. This is the line that settles arguments
//            about comp and access six months later.

export var PHASES = [
  {
    id: 'pre',
    title: 'Pre-boarding',
    when: 'The week before Day 1',
    blurb:
      'None of this is yours to do. It is here so you can see whether it was done for you — '
      + 'and so nobody can claim it was.',
    steps: [
      {
        id: 'pre-owner',
        kind: 'owner',
        title: 'An onboarding owner named in writing',
        detail: 'One person, by name, accountable for your first thirty days.',
      },
      {
        id: 'pre-agenda',
        kind: 'owner',
        title: 'Start-day agenda sent three days ahead',
        detail: 'What time, what platform, what to have ready.',
      },
      {
        id: 'pre-seats',
        kind: 'owner',
        title: 'Every seat created and tested before Day 1',
        detail: 'Day 1 is a handover, not a setup session. Nothing gets built while you watch a loading screen.',
      },
      {
        id: 'pre-buddy',
        kind: 'owner',
        title: 'A peer buddy assigned',
        detail: 'An existing rep, not your manager, and not the onboarding owner.',
      },
    ],
  },

  {
    id: 'access',
    title: 'Access handover',
    when: 'Day 1',
    blurb:
      'All of it on Day 1, every one confirmed working. Not "I will check tonight" — '
      + 'open each one now, while someone is still on the call with you.',
    steps: [
      { id: 'acc-course', kind: 'access', slot: 'course', title: 'Course / training portal',
        detail: 'Your role-correct track, unlocked.' },
      { id: 'acc-community', kind: 'access', slot: 'community', title: 'Sales community',
        detail: 'Added and introduced, not just invited.' },
      { id: 'acc-whatsapp', kind: 'access', slot: 'whatsapp', title: 'WhatsApp sales channels',
        detail: 'After-call reports, closed deals, and the team channel.' },
      { id: 'acc-payments', kind: 'access', slot: 'payments', title: 'Payment links',
        detail: 'The live links you will actually send — and who to contact the moment one fails mid-call.' },
      { id: 'acc-crm', kind: 'access', slot: 'crm', title: 'CRM',
        detail: 'Scoped to your pipelines and calendars only.' },
      { id: 'acc-dialer', kind: 'access', slot: 'dialer', title: 'Dialer',
        detail: 'Seat assigned, number attached, and a test call placed.' },
      { id: 'acc-recordings', kind: 'access', slot: 'recordings', title: 'Prior call recordings',
        detail: 'The whole library, not three hand-picked wins.' },
      { id: 'acc-summit', kind: 'access', slot: 'summit', title: 'Summit OS',
        detail: 'Seat live, permissions matched to your role.' },
      {
        id: 'acc-confirm',
        kind: 'attest',
        title: 'Confirm every login works',
        detail: 'Before the day ends. No exceptions.',
        statement: 'I have signed into every system above myself and each one works.',
      },
    ],
  },

  {
    id: 'sops',
    title: 'Software SOPs',
    when: 'Day 1',
    blurb:
      'How to actually operate the stack. You watch or read it, then do it back live — '
      + 'a real stage change, a real report, a real dial.',
    steps: [
      { id: 'sop-crm', kind: 'demo', slot: 'crm', title: 'How to run the CRM',
        detail: 'Pipeline stages, dispositions, the notes standard, and what a clean record looks like.',
        demo: 'Move a test contact through a stage change and leave a note to standard.' },
      { id: 'sop-summit', kind: 'demo', slot: 'summit', title: 'How to run Summit OS',
        detail: 'Logging activity, filing after-call reports, pulling your own scoreboard.',
        demo: 'File a test after-call report and pull up your own numbers.' },
      { id: 'sop-dialer', kind: 'demo', slot: 'dialer', title: 'How to run the dialer',
        detail: 'Dialing blocks, recording, logging, and what to do when a call drops.',
        demo: 'Place a test dial, record it, and log it.' },
      { id: 'sop-rules', kind: 'task', title: "Do's and don'ts across the stack",
        detail: 'What you must never touch, never delete, and never edit at the account level.' },
      { id: 'sop-recordings', kind: 'task', slot: 'recordings', title: 'Where recordings live',
        detail: 'And how to pull your own without asking anyone.' },
    ],
  },

  {
    id: 'offer',
    title: 'The offer',
    when: 'Day 1, questions on Day 2',
    blurb: 'The full document on Day 1. Not drip-fed across week two.',
    steps: [
      { id: 'off-doc', kind: 'task', slot: 'offerdoc', title: 'Read the full offer document',
        detail: 'All of it, today.' },
      { id: 'off-pricing', kind: 'task', title: 'Offers, pricing, terms and payment plans',
        detail: 'What is included in each one.' },
      { id: 'off-fit', kind: 'task', title: 'Who each offer is for — and who it is not for',
        detail: 'Knowing who to turn away is worth as much as knowing who to close.' },
      { id: 'off-questions', kind: 'task', title: 'Bring your questions to Day 2',
        detail: 'Write them down as you read. Day 2 exists for exactly this.' },
    ],
  },

  {
    id: 'comp',
    title: 'Comp on paper',
    when: 'Day 1',
    blurb:
      'Walked through live with real numbers — a bad month, an expected month, a good month — '
      + 'so you have seen the actual check before you earn it.',
    steps: [
      { id: 'comp-walk', kind: 'task', slot: 'comp', title: 'The plan walked with real numbers',
        detail: 'Three scenarios modelled out loud: a bad month, an expected month, a good month.' },
      { id: 'comp-edges', kind: 'task', title: 'Draws, clawbacks, AR vs PIF',
        detail: 'And what happens to commission on a refund or a chargeback — before it happens, not after.' },
      { id: 'comp-pay', kind: 'task', title: 'Pay dates and what you must submit to get paid',
        detail: 'The exact reporting. Miss it and the money waits.' },
      {
        id: 'comp-confirm',
        kind: 'attest',
        title: 'Confirm you understand the plan',
        detail: 'One line here settles most comp disputes before they start.',
        statement: 'The comp plan was walked through with me and I understand how I get paid, including clawbacks and refunds.',
      },
    ],
  },

  {
    id: 'ramp',
    title: 'The 30-day ramp',
    when: 'Day 1',
    blurb: 'So you know what "on track" means from hour one rather than from week three.',
    steps: [
      { id: 'ramp-plan', kind: 'task', slot: 'ramp', title: 'Receive the written 30-day ramp plan',
        detail: 'What is expected of you at day 7, day 14 and day 30.' },
    ],
  },
];

// The login slots a workspace fills in. Kept here so Admin and the rep's page
// agree on what exists without either one inventing a key.
export var SLOTS = [
  { id: 'course', label: 'Course / training portal' },
  { id: 'community', label: 'Sales community' },
  { id: 'whatsapp', label: 'WhatsApp channels' },
  { id: 'payments', label: 'Payment links' },
  { id: 'crm', label: 'CRM' },
  { id: 'dialer', label: 'Dialer' },
  { id: 'recordings', label: 'Call recordings' },
  { id: 'summit', label: 'Summit OS' },
  { id: 'offerdoc', label: 'Offer document' },
  { id: 'comp', label: 'Comp plan' },
  { id: 'ramp', label: '30-day ramp plan' },
];

export function allSteps() {
  var out = [];
  PHASES.forEach(function(phase) {
    phase.steps.forEach(function(step) {
      out.push(Object.assign({ phaseId: phase.id, phaseTitle: phase.title }, step));
    });
  });
  return out;
}

// What the rep is actually measured on. The company's own Phase 0 duties are
// tracked but never held against the rep — a missing peer buddy is not their
// failure to fix, and blocking them over it would punish the wrong person.
export function repSteps() {
  return allSteps().filter(function(s) { return s.kind !== 'owner'; });
}

export function stepById(id) {
  var all = allSteps();
  for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
  return null;
}

// A step is only finished when its own bar is met: a demo needs a manager's
// confirmation, an attestation needs the rep's signature, everything else needs
// a tick.
export function stepDone(step, record) {
  if (!record) return false;
  if (step.kind === 'demo') return !!record.verifiedAt;
  if (step.kind === 'attest') return !!record.signedAt;
  return !!record.doneAt;
}

export function progressFor(progress) {
  var steps = repSteps();
  var done = 0;
  steps.forEach(function(s) { if (stepDone(s, (progress || {})[s.id])) done++; });
  return {
    done: done,
    total: steps.length,
    percent: steps.length ? Math.round((done / steps.length) * 100) : 0,
    complete: done >= steps.length,
  };
}
