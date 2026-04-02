'use client';
import { useState, useEffect } from 'react';
import { Copy, Check, Users, Webhook, Bot, Phone, Video, Zap, MessageSquare, Save, ChevronDown, ChevronUp, FileText, BookOpen, Activity, Send, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { getInitials } from '@/lib/utils';
import { closers } from '@/lib/mock-data';
import { getFormConfig, saveFormConfig } from '@/lib/form-config';

var webhookEndpoints = [
  {
    label: 'Book a Call',
    path: '/api/webhooks/book-call',
    method: 'POST',
    description: 'Stores a booked call and updates dashboard KPIs',
    fields: 'closerName (required), leadName (required), leadPhone, leadEmail, leadSource, channel, callDateTime, notes',
    payload: '{\n  "closerName": "Anthony",\n  "leadName": "Sarah Mitchell",\n  "leadPhone": "+15559876543",\n  "leadEmail": "sarah@email.com",\n  "leadSource": "inbound",\n  "channel": "challenge_funnel",\n  "callDateTime": "2026-04-02T14:00:00Z",\n  "notes": "Hot lead from challenge day 3"\n}',
    whatsappTemplate: '\ud83d\udcde {{ closerName }} booked a call\\n\\nLead: {{ leadName }}\\nSource: {{ leadSource }}\\nChannel: {{ channel }}\\nScheduled: {{ callDateTime }}',
  },
  {
    label: 'Close a Deal',
    path: '/api/webhooks/close-deal',
    method: 'POST',
    description: 'Stores a closed deal, recalculates revenue and close rate',
    fields: 'closerName (required), leadName (required), dealValue (required), paymentMethod, leadSource, fathomUrl, notes',
    payload: '{\n  "closerName": "Anthony",\n  "leadName": "Sarah Mitchell",\n  "dealValue": 5500,\n  "paymentMethod": "full-pay",\n  "leadSource": "inbound",\n  "fathomUrl": "https://fathom.video/call/abc123",\n  "notes": "Closed on first call"\n}',
    whatsappTemplate: '\ud83d\udd25 DEAL CLOSED! \ud83d\udd25\\n\\n{{ closerName }} just closed {{ leadName }}!\\n\\n\ud83d\udcb0 ${{ dealValue }} \u2014 {{ paymentMethod }}\\nSource: {{ leadSource }}',
  },
  {
    label: 'EOD Report',
    path: '/api/webhooks/eod-report',
    method: 'POST',
    description: 'Stores end-of-day report, updates dials/closes/cash KPIs',
    fields: 'closerName (required), totalDials, connects, callsBooked, callsTaken, closes, cashCollected, pipelineNotes, biggestWin, biggestLoss, confidenceScore (1-10)',
    payload: '{\n  "closerName": "Anthony",\n  "totalDials": 34,\n  "connects": 9,\n  "callsBooked": 3,\n  "callsTaken": 5,\n  "closes": 2,\n  "cashCollected": 8500,\n  "pipelineNotes": "2 hot leads in pipeline",\n  "biggestWin": "Closed $5,500 deal",\n  "biggestLoss": "Lost deal on price",\n  "confidenceScore": 8\n}',
    whatsappTemplate: null,
  },
  {
    label: 'Dashboard API',
    path: '/api/dashboard',
    method: 'GET',
    description: 'Returns all KPIs, closer breakdown, and recent activity',
    fields: null,
    payload: null,
    whatsappTemplate: null,
  },
  {
    label: 'Health Check',
    path: '/api/health',
    method: 'GET',
    description: 'Returns server status — use to verify your deployment is live',
    fields: null,
    payload: null,
    whatsappTemplate: null,
  },
];

var formFields = [
  { key: 'bookCallFormUrl', label: 'Book a Call Form URL', webhookPath: '/api/webhooks/book-call', icon: Phone },
  { key: 'closeDealFormUrl', label: 'Close a Deal Form URL', webhookPath: '/api/webhooks/close-deal', icon: Zap },
  { key: 'eodReportFormUrl', label: 'EOD Report Form URL', webhookPath: '/api/webhooks/eod-report', icon: FileText },
];

var n8nSteps = [
  {
    num: 1,
    title: 'Create 3 n8n workflows',
    detail: 'One for each form: Book a Call, Close a Deal, EOD Report. Each starts with an n8n Form Trigger node.',
  },
  {
    num: 2,
    title: 'Add HTTP Request node to POST to CRM',
    detail: 'After the Form Trigger, add an HTTP Request node. Set method to POST, paste the webhook URL from below, and map form fields to the JSON body.',
  },
  {
    num: 3,
    title: 'Add WhatsApp node (Book + Close only)',
    detail: 'For Book a Call and Close a Deal, add a second HTTP Request node to send a message to your WhatsApp group via Assistro API. EOD reports go to CRM only.',
  },
  {
    num: 4,
    title: 'Copy n8n form URLs into settings below',
    detail: 'Click the Form Trigger node in n8n, copy the Production URL, and paste it into the matching field below. Closers will see these forms on the Submit page.',
  },
  {
    num: 5,
    title: 'Test the full flow',
    detail: 'Use the Test buttons below to send a sample submission. Then open the dashboard and verify the KPI cards update within 30 seconds.',
  },
];

export default function SettingsPage() {
  var s1 = useState(null), copiedUrl = s1[0], setCopiedUrl = s1[1];
  var s2 = useState({ bookCallFormUrl: '', closeDealFormUrl: '', eodReportFormUrl: '' }), formConfig = s2[0], setFormConfig = s2[1];
  var s3 = useState(false), saved = s3[0], setSaved = s3[1];
  var s4 = useState(null), expandedPayload = s4[0], setExpandedPayload = s4[1];
  var s5 = useState(''), origin = s5[0], setOrigin = s5[1];
  var s6 = useState(null), liveStatus = s6[0], setLiveStatus = s6[1];
  var s7 = useState(null), testResult = s7[0], setTestResult = s7[1];
  var s8 = useState(false), testing = s8[0], setTesting = s8[1];

  useEffect(function() {
    setFormConfig(getFormConfig());
    setOrigin(window.location.origin);

    // Fetch live status
    fetch('/api/dashboard')
      .then(function(r) { return r.json(); })
      .then(function(data) { if (data.success) setLiveStatus(data); })
      .catch(function() {});
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

  function handleTestWebhook(ep) {
    if (!ep.payload) return;
    setTesting(true);
    setTestResult(null);
    fetch(origin + ep.path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: ep.payload,
    })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        setTestResult({ path: ep.path, success: true, message: 'Sent! Check your dashboard.' });
        setTesting(false);
        // Refresh status
        fetch('/api/dashboard')
          .then(function(r) { return r.json(); })
          .then(function(data) { if (data.success) setLiveStatus(data); })
          .catch(function() {});
      })
      .catch(function(e) {
        setTestResult({ path: ep.path, success: false, message: e.message });
        setTesting(false);
      });
  }

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      <h1 className="font-display text-2xl font-bold text-crm-text-bright mb-6">Settings</h1>

      <div className="space-y-6">

        {/* ===== LIVE STATUS ===== */}
        <div className="glass-card overflow-hidden stagger-1">
          <div className="section-header">
            <h3><Activity className="w-4 h-4 text-crm-positive" /> Live Data Status</h3>
            <span className="section-tag">{liveStatus ? 'Connected' : 'Loading...'}</span>
          </div>
          <div className="p-5">
            {liveStatus ? (
              <div className="grid grid-cols-4 gap-3">
                <div className="glass-surface p-3 text-center">
                  <div className="text-2xl font-display font-bold text-crm-text-bright">{liveStatus.counts.bookedCalls}</div>
                  <div className="text-xs text-crm-muted mt-1">Booked Calls</div>
                </div>
                <div className="glass-surface p-3 text-center">
                  <div className="text-2xl font-display font-bold text-crm-positive">{liveStatus.counts.closedDeals}</div>
                  <div className="text-xs text-crm-muted mt-1">Closed Deals</div>
                </div>
                <div className="glass-surface p-3 text-center">
                  <div className="text-2xl font-display font-bold text-crm-text-bright">{liveStatus.counts.eodReports}</div>
                  <div className="text-xs text-crm-muted mt-1">EOD Reports</div>
                </div>
                <div className="glass-surface p-3 text-center">
                  <div className="text-2xl font-display font-bold text-crm-accent">{liveStatus.overview.activeClosers}</div>
                  <div className="text-xs text-crm-muted mt-1">Active Closers</div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-crm-muted text-center py-4">Connecting to server...</div>
            )}
            <p className="text-xs text-crm-muted/50 mt-3">Data is stored in server memory. Resets on deploy/restart. Dashboard polls every 30 seconds.</p>
          </div>
        </div>

        {/* ===== n8n SETUP GUIDE ===== */}
        <div className="glass-card overflow-hidden stagger-2">
          <div className="section-header">
            <h3><BookOpen className="w-4 h-4 text-crm-accent" /> n8n Setup Guide</h3>
            <span className="section-tag">5 steps</span>
          </div>
          <div className="p-5">
            <div className="space-y-4">
              {n8nSteps.map(function(step) {
                return (
                  <div key={step.num} className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-crm-accent/10 border border-crm-accent/20 flex items-center justify-center">
                      <span className="text-sm font-display font-bold text-crm-accent">{step.num}</span>
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-crm-text-bright">{step.title}</div>
                      <div className="text-xs text-crm-muted mt-0.5 leading-relaxed">{step.detail}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ===== WEBHOOK ENDPOINTS + TEST ===== */}
        <div className="glass-card overflow-hidden stagger-3">
          <div className="section-header">
            <h3><Webhook className="w-4 h-4 text-crm-accent" /> Webhook Endpoints</h3>
            <span className="section-tag">{webhookEndpoints.length} endpoints</span>
          </div>
          <div className="p-5 space-y-3">
            {webhookEndpoints.map(function(ep) {
              var isExpanded = expandedPayload === ep.path;
              return (
                <div key={ep.path} className="glass-surface overflow-hidden">
                  <div className="flex items-center gap-3 p-3">
                    <span className={'text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ' + (ep.method === 'POST' ? 'bg-crm-accent/10 text-crm-accent border border-crm-accent/20' : 'bg-crm-positive/10 text-crm-positive border border-crm-positive/20')}>{ep.method}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-crm-text-bright mb-0.5">{ep.label}</div>
                      <div className="text-xs font-mono text-crm-muted truncate">{origin}{ep.path}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      {ep.payload && (
                        <button
                          onClick={function() { handleTestWebhook(ep); }}
                          disabled={testing}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-mono bg-crm-accent/10 text-crm-accent border border-crm-accent/20 hover:bg-crm-accent/20 transition-colors disabled:opacity-50"
                        >
                          <Send className="w-3 h-3" />
                          Test
                        </button>
                      )}
                      {ep.payload && (
                        <button
                          onClick={function() { setExpandedPayload(isExpanded ? null : ep.path); }}
                          className="btn-ghost p-2"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
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

                  {/* Test result */}
                  {testResult && testResult.path === ep.path && (
                    <div className={'flex items-center gap-2 px-3 py-2 border-t border-crm-border/30 ' + (testResult.success ? 'bg-crm-positive/5' : 'bg-crm-negative/5')}>
                      {testResult.success ? <CheckCircle className="w-3.5 h-3.5 text-crm-positive" /> : <AlertCircle className="w-3.5 h-3.5 text-crm-negative" />}
                      <span className={'text-xs font-mono ' + (testResult.success ? 'text-crm-positive' : 'text-crm-negative')}>{testResult.message}</span>
                    </div>
                  )}

                  {/* Expanded payload + fields */}
                  {isExpanded && (
                    <div className="border-t border-crm-border/30 p-3 space-y-3">
                      <div>
                        <div className="text-xs text-crm-muted mb-1">{ep.description}</div>
                        {ep.fields && (
                          <div className="text-xs font-mono text-crm-muted/70">Fields: {ep.fields}</div>
                        )}
                      </div>

                      {ep.payload && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-mono text-crm-muted uppercase">Example JSON Body</span>
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

                      {ep.whatsappTemplate && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-mono text-crm-muted uppercase">WhatsApp Message Template</span>
                            <button
                              onClick={function() { handleCopy(ep.whatsappTemplate); }}
                              className="flex items-center gap-1 text-xs text-crm-muted hover:text-crm-text transition-colors"
                            >
                              {copiedUrl === ep.whatsappTemplate ? <Check className="w-3 h-3 text-crm-positive" /> : <Copy className="w-3 h-3" />}
                              <span>{copiedUrl === ep.whatsappTemplate ? 'Copied' : 'Copy'}</span>
                            </button>
                          </div>
                          <pre className="font-mono text-xs text-crm-text bg-crm-bg px-4 py-3 rounded-xl border border-crm-border overflow-x-auto whitespace-pre">{ep.whatsappTemplate}</pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ===== FORM CONFIGURATION ===== */}
        <div className="glass-card overflow-hidden stagger-4">
          <div className="section-header">
            <h3><FileText className="w-4 h-4 text-crm-accent" /> n8n Form URLs</h3>
          </div>
          <div className="p-5">
            <p className="text-xs text-crm-muted mb-5">Paste your n8n form Production URLs below. Closers click the form cards on the Submit page and these open in a new tab.</p>

            <div className="space-y-5">
              {formFields.map(function(field) {
                var FieldIcon = field.icon;
                return (
                  <div key={field.key}>
                    <label className="flex items-center gap-2 text-xs font-mono text-crm-muted uppercase tracking-wider mb-2">
                      <FieldIcon className="w-3.5 h-3.5" />
                      {field.label}
                    </label>
                    <input
                      type="text"
                      value={formConfig[field.key]}
                      onChange={function(e) { setFormConfig(Object.assign({}, formConfig, { [field.key]: e.target.value })); }}
                      placeholder="https://your-n8n.app/form/..."
                      className="input-field"
                    />
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1 font-mono text-xs text-crm-muted glass-surface px-3 py-2 truncate">
                        n8n HTTP Request should POST to: <span className="text-crm-text-bright">{origin}{field.webhookPath}</span>
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

        {/* ===== INTEGRATIONS ===== */}
        <div className="glass-card overflow-hidden stagger-5">
          <div className="section-header">
            <h3>Integrations</h3>
          </div>
          <div className="p-5 grid grid-cols-2 gap-3">
            {[
              { name: 'n8n', icon: Zap, status: 'connected', description: 'Workflow automation — form triggers + webhook delivery' },
              { name: 'Fathom', icon: Video, status: 'pending', description: 'AI call recording and analysis' },
              { name: 'JustCall', icon: Phone, status: 'pending', description: 'VoIP dialer and call tracking' },
              { name: 'WhatsApp (Assistro)', icon: MessageSquare, status: 'pending', description: 'Team group notifications via Assistro API' },
            ].map(function(intg) {
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
                        <span className="text-xs font-mono text-crm-positive">Ready</span>
                      </>
                    ) : (
                      <span className="text-xs font-mono text-crm-muted">Setup needed</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ===== TEAM MANAGEMENT ===== */}
        <div className="glass-card overflow-hidden stagger-6">
          <div className="section-header">
            <h3>Team Management</h3>
            <span className="section-tag">{liveStatus ? liveStatus.overview.activeClosers : closers.length} active</span>
          </div>
          <div className="p-5 space-y-2">
            {liveStatus && liveStatus.closers && liveStatus.closers.length > 0 ? (
              liveStatus.closers.map(function(c) {
                return (
                  <div key={c.name} className="flex items-center gap-3 p-3 glass-surface">
                    <div className="avatar avatar-md text-crm-text">
                      {getInitials(c.name)}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-crm-text-bright">{c.name}</div>
                      <div className="text-xs text-crm-muted">{c.dials} dials &middot; {c.closes} closes &middot; ${c.cash.toLocaleString()} cash</div>
                    </div>
                    <span className="badge-positive">Active today</span>
                  </div>
                );
              })
            ) : closers.length > 0 ? (
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
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8">
                <Users className="w-5 h-5 text-crm-muted mx-auto mb-2" />
                <p className="text-sm text-crm-muted">No team members yet</p>
                <p className="text-xs text-crm-muted/50 mt-1">Closers appear automatically when they submit forms via n8n</p>
              </div>
            )}
          </div>
        </div>

        {/* ===== EOD AGENT CONFIG ===== */}
        <div className="glass-card overflow-hidden stagger-7">
          <div className="section-header">
            <h3><Bot className="w-4 h-4 text-crm-accent" /> EOD Agent Configuration</h3>
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

      </div>
    </div>
  );
}
