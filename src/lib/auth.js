var USER_KEY = 'summit-crm-user';
var VERIFIED_KEY = 'summit-crm-verified';

export function getUser() {
  if (typeof window === 'undefined') return null;
  try { var s = localStorage.getItem(USER_KEY); return s ? JSON.parse(s) : null; } catch(e) { return null; }
}

export function saveUser(user) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function isVerified() {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(VERIFIED_KEY) === 'true';
}

export function setVerified(v) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(VERIFIED_KEY, v ? 'true' : 'false');
}

export function isLoggedIn() {
  return getUser() !== null && isVerified();
}

export function logout() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(VERIFIED_KEY);
}
