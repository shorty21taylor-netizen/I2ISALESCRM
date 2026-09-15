'use client';

import { useState } from 'react';
import { Sparkles, X, AlertTriangle, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/workspace-client';

// On-demand analysis of whatever page it is dropped on. The reading is done by the
// same AIOS tool layer the chat tab uses, so it is bound by the same workspace and
// rep scoping — this component only asks and renders.

var RANGES = [
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'Last 30 days' },
  { id: 'quarter', label: 'Last 90 days' },
  { id: 'year', label: 'Last 365 days' },
];

// The answer comes back with **bold** section headers and - bullets. Rendering it
// as a document rather than a wall of text is most of what makes it readable.
function Rendered({ text }) {
  var blocks = String(text || '').split('\n');
  return (
    <div className="space-y-2">
      {blocks.map(function (line, i) {
        var t = line.trim();
        if (!t) return <div key={i} className="h-1" />;

        var heading = t.match(/^\*\*(.+?)\*\*:?$/);
        if (heading) {
          return (
            <h4 key={i} className="text-sm font-semibold text-crm-text-bright pt-3 first:pt-0">
              {heading[1]}
            </h4>
          );
        }

        var bullet = t.match(/^[-*]\s+(.*)$/);
        var body = bullet ? bullet[1] : t;

        // Inline bold, so a figure called out mid-sentence still reads as one.
        var parts = body.split(/(\*\*[^*]+\*\*)/g).map(function (p, j) {
          if (/^\*\*[^*]+\*\*$/.test(p)) {
            return <strong key={j} className="text-crm-text-bright">{p.slice(2, -2)}</strong>;
          }
          return <span key={j}>{p}</span>;
        });

        if (bullet) {
          return (
            <div key={i} className="flex gap-2 text-sm text-crm-text leading-relaxed">
              <span className="text-crm-accent flex-shrink-0">•</span>
              <span>{parts}</span>
            </div>
          );
        }
        return <p key={i} className="text-sm text-crm-text leading-relaxed">{parts}</p>;
      })}
    </div>
  );
}

export default function AnalyzeReport({ surface, label, defaultRange }) {
  var s1 = useState(false), open = s1[0], setOpen = s1[1];
  var s2 = useState(false), loading = s2[0], setLoading = s2[1];
  var s3 = useState(''), error = s3[0], setError = s3[1];
  var s4 = useState(null), result = s4[0], setResult = s4[1];
  var s5 = useState(defaultRange || 'month'), range = s5[0], setRange = s5[1];

  async function run(rangeId) {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      var res = await apiFetch('/api/aios/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ surface: surface, range: rangeId }),
      });
      var out = await res.json().catch(function () { return {}; });
      if (!res.ok || out.error) {
        setError(out.error || 'The analysis failed (' + res.status + ').');
      } else {
        setResult(out);
      }
    } catch (e) {
      setError(e.message || 'The analysis could not run.');
    }
    setLoading(false);
  }

  function launch() {
    setOpen(true);
    run(range);
  }

  function pick(id) {
    setRange(id);
    run(id);
  }

  return (
    <>
      <button onClick={launch} className="btn-secondary flex items-center gap-2" title={'Analyse ' + (label || 'this page')}>
        <Sparkles className="w-4 h-4" />
        <span>Analyze</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:p-8">
          <div className="glass-card w-full max-w-3xl my-auto">
            <div className="section-header">
              <h3 className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-crm-accent" />
                {label || 'Analysis'}
              </h3>
              <button onClick={function () { setOpen(false); }} className="p-1 rounded hover:bg-white/5" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-4 pt-3 flex flex-wrap gap-2">
              {RANGES.map(function (r) {
                return (
                  <button
                    key={r.id}
                    onClick={function () { pick(r.id); }}
                    disabled={loading}
                    className={'px-3 py-1 rounded-full text-xs border transition ' + (
                      range === r.id
                        ? 'border-crm-accent text-crm-text-bright'
                        : 'border-crm-border/60 text-crm-text-muted hover:text-crm-text'
                    )}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>

            <div className="p-4">
              {loading && (
                <div className="flex items-center gap-3 py-10 justify-center text-crm-text-muted">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Reading the floor&rsquo;s numbers&hellip; this takes up to a minute.</span>
                </div>
              )}

              {!loading && error && (
                <div className="flex items-start gap-2 text-sm text-crm-negative py-6">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {!loading && !error && result && (
                <>
                  <Rendered text={result.text} />
                  {result.trace && result.trace.length > 0 && (
                    <p className="mt-6 pt-3 border-t border-crm-border/40 text-[11px] text-crm-text-muted">
                      Checked: {result.trace.map(function (t) { return t.tool; }).join(', ')}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
