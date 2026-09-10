// A one-off repair for records whose closerEmail names the wrong person.
//
// The in-app form used to stamp the signed-in user's email onto whatever record
// they were filing, including one filed on a rep's behalf. Reading those records
// is already handled — ownership goes by the name, which is the field somebody
// chose deliberately — but the stored email is still wrong, and anything that
// looks reps up by email later would inherit the same mistake. This puts the
// stored field back in agreement with the name.
import { canonicalRep } from '@/lib/store';

function norm(v) {
  return String(v || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function localName(email) {
  return norm(String(email || '').split('@')[0].replace(/[._-]+/g, ' '));
}

// Which email belongs to this name? Accounts are authoritative because a person
// created them. Closer profiles are a fallback and are themselves suspect — the
// bug being repaired is what wrote some of their names — so a profile only counts
// when it is the single claimant, or when its address plainly matches the name.
export function buildNameIndex(accounts, closerProfiles) {
  var index = {};

  Object.keys(closerProfiles || {}).forEach(function(email) {
    var profile = closerProfiles[email];
    var key = norm(canonicalRep(profile && profile.name) || (profile && profile.name));
    if (!key) return;
    if (!index[key]) index[key] = { emails: [], source: 'profile' };
    index[key].emails.push(email);
  });

  (accounts || []).forEach(function(account) {
    var key = norm(canonicalRep(account.name) || account.name);
    if (!key || !account.email) return;
    index[key] = { emails: [account.email.toLowerCase()], source: 'account' };
  });

  return index;
}

export function emailForName(index, name) {
  var key = norm(canonicalRep(name) || name);
  if (!key) return { email: '', reason: 'no name' };
  var entry = index[key];
  if (!entry || !entry.emails.length) return { email: '', reason: 'no account or profile with that name' };
  if (entry.source === 'account') return { email: entry.emails[0], reason: 'account' };
  if (entry.emails.length === 1) return { email: entry.emails[0], reason: 'only profile with that name' };

  // Several profiles claim the name; take the one whose address says the same.
  var matching = entry.emails.filter(function(email) { return localName(email) === key; });
  if (matching.length === 1) return { email: matching[0], reason: 'address matches the name' };
  return { email: '', reason: entry.emails.length + ' profiles claim that name' };
}

// Decide what one record needs. Returns null when it is already correct.
export function planRecord(record, nameField, emailField, index) {
  var name = record && record[nameField];
  if (!name) return null;                       // nothing to attribute it by
  var current = norm(record[emailField]);
  var resolved = emailForName(index, name);

  if (resolved.email) {
    if (current === norm(resolved.email)) return null;
    return {
      id: record.id,
      name: name,
      from: record[emailField] || '',
      to: resolved.email,
      action: current ? 'reassign' : 'fill',
      why: resolved.reason,
    };
  }

  // No address can be resolved for this name. An email that belongs to somebody
  // else is worse than none: clearing it leaves the record matching by name,
  // which is how it is already being read.
  if (current && localName(current) !== norm(canonicalRep(name) || name)) {
    return {
      id: record.id,
      name: name,
      from: record[emailField] || '',
      to: '',
      action: 'clear',
      why: resolved.reason,
    };
  }
  return null;
}
