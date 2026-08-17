// Workspaces = separate companies/tenants. Every record (booked call, deal, EOD,
// closer profile, commission rate) belongs to exactly one workspace.
//
// Legacy records written before workspaces existed carry no workspaceId. Those are
// resolved by their program name via the offer map below, so historical data lands
// in the right company without a destructive migration.

export var ALL_WORKSPACES = '__all__';

// Seed tenants. Users can add more at runtime; these two always exist so existing
// data has somewhere to live.
export var DEFAULT_WORKSPACES = [
  {
    id: 'i2i',
    name: 'Invest2Impact',
    shortName: 'I2I',
    commissionRate: 0.10,
    eodCashField: 'cashCollectedI2I',
    offers: [
      'DFY Funding',
      'Coaching Digital Offer',
      'Coaching Funding Offer',
      'Inner Circle Mentorship',
    ],
    builtIn: true,
  },
  {
    id: 'myfm',
    name: 'Make Your First Million',
    shortName: 'MYFM',
    commissionRate: 0.075,
    eodCashField: 'cashCollectedMYFM',
    offers: ['MYFM Coaching Offer'],
    builtIn: true,
  },
];

// Program aliases that have accumulated over time, normalized to a canonical offer.
var PROGRAM_ALIASES = {
  'dfy funding': 'DFY Funding',
  'dfy-funding': 'DFY Funding',
  'inner circle mentorship': 'Inner Circle Mentorship',
  'inner circle': 'Inner Circle Mentorship',
  'dfy funding (inner circle)': 'Inner Circle Mentorship',
  'coaching digital offer': 'Coaching Digital Offer',
  'coaching': 'Coaching Digital Offer',
  'coaching (digital programs)': 'Coaching Digital Offer',
  'digital programs': 'Coaching Digital Offer',
  'coaching funding offer': 'Coaching Funding Offer',
  'myfm coaching offer': 'MYFM Coaching Offer',
  'myfm': 'MYFM Coaching Offer',
  'saas': 'MYFM Coaching Offer',
  'fund2grow': 'MYFM Coaching Offer',
  'saas (fund2grow)': 'MYFM Coaching Offer',
};

export function canonicalOffer(program) {
  var p = (program || '').toLowerCase().trim();
  if (!p) return '';
  return PROGRAM_ALIASES[p] || (program || '').trim();
}

// Which workspace does this program belong to? Returns null when nothing matches.
export function workspaceIdForProgram(program, workspaces) {
  var offer = canonicalOffer(program);
  if (!offer) return null;
  var list = workspaces || DEFAULT_WORKSPACES;
  for (var i = 0; i < list.length; i++) {
    var ws = list[i];
    var offers = ws.offers || [];
    for (var j = 0; j < offers.length; j++) {
      if (canonicalOffer(offers[j]).toLowerCase() === offer.toLowerCase()) return ws.id;
    }
  }
  return null;
}

// Resolve a record's workspace: explicit stamp first, then program-derived, then
// the fallback workspace (first in the list) so nothing silently disappears.
export function resolveWorkspaceId(record, workspaces) {
  if (!record) return null;
  if (record.workspaceId) return record.workspaceId;
  var list = workspaces || DEFAULT_WORKSPACES;
  var byProgram = workspaceIdForProgram(record.program, list);
  if (byProgram) return byProgram;
  return list.length ? list[0].id : null;
}

// Does a record belong to the requested workspace? ALL_WORKSPACES matches everything.
export function recordInWorkspace(record, workspaceId, workspaces) {
  if (!workspaceId || workspaceId === ALL_WORKSPACES) return true;
  return resolveWorkspaceId(record, workspaces) === workspaceId;
}

export function findWorkspace(workspaces, id) {
  var list = workspaces || DEFAULT_WORKSPACES;
  for (var i = 0; i < list.length; i++) {
    if (list[i].id === id) return list[i];
  }
  return null;
}

// Every offer across every workspace, tagged with its owning company.
export function allOffers(workspaces) {
  var list = workspaces || DEFAULT_WORKSPACES;
  var out = [];
  list.forEach(function(ws) {
    (ws.offers || []).forEach(function(offer) {
      out.push({
        offer: offer,
        key: ws.id + '::' + offer,
        workspaceId: ws.id,
        workspaceName: ws.name,
        workspaceShortName: ws.shortName || ws.name,
      });
    });
  });
  return out;
}

// Greyscale ramp — keeps per-offer charts readable without reintroducing color.
var GREY_RAMP = ['#fafafa', '#d4d4d4', '#a3a3a3', '#8a8a8a', '#6b6b6b', '#525252', '#404040'];

export function offerColor(index) {
  return GREY_RAMP[index % GREY_RAMP.length];
}

export function slugifyWorkspaceId(name) {
  var base = (name || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return base || ('workspace-' + Math.random().toString(36).substring(2, 7));
}
