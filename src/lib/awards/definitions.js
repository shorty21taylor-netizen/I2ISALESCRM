// The twenty career milestones, ten a side.
//
// This array is the source of truth. Nothing is seeded into Postgres from a
// separate SQL file, because the schema here is not the one the spec assumed:
// every record table is (id, data JSONB), so an `awards` table of columns would
// be a second, drifting copy of this list. Definitions live in code, grants live
// in the database. That is the only split that cannot fall out of step.
//
// `metric` names a key from lib/awards/metrics.js. When that key comes back null
// the award is DARK — not failed, not zero — and is never granted. Eight of the
// twenty are dark today because the data behind them is not captured yet; they
// light up on their own once it is, with no change here.

export var AWARDS = [
  // ---------- setters ----------
  { id: 'first-set', track: 'setter', name: 'First Set',
    description: 'Book your first qualified appointment.',
    metric: 'qualified_sets', threshold: 1, window: 'lifetime', rarity: 'bronze', icon: 'bolt', sortOrder: 1 },

  { id: 'century-dial', track: 'setter', name: 'Century Dial',
    description: 'Place 100 dials in a single day.',
    metric: 'dials', threshold: 100, window: 'day', rarity: 'bronze', icon: 'phone', sortOrder: 2 },

  { id: 'speed-to-lead', track: 'setter', name: 'Speed to Lead',
    description: 'Reach 25 leads inside five minutes of opt-in.',
    metric: 'contacts_under_5min', threshold: 25, window: 'lifetime', rarity: 'silver', icon: 'clock', sortOrder: 3 },

  { id: 'perfect-week', track: 'setter', name: 'Perfect Week',
    description: 'Hit your daily dial target five days straight.',
    metric: 'target_hit_days', threshold: 5, window: 'streak', rarity: 'silver', icon: 'calendar', sortOrder: 4 },

  { id: 'show-runner', track: 'setter', name: 'Show Runner',
    description: 'Hold a 70% show rate across 20 or more sets in one month.',
    metric: 'show_rate_qualified', threshold: 0.70, window: 'month', rarity: 'silver', icon: 'target', sortOrder: 5 },

  { id: 'the-grind', track: 'setter', name: 'The Grind',
    description: 'One thousand lifetime dials.',
    metric: 'dials', threshold: 1000, window: 'lifetime', rarity: 'silver', icon: 'chart', sortOrder: 6 },

  { id: 'resurrection-set', track: 'setter', name: 'Resurrection',
    description: 'Book a set off a lead that was written off three times.',
    metric: 'revived_sets', threshold: 1, window: 'lifetime', rarity: 'gold', icon: 'flame', sortOrder: 7 },

  { id: 'assist-king', track: 'setter', name: 'Assist King',
    description: 'Ten of your sets turn into closed deals.',
    metric: 'assisted_closes', threshold: 10, window: 'lifetime', rarity: 'gold', icon: 'star', sortOrder: 8 },

  { id: 'clean-sheet', track: 'setter', name: 'Clean Sheet',
    description: 'Thirty days at full CRM logging compliance.',
    metric: 'logging_compliance_days', threshold: 30, window: 'streak', rarity: 'silver', icon: 'shield', sortOrder: 9 },

  { id: 'quota-killer', track: 'setter', name: 'Quota Killer',
    description: 'Hit or beat set quota three months running.',
    metric: 'quota_months', threshold: 3, window: 'streak', rarity: 'gold', icon: 'crown', sortOrder: 10 },

  // ---------- closers ----------
  { id: 'first-blood', track: 'closer', name: 'First Blood',
    description: 'Close your first deal.',
    metric: 'closes', threshold: 1, window: 'lifetime', rarity: 'bronze', icon: 'bolt', sortOrder: 1 },

  { id: 'one-call-close', track: 'closer', name: 'One Call, One Kill',
    description: 'Close on the first call with no follow-up.',
    metric: 'one_call_closes', threshold: 1, window: 'lifetime', rarity: 'silver', icon: 'target', sortOrder: 2 },

  { id: 'hat-trick', track: 'closer', name: 'Hat Trick',
    description: 'Three closes in a single day.',
    metric: 'closes', threshold: 3, window: 'day', rarity: 'silver', icon: 'star', sortOrder: 3 },

  { id: 'perfect-board', track: 'closer', name: 'Perfect Board',
    description: 'Close every appointment on your board in one day. Three minimum.',
    metric: 'perfect_day', threshold: 1, window: 'day', rarity: 'gold', icon: 'calendar', sortOrder: 4 },

  { id: 'full-boat', track: 'closer', name: 'Full Boat',
    description: 'Take a paid-in-full on the flagship or above.',
    metric: 'pif_closes_flagship_plus', threshold: 1, window: 'lifetime', rarity: 'silver', icon: 'coins', sortOrder: 5 },

  { id: 'big-game', track: 'closer', name: 'Big Game',
    description: 'Close the thirty-thousand-dollar offer.',
    metric: 'closes_offer_30k', threshold: 1, window: 'lifetime', rarity: 'gold', icon: 'crown', sortOrder: 6 },

  { id: 'objection-slayer', track: 'closer', name: 'Objection Slayer',
    description: 'Close a call after three or more logged objections.',
    metric: 'closes_objections_3plus', threshold: 1, window: 'lifetime', rarity: 'silver', icon: 'shield', sortOrder: 7 },

  { id: 'fifty-month', track: 'closer', name: 'Fifty Month',
    description: 'Fifty thousand in cash collected inside one calendar month.',
    metric: 'cash_collected', threshold: 50000, window: 'month', rarity: 'gold', icon: 'chart', sortOrder: 8 },

  { id: 'resurrection-close', track: 'closer', name: 'Resurrection',
    description: 'Close a lead that has been sitting sixty days or longer.',
    metric: 'closes_aged_60d', threshold: 1, window: 'lifetime', rarity: 'gold', icon: 'flame', sortOrder: 9 },

  { id: 'rainmaker', track: 'closer', name: 'Rainmaker',
    description: 'Finish number one on the board for a full month.',
    metric: 'board_rank_first_months', threshold: 1, window: 'month', rarity: 'gold', icon: 'trophy', sortOrder: 10 },
];

// The metals, light and dark. One place, so the medal, the card border and the
// unlock bloom can never disagree about what gold is.
export var RARITY = {
  bronze: { light: '#A2612C', dark: '#D08A4A', label: 'Bronze' },
  silver: { light: '#787E85', dark: '#A7AEB6', label: 'Silver' },
  gold:   { light: '#A8821F', dark: '#E0B84A', label: 'Gold' },
};

export function awardsForTrack(track) {
  var want = track === 'setter' ? 'setter' : 'closer';
  return AWARDS.filter(function(a) { return a.track === want; })
    .sort(function(a, b) { return a.sortOrder - b.sortOrder; });
}

export function awardById(id) {
  for (var i = 0; i < AWARDS.length; i++) if (AWARDS[i].id === id) return AWARDS[i];
  return null;
}
