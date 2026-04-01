import { clsx } from 'clsx';

export function cn(...inputs) { return clsx(inputs); }

export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

export function formatNumber(num) { return new Intl.NumberFormat('en-US').format(num); }

export function formatPercent(num) { return `${num >= 0 ? '+' : ''}${num.toFixed(1)}%`; }

export function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatTime(isoString) {
  if (!isoString) return '\u2014';
  return new Date(isoString).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export function getInitials(name) { return name.split(' ').map(n => n[0]).join('').toUpperCase(); }

export function getTrendColor(value) {
  if (value > 0) return 'text-crm-positive';
  if (value < 0) return 'text-crm-negative';
  return 'text-crm-muted';
}

export function getScoreColor(score) {
  if (score >= 80) return 'text-crm-positive';
  if (score >= 60) return 'text-crm-warning';
  return 'text-crm-negative';
}

export function getScoreBg(score) {
  if (score >= 80) return 'bg-crm-positive/10 border-crm-positive/20';
  if (score >= 60) return 'bg-crm-warning/10 border-crm-warning/20';
  return 'bg-crm-negative/10 border-crm-negative/20';
}
