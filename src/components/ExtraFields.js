'use client';

// Renders a record's `extra` bucket — every answer the normalizer did not recognise,
// keyed by the question exactly as the rep saw it.
//
// This is the structural guard against silent data loss: when a form gains a field
// that `src/lib/form-ingest.js` has no mapping for, it shows up here looking out of
// place instead of disappearing into Postgres JSONB forever.

export default function ExtraFields(props) {
  var extra = props.extra;
  if (!extra) return null;
  var keys = Object.keys(extra).filter(function(k) {
    return extra[k] !== '' && extra[k] !== null && extra[k] !== undefined;
  });
  if (keys.length === 0) return null;

  return (
    <div className="mt-3 pt-2" style={{ borderTop: '0.5px solid var(--crm-divider)' }}>
      <p className="text-[9px] font-mono uppercase mb-1.5" style={{ color: 'var(--crm-text-muted)' }}>
        {props.label || 'Other answers'}
      </p>
      <div className="space-y-1">
        {keys.map(function(k) {
          return (
            <div key={k} className="text-xs font-mono">
              <span style={{ color: 'var(--crm-text-muted)' }}>{k}: </span>
              <span className="whitespace-pre-wrap" style={{ color: 'var(--crm-text-bright)' }}>{String(extra[k])}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
