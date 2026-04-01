import { Inbox } from 'lucide-react';

export default function EmptyState({ icon, title, subtitle }) {
  var Icon = icon || Inbox;
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="w-12 h-12 rounded-xl bg-white/[0.03] border border-crm-border flex items-center justify-center mb-4">
        <Icon className="w-5 h-5 text-crm-muted" />
      </div>
      <p className="text-sm font-display font-medium text-crm-muted">{title || 'No data yet'}</p>
      {subtitle && <p className="text-xs font-mono text-crm-muted/50 mt-1 text-center max-w-xs">{subtitle}</p>}
    </div>
  );
}
