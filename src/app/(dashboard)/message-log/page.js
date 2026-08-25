'use client';

import { useState, useEffect } from 'react';
import { MessageSquare, CheckCircle2, XCircle, MinusCircle, ExternalLink, RefreshCw } from 'lucide-react';
import { useWorkspace, withWorkspace, apiFetch } from '@/lib/workspace-client';

var KIND_LABEL = {
  'book-call': 'Booked Call',
  'close-deal': 'Closed Deal',
  'eod-report': 'EOD Report',
  'scheduled': 'Scheduled',
  'manual': 'Manual',
};

var STATUS_META = {
  sent: { label: 'Sent', icon: CheckCircle2, cls: 'text-crm-positive' },
  failed: { label: 'Failed', icon: XCircle, cls: 'text-red-400' },
  skipped: { label: 'Not sent', icon: MinusCircle, cls: 'text-crm-muted' },
  external: { label: 'Sent by n8n', icon: ExternalLink, cls: 'text-crm-accent' },
};

function when(iso) {
  if (!iso) return '';
  var d = new Date(iso);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
}

export default function MessageLogPage() {
  var workspaceId = useWorkspace();
  var [rows, setRows] = useState([]);
  var [counts, setCounts] = useState({ sent: 0, failed: 0, skipped: 0, external: 0 });
  var [loading, setLoading] = useState(true);
  var [kind, setKind] = useState('');
  var [status, setStatus] = useState('');
  var [open, setOpen] = useState(null);

  function load() {
    setLoading(true);
    var path = '/api/message-log?limit=200'
      + (kind ? '&kind=' + kind : '')
      + (status ? '&status=' + status : '');
    apiFetch(withWorkspace(path, workspaceId))
      .then(function(r) { return r.json(); })
      .then(function(d) {
        setRows(d.data || []);
        setCounts(d.counts || { sent: 0, failed: 0, skipped: 0, external: 0 });
        setLoading(false);
      })
      .catch(function() { setLoading(false); });
  }

  useEffect(function() {
    if (workspaceId === null) return;
    load();
  }, [workspaceId, kind, status]);

  return (
    <div className="space-y-6">
      <div className="page-header flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <MessageSquare className="w-6 h-6" /> Message Log
          </h1>
          <p className="text-sm text-crm-muted mt-1">
            Every WhatsApp notification triggered by a form — from the CRM or the hosted forms.
          </p>
        </div>
        <button onClick={load} className="btn-ghost flex items-center gap-2 text-sm">
          <RefreshCw className={'w-4 h-4 ' + (loading ? 'animate-spin' : '')} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {['sent', 'failed', 'skipped', 'external'].map(function(k) {
          var meta = STATUS_META[k];
          return (
            <button
              key={k}
              onClick={function() { setStatus(status === k ? '' : k); }}
              className={'glass-card p-4 text-left transition ' + (status === k ? 'ring-1 ring-white/20' : '')}
            >
              <div className="text-xs text-crm-muted uppercase tracking-wide">{meta.label}</div>
              <div className={'text-2xl font-semibold mt-1 ' + meta.cls}>{counts[k] || 0}</div>
            </button>
          );
        })}
      </div>

      <div className="flex gap-2 flex-wrap">
        {[['', 'All forms'], ['book-call', 'Booked Calls'], ['close-deal', 'Closed Deals'], ['eod-report', 'EOD Reports']].map(function(opt) {
          return (
            <button
              key={opt[0]}
              onClick={function() { setKind(opt[0]); }}
              className={'px-3 py-1.5 rounded-lg text-xs font-mono border transition ' +
                (kind === opt[0] ? 'bg-white/10 border-white/20 text-crm-text' : 'border-crm-border text-crm-muted hover:text-crm-text')}
            >
              {opt[1]}
            </button>
          );
        })}
      </div>

      <div className="glass-card divide-y divide-crm-border">
        {loading && <div className="p-6 text-sm text-crm-muted">Loading…</div>}
        {!loading && rows.length === 0 && (
          <div className="p-6 text-sm text-crm-muted">
            No messages logged yet. Submit one of the forms to see it appear here.
          </div>
        )}
        {rows.map(function(r) {
          var meta = STATUS_META[r.status] || STATUS_META.skipped;
          var Icon = meta.icon;
          var isOpen = open === r.id;
          return (
            <div key={r.id} className="p-4">
              <button className="w-full text-left" onClick={function() { setOpen(isOpen ? null : r.id); }}>
                <div className="flex items-center gap-3 flex-wrap">
                  <Icon className={'w-4 h-4 flex-shrink-0 ' + meta.cls} />
                  <span className="text-sm font-medium">{KIND_LABEL[r.kind] || r.kind}</span>
                  {r.recordLabel && <span className="text-sm text-crm-muted">· {r.recordLabel}</span>}
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded border border-crm-border text-crm-muted">
                    {r.source === 'n8n' ? 'n8n form' : r.source === 'scheduler' ? 'scheduler' : 'CRM form'}
                  </span>
                  <span className="ml-auto text-xs text-crm-muted font-mono">{when(r.sentAt)}</span>
                </div>
                {r.error && <div className="text-xs text-red-400 mt-1 ml-7">{r.error}</div>}
              </button>
              {isOpen && (
                <div className="mt-3 ml-7 space-y-2">
                  <div className="text-xs text-crm-muted font-mono">
                    Destination: {r.destination || '—'}
                  </div>
                  <pre className="text-xs whitespace-pre-wrap bg-black/20 border border-crm-border rounded-lg p-3 overflow-x-auto">
                    {r.message}
                  </pre>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
