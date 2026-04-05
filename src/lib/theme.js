// Theme manager — persists to localStorage, applies 'dark' or 'light' class to <html>

export function getTheme() {
  if (typeof window === 'undefined') return 'dark';
  return localStorage.getItem('summit-theme') || 'dark';
}

export function setTheme(theme) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('summit-theme', theme);
  applyTheme(theme);
}

export function toggleTheme() {
  var current = getTheme();
  var next = current === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
}

export function applyTheme(theme) {
  if (typeof window === 'undefined') return;
  var root = document.documentElement;
  root.classList.remove('dark', 'light');
  root.classList.add(theme || getTheme());
}
