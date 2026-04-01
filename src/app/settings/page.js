'use client';
import { useState } from 'react';
import { Wifi, WifiOff, Copy, Check, Users, Webhook, Bot, Phone, Video, Zap, MessageSquare } from 'lucide-react';
import { getInitials } from '@/lib/utils';
import { closers } from '@/lib/mock-data';

const integrations = [
  { name: 'JustCall', icon: Phone, status: 'connected', description: 'VoIP dialer and call tracking' },
  { name: 'Fathom', icon: Video, status: 'connected', description: 'AI call recording and analysis' },
  { name: 'n8n', icon: Zap, status: 'connected', description: 'Workflow automation' },
  { name: 'WhatsApp', icon: MessageSquare, status: 'disconnected', description: 'Lead messaging' },
];

const webhooks = [
  { label: 'EOD Submission', url: 'https://n8n.summit.com/webhook/eod-submit' },
  { label: 'Call Complete', url: 'https://n8n.summit.com/webhook/call-complete' },
  { label: 'Lead Assigned', url: 'https://n8n.summit.com/webhook/lead-assigned' },
  { label: 'Daily Report', url: 'https://n8n.summit.com/webhook/daily-report' },
];

export default function SettingsPage() {
  const [copiedUrl, setCopiedUrl] = useState(null);

  const handleCopy = (url) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopiedUrl(url);
      setTimeout(() => setCopiedUrl(null), 2000);
    });
  };

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      <h1 className="font-display text-2xl font-bold text-crm-text-bright mb-6">Settings</h1>

      <div className="space-y-6">
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

        {/* Webhook Endpoints */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-mono text-crm-muted uppercase tracking-wider mb-4">Webhook Endpoints</h3>
          <div className="space-y-2">
            {webhooks.map((wh) => (
              <div key={wh.label} className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02]">
                <Webhook className="w-4 h-4 text-crm-muted flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-crm-text-bright mb-0.5">{wh.label}</div>
                  <div className="text-xs font-mono text-crm-muted truncate">{wh.url}</div>
                </div>
                <button onClick={() => handleCopy(wh.url)} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-crm-muted hover:text-crm-text transition-colors">
                  {copiedUrl === wh.url ? <Check className="w-4 h-4 text-crm-positive" /> : <Copy className="w-4 h-4" />}
                </button>
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
