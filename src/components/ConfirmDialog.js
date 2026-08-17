'use client';

import { AlertTriangle } from 'lucide-react';

export default function ConfirmDialog(props) {
  if (!props.open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)' }}>
      <div className="glass-card w-full max-w-sm p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="p-2 rounded-lg flex-shrink-0" style={{ background: 'rgba(var(--accent-rgb),0.1)' }}>
            <AlertTriangle className="w-5 h-5" style={{ color: 'var(--crm-accent)' }} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-display font-bold" style={{ color: 'var(--crm-text-bright)' }}>{props.title || 'Are you sure?'}</h3>
            {props.message && (
              <p className="text-xs font-mono mt-1" style={{ color: 'var(--crm-text-muted)' }}>{props.message}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={props.onCancel} className="btn-ghost flex-1">Cancel</button>
          <button
            onClick={props.onConfirm}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-display font-bold text-white"
            style={{ background: 'var(--crm-accent)' }}
          >
            {props.confirmLabel || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
