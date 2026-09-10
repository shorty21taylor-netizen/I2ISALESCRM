// One seam for "which of these records is this caller allowed to see".
//
// Senior roles see the whole workspace. Everyone else is a rep: they see their own
// records and nothing else. Ownership is decided by the same identity rules the
// rep dashboard uses, so a rep's Closed Deals list and their My Dashboard totals
// can never disagree about which deals are theirs.
import { repOnlyFilter } from '@/lib/access';
import { getCloserProfile } from '@/lib/store';
import { repIdentity } from '@/lib/rep-stats';

// Returns null when the caller may see everything in their workspace.
export async function repScope(req) {
  var email = await repOnlyFilter(req);
  if (!email) return null;
  var identity = repIdentity(getCloserProfile(email), email);
  return {
    email: email,
    name: identity.name,
    // A record is theirs if its email or its name says so.
    owns: function(record, emailField, nameField) {
      return identity.owns(record, emailField, nameField);
    },
    filter: function(list, emailField, nameField) {
      return (list || []).filter(function(r) { return identity.owns(r, emailField, nameField); });
    },
  };
}

// The field pairs each record type carries, so callers do not have to remember.
export var FIELDS = {
  deal: ['closerEmail', 'closer'],
  eod: ['closerEmail', 'salesRep'],
  booked: ['closerEmail', 'setter'],
  afterCall: ['closerEmail', 'closer'],
};

// Convenience: scope a list of one known record type.
export function scopeList(scope, list, kind) {
  if (!scope) return list || [];
  var f = FIELDS[kind] || FIELDS.deal;
  return scope.filter(list, f[0], f[1]);
}
