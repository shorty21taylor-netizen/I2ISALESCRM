'use client';
import { AlertTriangle, X } from 'lucide-react';

export default function ConfirmDialog({ open, title, message, confirmLabel, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
      <div className="glass-card max-w-md w-full p-6">
        <div className="flex items-start gap-4 mb-4">
          <div className="p-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', border: '0.5px solid rgba(239,68,68,0.3)' }}>
            <AlertTriangle className="w-5 h-5 text-crm-negative" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-display font-bold text-crm-text-bright">{title || 'Are you sure?'}</h3>
            <p className="text-sm text-crm-muted mt-1">{message || 'This action cannot be undone.'}</p>
          </div>
          <button onClick={onCancel} className="text-crm-muted hover:text-crm-text">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-3 mt-6">
          <button onClick={onCancel} className="btn-ghost flex-1">Cancel</button>
          <button onClick={onConfirm} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-display font-semibold text-white" style={{ background: 'var(--crm-negative)' }}>
            {confirmLabel || 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
