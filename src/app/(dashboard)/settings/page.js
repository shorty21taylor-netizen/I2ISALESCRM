'use client';
import { useState, useEffect } from 'react';
import { Wifi, WifiOff, Copy, Check, Users, Webhook, Bot, Phone, Video, Zap, MessageSquare, Save, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { getInitials } from '@/lib/utils';
import { closers } from '@/lib/mock-data';
import { getFormConfig, saveFormConfig } from '@/lib/form-config';

var integrations = [
  { name: 'JustCall', icon: Phone, status: 'connected', description: 'VoIP dialer and call tracking' },
  { name: 'Fathom', icon: Video, status: 'connected', description: 'AI call recording and analysis' },
  { name: 'n8n', icon: Zap, status: 'connected', description: 'Workflow automation' },
  { name: 'WhatsApp', icon: MessageSquare, status: 'disconnected', description: 'Lead messaging' },
];

var webhookEndpoints = [
  {
    label: 'Book a Call',
    path: '/api/webhooks/book-call',
    description: 'Book a Call submissions',
    payload: '{\n  "closerName": "Marcus Johnson",\n  "leadName": "Sarah Mitchell",\n  "leadPhone": "+15559876543",\n  "leadEmail": "sarah@email.com",\n  "leadSource": "inbound",\n  "channel": "challenge_funnel",\n  "callDateTime": "2026-04-02T14:00:00Z",\n  "notes": "Hot lead from challenge day 3"\n}',
  },
  {
    label: 'Close a Deal',
    path: '/api/webhooks/close-deal',
    description: 'Close a Deal submissions',
    payload: '{\n  "closerName": "Marcus Johnson",\n  "leadName": "Sarah Mitchell",\n  "dealValue": 5500,\n  "paymentMethod": "full-pay",\n  "leadSource": "inbound",\n  "fathomUrl": "https://fathom.video/call/abc123",\n  "notes": "Closed on first call"\n}',
  },
  {
    label: 'EOD Report',
    path: '/api/webhooks/eod-report',
    description: 'EOD Report submissions',
    payload: '{\n  "closerName": "Marcus Johnson",\n  "totalDials": 34,\n  "connects": 9,\n  "callsBooked": 3,\n  "callsTaken": 5,\n  "closes": 2,\n  "cashCollected": 8500,\n  "pipelineNotes": "2 hot leads in pipeline",\n  "biggestWin": "Closed $5,500 deal",\n  "biggestLoss": "Lost deal on price",\n  "confidenceScore": 8\n}',
  },
  {
    label: 'Health Check',
    path: '/api/health',
    description: 'Health check endpoint (GET)',
    payload: null,
  },
];

var formFields = [
  { key: 'bookCallFormUrl', label: 'Book a Call Form URL', webhookPath: '/api/webhooks/book-call' },
  { key: 'closeDealFormUrl', label: 'Close a Deal Form URL', webhookPath: '/api/webhooks/close-deal' },
  { key: 'eodReportFormUrl', label: 'EOD Report Form URL', webhookPath: '/api/webhooks/eod-report' },
];

export default function SettingsPage() {
  var s1 = useState(null), copiedUrl = s1[0], setCopiedUrl = s1[1];
  var s2 = useState({ bookCallFormUrl: '', closeDealFormUrl: '', eodReportFormUrl: '' }), formConfig = s2[0], setFormConfig = s2[1];
  var s3 = useState(false), saved = s3[0], setSaved = s3[1];
  var s4 = useState(null), expandedPayload = s4[0], setExpandedPayload = s4[1];
  var s5 = useState(''), origin = s5[0], setOrigin = s5[1];

  useEffect(function() {
    setFormConfig(getFormConfig());
    setOrigin(window.location.origin);
  }, []);

  function handleCopy(text) {
    navigator.clipboard.writeText(text).then(function() {
      setCopiedUrl(text);
      setTimeout(function() { setCopiedUrl(null); }, 2000);
    });
  }

  function handleSaveFormConfig() {
    saveFormConfig(formConfig);
    setSaved(true);
    setTimeout(function() { setSaved(false); }, 2000);
  }

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      <h1 className="font-display text-2xl font-bold text-crm-text-bright mb-6">Settings</h1>

      <div className="space-y-6">
        {/* Form Configuration */}
        <div className="glass-card overflow-hidden stagger-1">
          <div className="section-header">
            <h3><FileText className="w-4 h-4 text-crm-accent" /> Form Configuration</h3>
          </div>
          <div className="p-5">
            <p className="text-xs text-crm-muted mb-5">Paste your n8n form URLs below. Closers will see these forms embedded on the Forms page.</p>

            <div className="space-y-5">
              {formFields.map(function(field) {
                return (
                  <div key={field.key}>
                    <label className="block text-xs font-mono text-crm-muted uppercase tracking-wider mb-2">{field.label}</label>
                    <input
                      type="text"
                      value={formConfig[field.key]}
                      onChange={function(e) { setFormConfig(Object.assign({}, formConfig, { [field.key]: e.target.value })); }}
                      placeholder="Paste your n8n form URL here..."
                      className="input-field"
                    />
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1 font-mono text-xs text-crm-muted glass-surface px-3 py-2 truncate">
                        n8n should POST to: {origin}{field.webhookPath}
                      </div>
                      <button
                        onClick={function() { handleCopy(origin + field.webhookPath); }}
                        className="btn-ghost p-2 flex-shrink-0"
                      >
                        {copiedUrl === origin + field.webhookPath ? <Check className="w-3.5 h-3.5 text-crm-positive" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-3 mt-5">
              <button onClick={handleSaveFormConfig} className="btn-primary flex items-center gap-2">
                <Save className="w-4 h-4" />
                Save Configuration
              </button>
              {saved && (
                <span className="text-sm font-mono text-crm-positive stagger-1">Saved!</span>
              )}
            </div>
          </div>
        </div>

        {/* Webhook Endpoints Reference */}
        <div className="glass-card overflow-hidden stagger-2">
          <div className="section-header">
            <h3>Webhook Endpoints</h3>
            <span className="section-tag">{webhookEndpoints.length} endpoints</span>
          </div>
          <div className="p-5 space-y-2">
            {webhookEndpoints.map(function(ep) {
              return (
                <div key={ep.path} className="glass-surface overflow-hidden">
                  <div className="flex items-center gap-3 p-3">
                    <Webhook className="w-4 h-4 text-crm-muted flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-crm-text-bright mb-0.5">{ep.label}</div>
                      <div className="text-xs font-mono text-crm-muted truncate">{origin}{ep.path}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      {ep.payload && (
                        <button
                          onClick={function() { setExpandedPayload(expandedPayload === ep.path ? null : ep.path); }}
                          className="btn-ghost p-2"
                        >
                          {expandedPayload === ep.path ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      )}
                      <button
                        onClick={function() { handleCopy(origin + ep.path); }}
                        className="btn-ghost p-2"
                      >
                        {copiedUrl === origin + ep.path ? <Check className="w-4 h-4 text-crm-positive" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  {expandedPayload === ep.path && ep.payload && (
                    <div className="border-t border-crm-border/30 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-mono text-crm-muted uppercase">Example Payload</span>
                        <button
                          onClick={function() { handleCopy(ep.payload); }}
                          className="flex items-center gap-1 text-xs text-crm-muted hover:text-crm-text transition-colors"
                        >
                          {copiedUrl === ep.payload ? <Check className="w-3 h-3 text-crm-positive" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedUrl === ep.payload ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                      <pre className="font-mono text-xs text-crm-text bg-crm-bg px-4 py-3 rounded-xl border border-crm-border overflow-x-auto whitespace-pre">{ep.payload}</pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Integrations */}
        <div className="glass-card overflow-hidden stagger-3">
          <div className="section-header">
            <h3>Integrations</h3>
            <span className="section-tag">{integrations.filter(function(i) { return i.status === 'connected'; }).length} active</span>
          </div>
          <div className="p-5 grid grid-cols-2 gap-3">
            {integrations.map(function(intg) {
              return (
                <div key={intg.name} className="flex items-center gap-3 p-3 glass-surface">
                  <div className={'p-2 rounded-xl ' + (intg.status === 'connected' ? 'bg-crm-positive/10 text-crm-positive' : 'bg-white/5 text-crm-muted')}>
                    <intg.icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-crm-text-bright">{intg.name}</div>
                    <div className="text-xs text-crm-muted">{intg.description}</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {intg.status === 'connected' ? (
                      <>
                        <div className="glow-dot-green" />
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
              );
            })}
          </div>
        </div>

        {/* Team Management */}
        <div className="glass-card overflow-hidden stagger-4">
          <div className="section-header">
            <h3>Team Management</h3>
            <span className="section-tag">{closers.length} members</span>
          </div>
          <div className="p-5 space-y-2">
            {closers.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-5 h-5 text-crm-muted mx-auto mb-2" />
                <p className="text-sm text-crm-muted">No team members yet</p>
                <p className="text-xs text-crm-muted/50 mt-1">Closers will appear here when added via webhooks</p>
              </div>
            ) : (
              closers.map(function(c) {
                return (
                  <div key={c.id} className="flex items-center gap-3 p-3 glass-surface">
                    <div className="avatar avatar-md text-crm-text">
                      {getInitials(c.name)}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-crm-text-bright">{c.name}</div>
                      <div className="text-xs text-crm-muted">{c.email}</div>
                    </div>
                    <span className="badge-neutral capitalize">{c.role}</span>
                    <span className="badge-positive">{c.status}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* EOD Agent Config */}
        <div className="glass-card overflow-hidden stagger-5">
          <div className="section-header">
            <h3>EOD Agent Configuration</h3>
          </div>
          <div className="p-5 grid grid-cols-2 gap-4">
            <div className="glass-surface p-3">
              <div className="text-xs text-crm-muted mb-1">Submission Deadline</div>
              <div className="text-sm font-mono text-crm-text-bright">6:00 PM EST</div>
            </div>
            <div className="glass-surface p-3">
              <div className="text-xs text-crm-muted mb-1">Late Threshold</div>
              <div className="text-sm font-mono text-crm-text-bright">7:00 PM EST</div>
            </div>
            <div className="glass-surface p-3">
              <div className="text-xs text-crm-muted mb-1">Reminder Channel</div>
              <div className="text-sm font-mono text-crm-text-bright">WhatsApp</div>
            </div>
            <div className="glass-surface p-3">
              <div className="text-xs text-crm-muted mb-1">Auto-flag Missing</div>
              <div className="text-sm font-mono text-crm-positive">Enabled</div>
            </div>
          </div>
        </div>

        {/* AI Config */}
        <div className="glass-card overflow-hidden stagger-6">
          <div className="section-header">
            <h3><Bot className="w-4 h-4 text-crm-accent" /> AI Configuration</h3>
          </div>
          <div className="p-5 grid grid-cols-2 gap-4">
            <div className="glass-surface p-3">
              <div className="text-xs text-crm-muted mb-1">Call Scoring Model</div>
              <div className="text-sm font-mono text-crm-text-bright">GPT-4o + Custom Fine-tune</div>
            </div>
            <div className="glass-surface p-3">
              <div className="text-xs text-crm-muted mb-1">Diagnostic Engine</div>
              <div className="text-sm font-mono text-crm-text-bright">Summit AI v2.1</div>
            </div>
            <div className="glass-surface p-3">
              <div className="text-xs text-crm-muted mb-1">Auto-suggestions</div>
              <div className="text-sm font-mono text-crm-positive">Enabled</div>
            </div>
            <div className="glass-surface p-3">
              <div className="text-xs text-crm-muted mb-1">Report Frequency</div>
              <div className="text-sm font-mono text-crm-text-bright">Weekly (Monday 8 AM)</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
