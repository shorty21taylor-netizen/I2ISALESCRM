'use client';

import { useState, useEffect, useRef } from 'react';
import { Palette, Save, Upload, Trash2 } from 'lucide-react';
import { useWorkspace, apiFetch, ALL_WORKSPACES } from '@/lib/workspace-client';
import { getTheme } from '@/lib/theme';
import { applyAccent, clearAccent, accentVars, contrast, isValidHex } from '@/lib/brand-theme';

// A workspace's identity: the mark and name on its exported report, and the brand
// colour the whole platform wears while that workspace is active.

var MAX_BYTES = 400 * 1024;

// Somewhere to start for a workspace that has not picked. Not a limit — the
// colour input takes anything.
var SWATCHES = [
  '#3D7BFF', '#38BDF8', '#7C6BFF', '#22C55E',
  '#F59E0B', '#EF4444', '#EC4899', '#14B8A6',
];

export default function ReportBrandingCard() {
  var workspaceId = useWorkspace();
  var fileRef = useRef(null);
  var s1 = useState(null), branding = s1[0], setBranding = s1[1];
  var s2 = useState(''), logoUrl = s2[0], setLogoUrl = s2[1];
  var s3 = useState(''), reportName = s3[0], setReportName = s3[1];
  var s4 = useState(''), wsName = s4[0], setWsName = s4[1];
  var s4b = useState(''), accent = s4b[0], setAccent = s4b[1];
  var s5 = useState(''), error = s5[0], setError = s5[1];
  var s6 = useState(false), saving = s6[0], setSaving = s6[1];
  var s7 = useState(false), saved = s7[0], setSaved = s7[1];

  var scoped = workspaceId && workspaceId !== ALL_WORKSPACES;
  var theme = typeof window === 'undefined' ? 'dark' : getTheme();
  var preview = accent && isValidHex(accent) ? accentVars(accent, theme) : null;
  var readable = preview
    ? contrast(preview['--crm-accent'], theme === 'light' ? '#ffffff' : '#161616').toFixed(1)
    : '';

  useEffect(function() {
    if (!scoped) return;
    apiFetch('/api/workspaces/' + workspaceId)
      .then(function(r) { return r.json(); })
      .then(function(json) {
        var ws = json && json.workspace;
        if (!ws) return;
        setBranding(ws.branding || {});
        setLogoUrl((ws.branding && ws.branding.logoUrl) || '');
        setReportName((ws.branding && ws.branding.reportName) || '');
        setAccent((ws.branding && ws.branding.accentColor) || '');
        setWsName(ws.name || '');
      })
      .catch(function() { setError('Could not load the workspace'); });
  }, [workspaceId, scoped]);

  function onFile(e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    setError('');
    if (file.size > MAX_BYTES) {
      setError('That image is ' + Math.round(file.size / 1024) + 'KB. Keep it under 400KB — a PNG or SVG of the mark is plenty.');
      return;
    }
    var reader = new FileReader();
    reader.onload = function() { setLogoUrl(String(reader.result)); setSaved(false); };
    reader.onerror = function() { setError('Could not read that file'); };
    reader.readAsDataURL(file);
  }

  function save() {
    if (!scoped) return;
    setSaving(true);
    setError('');
    // Merge, never replace: the workspace's colours live in the same object.
    if (accent && !isValidHex(accent)) {
      setSaving(false);
      setError('That is not a colour. Use a six-digit hex like #3D7BFF.');
      return;
    }
    var next = Object.assign({}, branding, {
      logoUrl: logoUrl,
      reportName: reportName,
      accentColor: accent,
    });
    apiFetch('/api/workspaces/' + workspaceId, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branding: next }),
    })
      .then(function(r) { return r.json(); })
      .then(function(json) {
        setSaving(false);
        if (!json.success) { setError(json.error || 'Could not save'); return; }
        setBranding(next);
        // Wear it immediately rather than making them reload to see it.
        if (accent) applyAccent(accent, getTheme()); else clearAccent();
        setSaved(true);
        setTimeout(function() { setSaved(false); }, 2500);
      })
      .catch(function() { setSaving(false); setError('Could not reach the server'); });
  }

  return (
    <div className="glass-card overflow-hidden stagger-2">
      <div className="section-header">
        <h3><Palette className="w-4 h-4 text-crm-accent" /> Workspace Branding</h3>
        <span className="section-tag">Logo, name and accent</span>
      </div>
      <div className="p-5">
        {!scoped ? (
          <p className="text-xs text-crm-muted">
            Pick a single workspace in the switcher to brand it. Colours and logos belong to a
            workspace, so the combined view stays neutral.
          </p>
        ) : (
          <div className="space-y-5">
            <div>
              <div className="text-sm font-medium text-crm-text-bright">Brand colour</div>
              <div className="text-xs text-crm-muted mt-1">
                The accent this workspace wears across the platform. Your dark or light theme is
                still your own choice — this rides on top of it.
              </div>

              <div className="flex flex-wrap items-center gap-2 mt-3">
                <input
                  type="color"
                  value={isValidHex(accent) ? accent : '#3d7bff'}
                  onChange={function(e) { setAccent(e.target.value.toUpperCase()); setSaved(false); }}
                  className="w-11 h-9 rounded-lg bg-transparent border border-crm-border cursor-pointer p-1"
                  aria-label="Brand colour"
                />
                <input
                  value={accent}
                  placeholder="#3D7BFF"
                  onChange={function(e) { setAccent(e.target.value.toUpperCase()); setSaved(false); }}
                  className="w-32 h-9 px-3 rounded-lg text-sm font-mono bg-crm-bg border border-crm-border text-crm-text"
                />
                {SWATCHES.map(function(hex) {
                  return (
                    <button
                      key={hex}
                      onClick={function() { setAccent(hex); setSaved(false); }}
                      title={hex}
                      aria-label={'Use ' + hex}
                      className={'w-7 h-7 rounded-full border transition-transform hover:scale-110 '
                        + (accent === hex ? 'border-crm-text-bright' : 'border-crm-border')}
                      style={{ background: hex }}
                    />
                  );
                })}
                {accent ? (
                  <button
                    onClick={function() { setAccent(''); setSaved(false); }}
                    className="px-3 h-9 rounded-lg text-xs font-mono border border-crm-border text-crm-muted hover:text-crm-text"
                  >
                    Reset to neutral
                  </button>
                ) : null}
              </div>

              {preview ? (
                <div className="flex flex-wrap items-center gap-3 mt-3">
                  <span
                    className="inline-flex items-center h-8 px-4 rounded-full text-xs font-mono"
                    style={{
                      background: 'rgba(' + preview['--accent-rgb'] + ',0.14)',
                      color: preview['--crm-accent'],
                      border: '1px solid rgba(' + preview['--accent-rgb'] + ',0.35)',
                    }}
                  >
                    Accent on your theme
                  </span>
                  <span
                    className="inline-flex items-center h-8 px-4 rounded-full text-xs font-display font-bold"
                    style={{ background: preview['--btn-primary-bg'], color: preview['--btn-primary-fg'] }}
                  >
                    Button
                  </span>
                  <span className="text-[11px] font-mono text-crm-muted">
                    reads at {readable} : 1
                    {preview['--crm-accent'].toLowerCase() !== accent.toLowerCase()
                      ? ' · lightened to stay legible on this theme'
                      : ''}
                  </span>
                </div>
              ) : null}
            </div>

            <div className="flex items-center gap-4">
              <div
                className="flex items-center justify-center rounded-xl border overflow-hidden"
                style={{ width: 84, height: 84, borderColor: 'var(--crm-border)', background: 'var(--glass-surface-bg)' }}
              >
                {logoUrl
                  ? <img src={logoUrl} alt="Report logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                  : <span className="text-[10px] font-mono text-crm-muted text-center px-2">No logo set</span>}
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-crm-text-bright">Logo</div>
                <div className="text-xs text-crm-muted mt-1">
                  PNG or SVG, under 400KB. It heads every exported report and prints at about half an inch tall.
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <button
                    onClick={function() { fileRef.current && fileRef.current.click(); }}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-mono border border-crm-border text-crm-text hover:text-crm-text-bright"
                  >
                    <Upload className="w-3.5 h-3.5" /> Upload
                  </button>
                  {logoUrl ? (
                    <button
                      onClick={function() { setLogoUrl(''); setSaved(false); }}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-mono border border-crm-border text-crm-muted hover:text-crm-negative"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Remove
                    </button>
                  ) : null}
                  <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
                </div>
              </div>
            </div>

            <label className="block">
              <span className="block text-[10px] font-mono uppercase tracking-wider text-crm-muted mb-1.5">Or paste an image URL</span>
              <input
                value={logoUrl.indexOf('data:') === 0 ? '' : logoUrl}
                placeholder="https://…/logo.png"
                onChange={function(e) { setLogoUrl(e.target.value); setSaved(false); }}
                className="w-full h-9 px-3 rounded-lg text-sm bg-crm-bg border border-crm-border text-crm-text"
              />
            </label>

            <label className="block">
              <span className="block text-[10px] font-mono uppercase tracking-wider text-crm-muted mb-1.5">Name on the report</span>
              <input
                value={reportName}
                placeholder={wsName || 'Your company'}
                onChange={function(e) { setReportName(e.target.value); setSaved(false); }}
                className="w-full h-9 px-3 rounded-lg text-sm bg-crm-bg border border-crm-border text-crm-text"
              />
              <span className="block text-[11px] text-crm-muted mt-1.5">
                Leave blank to use the workspace name{wsName ? ' (' + wsName + ')' : ''}.
              </span>
            </label>

            {error ? <p className="text-xs text-crm-negative">{error}</p> : null}

            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-mono bg-crm-accent/15 text-crm-accent border border-crm-accent/30 disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" /> {saving ? 'Saving…' : saved ? 'Saved' : 'Save branding'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
