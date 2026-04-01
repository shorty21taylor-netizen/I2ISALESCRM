'use client';
import { useState, useEffect } from 'react';
import { Phone, DollarSign, FileText, Settings as SettingsIcon, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { getFormConfig } from '@/lib/form-config';

const SUBMISSIONS_KEY = 'summit-crm-submissions';

const tabs = [
  { id: 'book-call', label: 'Book a Call', icon: Phone, configKey: 'bookCallFormUrl' },
  { id: 'close-deal', label: 'Close a Deal', icon: DollarSign, configKey: 'closeDealFormUrl' },
  { id: 'eod-report', label: 'EOD Report', icon: FileText, configKey: 'eodReportFormUrl' },
];

function getSubmissions(type) {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(SUBMISSIONS_KEY);
    if (!stored) return [];
    const all = JSON.parse(stored);
    return all.filter((s) => s.type === type).slice(0, 10);
  } catch {
    return [];
  }
}

function formatSubmissionDetail(s) {
  if (s.type === 'book-call') return s.leadName || 'Unknown lead';
  if (s.type === 'close-deal') return `${s.leadName || 'Unknown'} — $${s.dealValue || 0}`;
  if (s.type === 'eod-report') return `${s.totalDials || 0} dials`;
  return '';
}

export default function FormsPage() {
  const [activeTab, setActiveTab] = useState('book-call');
  const [config, setConfig] = useState({ bookCallFormUrl: '', closeDealFormUrl: '', eodReportFormUrl: '' });
  const [submissions, setSubmissions] = useState([]);

  useEffect(() => {
    setConfig(getFormConfig());
  }, []);

  useEffect(() => {
    setSubmissions(getSubmissions(activeTab));
  }, [activeTab]);

  const currentTab = tabs.find((t) => t.id === activeTab);
  const formUrl = config[currentTab.configKey];

  return (
    <div>
      <header className="sticky top-0 z-40 border-b border-crm-border bg-crm-bg/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-8 h-16">
          <div>
            <h1 className="font-display font-bold text-crm-text-bright text-lg tracking-tight">Forms</h1>
            <p className="text-xs text-crm-muted font-mono">Submit your daily activity</p>
          </div>
        </div>
      </header>

      <div className="px-8 py-6 space-y-6">
        {/* Tab Buttons */}
        <div className="flex items-center gap-2">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-crm-accent/10 text-crm-accent border border-crm-accent/20'
                    : 'text-crm-muted hover:text-crm-text border border-transparent'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Form Content */}
        {formUrl ? (
          <div className="glass-card p-1">
            <iframe
              src={formUrl}
              className="w-full border-0 rounded-lg"
              style={{ height: 'calc(100vh - 200px)', minHeight: '600px' }}
            />
          </div>
        ) : (
          <div className="glass-card p-12 text-center">
            <SettingsIcon className="w-12 h-12 text-crm-muted mx-auto mb-4" />
            <h3 className="font-display font-semibold text-crm-text-bright text-lg mb-2">Form not configured</h3>
            <p className="text-sm text-crm-muted mb-6">
              Ask your admin to add the n8n form URL in Settings &rarr; Form Configuration
            </p>
            <Link
              href="/settings"
              className="inline-flex items-center gap-2 bg-crm-accent hover:bg-crm-accent-glow text-white font-display font-semibold px-6 py-2.5 rounded-lg transition-colors"
            >
              <SettingsIcon className="w-4 h-4" />
              Go to Settings
            </Link>
          </div>
        )}

        {/* Recent Submissions */}
        {submissions.length > 0 && (
          <div className="glass-card p-5">
            <h3 className="text-sm font-mono text-crm-muted uppercase tracking-wider mb-3">Recent Submissions</h3>
            <div className="space-y-2">
              {submissions.map((s) => (
                <div key={s.id} className="flex items-center gap-3 p-2 rounded-lg bg-white/[0.02]">
                  <span className="text-xs font-mono text-crm-muted">
                    {new Date(s.submittedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </span>
                  <span className="text-sm text-crm-text-bright">{s.closerName}</span>
                  <span className="text-sm text-crm-muted">{formatSubmissionDetail(s)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
