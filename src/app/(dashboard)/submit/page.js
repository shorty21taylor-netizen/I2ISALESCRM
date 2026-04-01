'use client';
import { useState, useEffect, useCallback } from 'react';
import { Phone, DollarSign, ClipboardCheck, X, Clock, Settings as SettingsIcon, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { getFormConfig } from '@/lib/form-config';

const SUBMISSIONS_KEY = 'summit-crm-submissions';

const sampleSubmissions = [
  { id: 's1', type: 'close-deal', closerName: 'Marcus Johnson', detail: 'Sarah Mitchell \u2014 $5,500', submittedAt: '2026-03-31T18:30:00Z' },
  { id: 's2', type: 'book-call', closerName: 'Aisha Williams', detail: 'James Taylor \u2014 Apr 2, 2:00 PM', submittedAt: '2026-03-31T16:45:00Z' },
  { id: 's3', type: 'eod-report', closerName: 'Marcus Johnson', detail: '34 dials, 2 closes, $8,500', submittedAt: '2026-03-31T18:12:00Z' },
  { id: 's4', type: 'book-call', closerName: 'Jordan Rivera', detail: 'Kevin Wright \u2014 Apr 1, 1:00 PM', submittedAt: '2026-03-31T14:20:00Z' },
  { id: 's5', type: 'close-deal', closerName: 'Tanya Brooks', detail: 'David Kim \u2014 $3,750', submittedAt: '2026-03-31T16:05:00Z' },
  { id: 's6', type: 'eod-report', closerName: 'Aisha Williams', detail: '38 dials, 1 close, $3,800', submittedAt: '2026-03-31T18:45:00Z' },
];

const formCards = [
  {
    id: 'book-call',
    configKey: 'bookCallFormUrl',
    title: 'Book a call',
    description: 'Log a new booked sales call with lead details, source, and scheduled time.',
    notification: 'Sends notification to team WhatsApp',
    notificationDot: 'bg-crm-positive',
    icon: Phone,
    iconBg: 'bg-crm-accent/10 border border-crm-accent/20',
    iconColor: 'text-crm-accent',
    btnClass: 'bg-crm-accent/10 text-crm-accent border border-crm-accent/20 hover:bg-crm-accent/20',
  },
  {
    id: 'close-deal',
    configKey: 'closeDealFormUrl',
    title: 'Close a deal',
    description: 'Record a closed deal with revenue amount, payment method, and Fathom recording link.',
    notification: 'Sends celebration to team WhatsApp',
    notificationDot: 'bg-crm-positive',
    icon: DollarSign,
    iconBg: 'bg-crm-positive/10 border border-crm-positive/20',
    iconColor: 'text-crm-positive',
    btnClass: 'bg-crm-positive/10 text-crm-positive border border-crm-positive/20 hover:bg-crm-positive/20',
  },
  {
    id: 'eod-report',
    configKey: 'eodReportFormUrl',
    title: 'End-of-day report',
    description: 'Submit your daily numbers \u2014 dials, connects, closes, cash collected, pipeline notes, and confidence score.',
    notification: 'Data sent to CRM only',
    notificationDot: 'bg-crm-muted',
    icon: ClipboardCheck,
    iconBg: 'bg-white/5 border border-crm-border',
    iconColor: 'text-crm-muted',
    btnClass: 'bg-white/5 text-crm-text border border-crm-border hover:bg-white/[0.08]',
  },
];

const overlayTitles = {
  'book-call': 'Book a call',
  'close-deal': 'Close a deal',
  'eod-report': 'End-of-day report',
};

const typeBadge = {
  'book-call': { label: 'Booked Call', cls: 'bg-crm-accent/10 text-crm-accent border border-crm-accent/20' },
  'close-deal': { label: 'Closed Deal', cls: 'bg-crm-positive/10 text-crm-positive border border-crm-positive/20' },
  'eod-report': { label: 'EOD Report', cls: 'bg-white/5 text-crm-muted border border-crm-border' },
};

function loadSubmissions() {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(SUBMISSIONS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  localStorage.setItem(SUBMISSIONS_KEY, JSON.stringify(sampleSubmissions));
  return sampleSubmissions;
}

export default function SubmitPage() {
  const [config, setConfig] = useState({ bookCallFormUrl: '', closeDealFormUrl: '', eodReportFormUrl: '' });
  const [activeForm, setActiveForm] = useState(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [submissions, setSubmissions] = useState([]);

  useEffect(() => {
    setConfig(getFormConfig());
    setSubmissions(loadSubmissions());
  }, []);

  const closeOverlay = useCallback(() => {
    setActiveForm(null);
    setIframeLoaded(false);
  }, []);

  useEffect(() => {
    if (!activeForm) return;
    const handler = (e) => { if (e.key === 'Escape') closeOverlay(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeForm, closeOverlay]);

  const openForm = (formId, configKey) => {
    setIframeLoaded(false);
    setActiveForm({ id: formId, url: config[configKey] });
  };

  const activeUrl = activeForm?.url || '';

  return (
    <div>
      <header className="sticky top-0 z-40 border-b border-crm-border bg-crm-bg/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-8 h-16">
          <div>
            <h1 className="font-display font-bold text-crm-text-bright text-lg tracking-tight">Submit reports</h1>
            <p className="text-xs text-crm-muted font-mono">Book calls, log closes, and submit your end-of-day</p>
          </div>
        </div>
      </header>

      <div className="px-8 py-8 space-y-8">
        {/* Three Form Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {formCards.map((card) => (
            <div
              key={card.id}
              onClick={() => openForm(card.id, card.configKey)}
              className="glass-card p-8 flex flex-col items-center text-center cursor-pointer transition-all duration-200 hover:border-crm-border-hover hover:scale-[1.02]"
            >
              <div className={`w-16 h-16 rounded-2xl ${card.iconBg} flex items-center justify-center`}>
                <card.icon className={`w-7 h-7 ${card.iconColor}`} />
              </div>
              <h2 className="font-display font-bold text-crm-text-bright text-xl mt-5">{card.title}</h2>
              <p className="text-sm text-crm-muted mt-2 leading-relaxed">{card.description}</p>
              <div className="flex items-center gap-2 mt-4">
                <div className={`w-2 h-2 rounded-full ${card.notificationDot}`} />
                <span className="text-xs text-crm-muted">{card.notification}</span>
              </div>
              <button
                className={`w-full mt-6 py-3 rounded-lg font-display font-semibold text-sm transition-colors ${card.btnClass}`}
                onClick={(e) => { e.stopPropagation(); openForm(card.id, card.configKey); }}
              >
                Open form
              </button>
            </div>
          ))}
        </div>

        {/* Recent Submissions */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-crm-muted" />
            <h3 className="text-sm font-mono text-crm-muted uppercase tracking-wider">Your recent submissions</h3>
          </div>
          {submissions.length > 0 ? (
            <div className="glass-card overflow-hidden">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Type</th>
                    <th>Detail</th>
                    <th>Closer</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.slice(0, 15).map((s) => {
                    const badge = typeBadge[s.type] || typeBadge['eod-report'];
                    return (
                      <tr key={s.id}>
                        <td className="text-xs font-mono text-crm-muted whitespace-nowrap">
                          {new Date(s.submittedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
                        </td>
                        <td>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium ${badge.cls}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="text-sm text-crm-text">{s.detail}</td>
                        <td className="text-sm text-crm-text-bright">{s.closerName}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="glass-card p-8 text-center text-sm text-crm-muted">
              No submissions yet. Use the forms above to start logging your activity.
            </div>
          )}
        </div>
      </div>

      {/* Form Overlay */}
      {activeForm && (
        <>
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm" onClick={closeOverlay} />
          <div className="fixed inset-0 md:inset-4 z-50 bg-crm-bg border border-crm-border md:rounded-xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-crm-border">
              <h2 className="font-display font-semibold text-crm-text-bright">{overlayTitles[activeForm.id]}</h2>
              <button
                onClick={closeOverlay}
                className="w-8 h-8 rounded-lg hover:bg-white/5 flex items-center justify-center text-crm-muted hover:text-crm-text transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 relative">
              {activeUrl ? (
                <>
                  {!iframeLoaded && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="animate-spin w-8 h-8 border-2 border-crm-accent border-t-transparent rounded-full" />
                    </div>
                  )}
                  <iframe
                    src={activeUrl}
                    className="w-full h-full border-0"
                    onLoad={() => setIframeLoaded(true)}
                  />
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full px-8 text-center">
                  <SettingsIcon className="w-12 h-12 text-crm-muted mb-4" />
                  <h3 className="font-display font-semibold text-crm-text-bright text-lg mb-2">Form not configured</h3>
                  <p className="text-sm text-crm-muted mb-6">
                    This form has not been configured yet. Ask your admin to add the URL in Settings.
                  </p>
                  <Link
                    href="/settings"
                    onClick={closeOverlay}
                    className="inline-flex items-center gap-2 bg-crm-accent hover:bg-crm-accent-glow text-white font-display font-semibold px-6 py-2.5 rounded-lg transition-colors"
                  >
                    <SettingsIcon className="w-4 h-4" />
                    Go to Settings
                  </Link>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
