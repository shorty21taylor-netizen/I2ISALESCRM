'use client';

import { useState, useEffect } from 'react';
import { Phone, DollarSign, ClipboardCheck, ExternalLink, AlertTriangle, Clock } from 'lucide-react';
import Link from 'next/link';
import { getFormConfig } from '@/lib/form-config';

var SUBMISSIONS_KEY = 'summit-crm-submissions';

var sampleSubmissions = [
  { id: 's1', type: 'close-deal', closerName: 'Marcus Johnson', detail: 'Sarah Mitchell \u2014 $5,500', submittedAt: '2026-03-31T18:30:00Z' },
  { id: 's2', type: 'book-call', closerName: 'Aisha Williams', detail: 'James Taylor \u2014 Apr 2, 2:00 PM', submittedAt: '2026-03-31T16:45:00Z' },
  { id: 's3', type: 'eod-report', closerName: 'Marcus Johnson', detail: '34 dials, 2 closes, $8,500', submittedAt: '2026-03-31T18:12:00Z' },
  { id: 's4', type: 'book-call', closerName: 'Jordan Rivera', detail: 'Kevin Wright \u2014 Apr 1, 1:00 PM', submittedAt: '2026-03-31T14:20:00Z' },
  { id: 's5', type: 'close-deal', closerName: 'Tanya Brooks', detail: 'David Kim \u2014 $3,750', submittedAt: '2026-03-31T16:05:00Z' },
  { id: 's6', type: 'eod-report', closerName: 'Aisha Williams', detail: '38 dials, 1 close, $3,800', submittedAt: '2026-03-31T18:45:00Z' },
];

var typeBadge = {
  'book-call': { label: 'Booked Call', cls: 'bg-crm-accent/10 text-crm-accent border border-crm-accent/20' },
  'close-deal': { label: 'Closed Deal', cls: 'bg-crm-positive/10 text-crm-positive border border-crm-positive/20' },
  'eod-report': { label: 'EOD Report', cls: 'bg-white/5 text-crm-muted border border-crm-border' },
};

function loadSubmissions() {
  if (typeof window === 'undefined') return [];
  try {
    var stored = localStorage.getItem(SUBMISSIONS_KEY);
    if (stored) {
      var parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {}
  localStorage.setItem(SUBMISSIONS_KEY, JSON.stringify(sampleSubmissions));
  return sampleSubmissions;
}

export default function SubmitPage() {
  var s1 = useState(false), showAlert = s1[0], setShowAlert = s1[1];
  var s2 = useState([]), submissions = s2[0], setSubmissions = s2[1];

  useEffect(function () {
    setSubmissions(loadSubmissions());
  }, []);

  function handleOpenForm(formType) {
    var config = getFormConfig();
    var url = '';
    if (formType === 'book-call') url = config.bookCallFormUrl;
    if (formType === 'close-deal') url = config.closeDealFormUrl;
    if (formType === 'eod-report') url = config.eodReportFormUrl;

    if (url && url.trim()) {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      setShowAlert(true);
      setTimeout(function () { setShowAlert(false); }, 5000);
    }
  }

  return (
    <div>
      <header className="page-header">
        <div className="flex items-center justify-between px-8 h-16">
          <div>
            <h1 className="font-display font-bold text-crm-text-bright text-lg tracking-tight">Submit reports</h1>
            <p className="text-xs text-crm-muted font-mono">Book calls, log closes, and submit your end-of-day</p>
          </div>
        </div>
      </header>

      <div className="px-8 py-8 space-y-6">
        {/* Three Form Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Book a Call */}
          <div
            onClick={function () { handleOpenForm('book-call'); }}
            className="glass-card p-8 flex flex-col items-center text-center cursor-pointer transition-all duration-200 hover:border-crm-border-hover hover:scale-[1.01] stagger-1"
          >
            <div className="w-16 h-16 rounded-2xl bg-crm-accent/10 border border-crm-accent/20 flex items-center justify-center">
              <Phone className="w-7 h-7 text-crm-accent" />
            </div>
            <h2 className="font-display font-bold text-crm-text-bright text-xl mt-5">Book a call</h2>
            <p className="text-sm text-crm-muted mt-2 leading-relaxed">Log a new booked sales call with lead details, source, and scheduled time.</p>
            <div className="flex items-center gap-2 mt-4">
              <div className="glow-dot-green" />
              <span className="text-xs text-crm-muted">Sends to team WhatsApp</span>
            </div>
            <button
              className="w-full mt-6 py-3 rounded-xl font-display font-semibold text-sm bg-crm-accent/10 text-crm-accent border border-crm-accent/20 hover:bg-crm-accent/20 transition-all flex items-center justify-center gap-2"
              onClick={function (e) { e.stopPropagation(); handleOpenForm('book-call'); }}
            >
              Open form
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>

          {/* Close a Deal */}
          <div
            onClick={function () { handleOpenForm('close-deal'); }}
            className="glass-card p-8 flex flex-col items-center text-center cursor-pointer transition-all duration-200 hover:border-crm-border-hover hover:scale-[1.01] stagger-2"
          >
            <div className="w-16 h-16 rounded-2xl bg-crm-positive/10 border border-crm-positive/20 flex items-center justify-center">
              <DollarSign className="w-7 h-7 text-crm-positive" />
            </div>
            <h2 className="font-display font-bold text-crm-text-bright text-xl mt-5">Close a deal</h2>
            <p className="text-sm text-crm-muted mt-2 leading-relaxed">Record a closed deal with revenue amount, payment method, and Fathom recording link.</p>
            <div className="flex items-center gap-2 mt-4">
              <div className="glow-dot-green" />
              <span className="text-xs text-crm-muted">Sends celebration to team WhatsApp</span>
            </div>
            <button
              className="w-full mt-6 py-3 rounded-xl font-display font-semibold text-sm bg-crm-positive/10 text-crm-positive border border-crm-positive/20 hover:bg-crm-positive/20 transition-all flex items-center justify-center gap-2"
              onClick={function (e) { e.stopPropagation(); handleOpenForm('close-deal'); }}
            >
              Open form
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>

          {/* End-of-Day Report */}
          <div
            onClick={function () { handleOpenForm('eod-report'); }}
            className="glass-card p-8 flex flex-col items-center text-center cursor-pointer transition-all duration-200 hover:border-crm-border-hover hover:scale-[1.01] stagger-3"
          >
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-crm-border flex items-center justify-center">
              <ClipboardCheck className="w-7 h-7 text-crm-muted" />
            </div>
            <h2 className="font-display font-bold text-crm-text-bright text-xl mt-5">End-of-day report</h2>
            <p className="text-sm text-crm-muted mt-2 leading-relaxed">Submit your daily numbers — dials, connects, closes, cash collected, pipeline notes, and confidence score.</p>
            <div className="flex items-center gap-2 mt-4">
              <div className="w-1.5 h-1.5 rounded-full bg-crm-muted" />
              <span className="text-xs text-crm-muted">Data sent to CRM only</span>
            </div>
            <button
              className="w-full mt-6 py-3 rounded-xl font-display font-semibold text-sm bg-white/5 text-crm-text border border-crm-border hover:bg-white/[0.08] transition-all flex items-center justify-center gap-2"
              onClick={function (e) { e.stopPropagation(); handleOpenForm('eod-report'); }}
            >
              Open form
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Alert — form not configured */}
        {showAlert && (
          <div className="glass-card p-4 flex items-center gap-3 border-crm-warning/20" onClick={function () { setShowAlert(false); }}>
            <AlertTriangle className="w-5 h-5 text-crm-warning flex-shrink-0" />
            <div>
              <p className="text-sm text-crm-text-bright">Form not configured</p>
              <p className="text-xs text-crm-muted mt-0.5">Ask your admin to add the n8n form URL in Settings &rarr; Form Configuration</p>
            </div>
            <Link href="/settings" className="btn-ghost text-xs ml-auto flex-shrink-0">Go to Settings</Link>
          </div>
        )}

        {/* Recent Submissions */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-crm-muted" />
            <h3 className="text-sm font-mono text-crm-muted uppercase tracking-wider">Recent submissions</h3>
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
                  {submissions.slice(0, 15).map(function (s) {
                    var badge = typeBadge[s.type] || typeBadge['eod-report'];
                    return (
                      <tr key={s.id}>
                        <td className="text-xs font-mono text-crm-muted whitespace-nowrap">
                          {new Date(s.submittedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
                        </td>
                        <td>
                          <span className={'inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium ' + badge.cls}>
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
    </div>
  );
}
