'use client';
import { useState, useEffect } from 'react';
import { Wifi, WifiOff, Copy, Check, Users, Webhook, Bot, Phone, Video, Zap, MessageSquare, Save, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { getInitials } from '@/lib/utils';
import { closers } from '@/lib/mock-data';
import { getFormConfig, saveFormConfig } from '@/lib/form-config';

const integrations = [
  { name: 'JustCall', icon: Phone, status: 'connected', description: 'VoIP dialer and call tracking' },
  { name: 'Fathom', icon: Video, status: 'connected', description: 'AI call recording and analysis' },
  { name: 'n8n', icon: Zap, status: 'connected', description: 'Workflow automation' },
  { name: 'WhatsApp', icon: MessageSquare, status: 'disconnected', description: 'Lead messaging' },
];

const webhookEndpoints = [
  {
    label: 'Book a Call',
    path: '/api/webhooks/book-call',
    description: 'Book a Call submissions',
    payload: `{
  "closerName": "Marcus Johnson",
  "leadName": "Sarah Mitchell",
  "leadPhone": "+15559876543",
  "leadEmail": "sarah@email.com",
  "leadSource": "inbound",
  "channel": "challenge_funnel",
  "callDateTime": "2026-04-02T14:00:00Z",
  "notes": "Hot lead from challenge day 3"
}`,
  },
  {
    label: 'Close a Deal',
    path: '/api/webhooks/close-deal',
    description: 'Close a Deal submissions',
    payload: `{
  "closerName": "Marcus Johnson",
  "leadName": "Sarah Mitchell",
  "dealValue": 5500,
  "paymentMethod": "full-pay",
  "leadSource": "inbound",
  "fathomUrl": "https://fathom.video/call/abc123",
  "notes": "Closed on first call"
}`,
  },
  {
    label: 'EOD Report',
    path: '/api/webhooks/eod-report',
    description: 'EOD Report submissions',
    payload: `{
  "closerName": "Marcus Johnson",
  "totalDials": 34,
  "connects": 9,
  "callsBooked": 3,
  "callsTaken": 5,
  "closes": 2,
  "cashCollected": 8500,
  "pipelineNotes": "2 hot leads in pipeline",
  "biggestWin": "Closed $5,500 deal",
  "biggestLoss": "Lost deal on price",
  "confidenceScore": 8
}`,
  },
  {
    label: 'Health Check',
    path: '/api/health',
    description: 'Health check endpoint (GET)',
    payload: null,
  },
];

const formFields = [
  { key: 'bookCallFormUrl', label: 'Book a Call Form URL', webhookPath: '/api/webhooks/book-call' },
  { key: 'closeDealFormUrl', label: 'Close a Deal Form URL', webhookPath: '/api/webhooks/close-deal' },
  { key: 'eodReportFormUrl', label: 'EOD Report Form URL', webhookPath: '/api/webhooks/eod-report' },
];

export default function SettingsPage() {
  const [copiedUrl, setCopiedUrl] = useState(null);
  const [formConfig, setFormConfig] = useState({ bookCallFormUrl: '', closeDealFormUrl: '', eodReportFormUrl: '' });
  const [saved, setSaved] = useState(false);
  const [expandedPayload, setExpandedPayload] = useState(null);
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    setFormConfig(getFormConfig());
    setOrigin(window.location.origin);
  }, []);

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedUrl(text);
      setTimeout(() => setCopiedUrl(null), 2000);
    });
  };

  const handleSaveFormConfig = () => {
    saveFormConfig(formConfig);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      <h1 className="font-display text-2xl font-bold text-crm-text-bright mb-6">Settings</h1>

      <div className="space-y-6">
        {/* Form Configuration */}
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-crm-accent" />
            <h3 className="text-sm font-mono text-crm-muted uppercase tracking-wider">Form Configuration</h3>
          </div>
          <p className="text-xs text-crm-muted mb-5">Paste your n8n form URLs below. Closers will see these forms embedded on the Forms page.</p>

          <div className="space-y-5">
            {formFields.map((field) => (
              <div key={field.key}>
                <label className="block text-xs font-mono text-crm-muted uppercase tracking-wider mb-2">{field.label}</label>
                <input
                  type="text"
                  value={formConfig[field.key]}
                  onChange={(e) => setFormConfig({ ...formConfig, [field.key]: e.target.value })}
                  placeholder="Paste your n8n form URL here..."
                  className="w-full bg-crm-bg border border-crm-border rounded-lg text-crm-text text-sm px-4 py-3 font-mono focus:border-crm-accent/50 focus:outline-none placeholder:text-crm-muted/50"
                />
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex-1 font-mono text-xs text-crm-muted bg-crm-surface px-3 py-2 rounded border border-crm-border truncate">
                    n8n should POST to: {origin}{field.webhookPath}
                  </div>
                  <button
                    onClick={() => handleCopy(`${origin}${field.webhookPath}`)}
                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-crm-muted hover:text-crm-text transition-colors flex-shrink-0"
                  >
                    {copiedUrl === `${origin}${field.webhookPath}` ? <Check className="w-3.5 h-3.5 text-crm-positive" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 mt-5">
            <button
              onClick={handleSaveFormConfig}
              className="flex items-center gap-2 bg-crm-accent hover:bg-crm-accent-glow text-white font-display font-semibold px-6 py-2.5 rounded-lg transition-colors"
            >
              <Save className="w-4 h-4" />
              Save Configuration
            </button>
            {saved && (
              <span className="text-sm font-mono text-crm-positive animate-fade-in">Saved!</span>
            )}
          </div>
        </div>

        {/* Webhook Endpoints Reference */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-mono text-crm-muted uppercase tracking-wider mb-4">Webhook Endpoints</h3>
          <div className="space-y-2">
            {webhookEndpoints.map((ep) => (
              <div key={ep.path} className="rounded-lg bg-white/[0.02] border border-crm-border/50 overflow-hidden">
                <div className="flex items-center gap-3 p-3">
                  <Webhook className="w-4 h-4 text-crm-muted flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-crm-text-bright mb-0.5">{ep.label}</div>
                    <div className="text-xs font-mono text-crm-muted truncate">{origin}{ep.path}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    {ep.payload && (
                      <button
                        onClick={() => setExpandedPayload(expandedPayload === ep.path ? null : ep.path)}
                        className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-crm-muted hover:text-crm-text transition-colors"
                      >
                        {expandedPayload === ep.path ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    )}
                    <button
                      onClick={() => handleCopy(`${origin}${ep.path}`)}
                      className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-crm-muted hover:text-crm-text transition-colors"
                    >
                      {copiedUrl === `${origin}${ep.path}` ? <Check className="w-4 h-4 text-crm-positive" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                {expandedPayload === ep.path && ep.payload && (
                  <div className="border-t border-crm-border/50 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-mono text-crm-muted uppercase">Example Payload</span>
                      <button
                        onClick={() => handleCopy(ep.payload)}
                        className="flex items-center gap-1 text-xs text-crm-muted hover:text-crm-text transition-colors"
                      >
                        {copiedUrl === ep.payload ? <Check className="w-3 h-3 text-crm-positive" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedUrl === ep.payload ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                    <pre className="font-mono text-xs text-crm-text bg-crm-bg px-4 py-3 rounded-lg border border-crm-border overflow-x-auto whitespace-pre">{ep.payload}</pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Integrations */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-mono text-crm-muted uppercase tracking-wider mb-4">Integrations</h3>
          <div className="grid grid-cols-2 gap-3">
            {integrations.map((intg) => (
              <div key={intg.name} className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-crm-border/50">
                <div className={`p-2 rounded-lg ${intg.status === 'connected' ? 'bg-crm-positive/10 text-crm-positive' : 'bg-white/5 text-crm-muted'}`}>
                  <intg.icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-crm-text-bright">{intg.name}</div>
                  <div className="text-xs text-crm-muted">{intg.description}</div>
                </div>
                <div className="flex items-center gap-1.5">
                  {intg.status === 'connected' ? (
                    <>
                      <Wifi className="w-3.5 h-3.5 text-crm-positive" />
                      <span className="text-xs font-mono text-crm-positive">Connected</span>
                    </>
                  ) : (
                    <>
                      <WifiOff className="w-3.5 h-3.5 text-crm-muted" />
                      <span className="text-xs font-mono text-crm-muted">Disconnected</span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Team Management */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-mono text-crm-muted uppercase tracking-wider">Team Management</h3>
            <span className="text-xs text-crm-muted">{closers.length} members</span>
          </div>
          <div className="space-y-2">
            {closers.map((c) => (
              <div key={c.id} className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02]">
                <div className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-sm font-bold text-crm-text">
                  {getInitials(c.name)}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-crm-text-bright">{c.name}</div>
                  <div className="text-xs text-crm-muted">{c.email}</div>
                </div>
                <span className="badge-neutral capitalize">{c.role}</span>
                <span className="badge-positive">{c.status}</span>
              </div>
            ))}
          </div>
        </div>

        {/* EOD Agent Config */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-mono text-crm-muted uppercase tracking-wider mb-4">EOD Agent Configuration</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-white/[0.03] p-3">
              <div className="text-xs text-crm-muted mb-1">Submission Deadline</div>
              <div className="text-sm font-mono text-crm-text-bright">6:00 PM EST</div>
            </div>
            <div className="rounded-lg bg-white/[0.03] p-3">
              <div className="text-xs text-crm-muted mb-1">Late Threshold</div>
              <div className="text-sm font-mono text-crm-text-bright">7:00 PM EST</div>
            </div>
            <div className="rounded-lg bg-white/[0.03] p-3">
              <div className="text-xs text-crm-muted mb-1">Reminder Channel</div>
              <div className="text-sm font-mono text-crm-text-bright">WhatsApp</div>
            </div>
            <div className="rounded-lg bg-white/[0.03] p-3">
              <div className="text-xs text-crm-muted mb-1">Auto-flag Missing</div>
              <div className="text-sm font-mono text-crm-positive">Enabled</div>
            </div>
          </div>
        </div>

        {/* AI Config */}
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Bot className="w-5 h-5 text-crm-accent" />
            <h3 className="text-sm font-mono text-crm-muted uppercase tracking-wider">AI Configuration</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-white/[0.03] p-3">
              <div className="text-xs text-crm-muted mb-1">Call Scoring Model</div>
              <div className="text-sm font-mono text-crm-text-bright">GPT-4o + Custom Fine-tune</div>
            </div>
            <div className="rounded-lg bg-white/[0.03] p-3">
              <div className="text-xs text-crm-muted mb-1">Diagnostic Engine</div>
              <div className="text-sm font-mono text-crm-text-bright">Summit AI v2.1</div>
            </div>
            <div className="rounded-lg bg-white/[0.03] p-3">
              <div className="text-xs text-crm-muted mb-1">Auto-suggestions</div>
              <div className="text-sm font-mono text-crm-positive">Enabled</div>
            </div>
            <div className="rounded-lg bg-white/[0.03] p-3">
              <div className="text-xs text-crm-muted mb-1">Report Frequency</div>
              <div className="text-sm font-mono text-crm-text-bright">Weekly (Monday 8 AM)</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
