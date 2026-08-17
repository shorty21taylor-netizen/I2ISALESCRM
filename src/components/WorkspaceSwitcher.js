'use client';
import { useState, useEffect, useRef } from 'react';
import { Building2, Check, ChevronDown, Layers } from 'lucide-react';
import { ALL_WORKSPACES } from '@/lib/workspaces';
import { useWorkspace, useWorkspaceList, setActiveWorkspace } from '@/lib/workspace-client';

export default function WorkspaceSwitcher({ collapsed }) {
  var activeId = useWorkspace();
  var workspaces = useWorkspaceList();
  var s = useState(false), open = s[0], setOpen = s[1];
  var boxRef = useRef(null);

  useEffect(function() {
    if (!open) return;
    function onDocClick(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return function() {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function choose(id) {
    setActiveWorkspace(id);
    setOpen(false);
  }

  var active = null;
  for (var i = 0; i < workspaces.length; i++) {
    if (workspaces[i].id === activeId) active = workspaces[i];
  }
  var isAll = !activeId || activeId === ALL_WORKSPACES;
  var label = isAll ? 'All Workspaces' : (active ? active.name : 'Loading…');
  var badge = isAll ? 'ALL' : (active ? (active.shortName || active.name).substring(0, 4).toUpperCase() : '—');

  if (collapsed) {
    return (
      <div className="px-2 py-2">
        <button
          onClick={function() { setOpen(!open); }}
          title={label}
          className="w-full flex items-center justify-center h-9 rounded-lg glass-surface text-crm-muted hover:text-crm-text transition-colors"
        >
          {isAll ? <Layers className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
        </button>
      </div>
    );
  }

  return (
    <div ref={boxRef} className="relative px-2 py-2">
      <button
        onClick={function() { setOpen(!open); }}
        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl glass-surface text-left transition-colors"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="flex items-center justify-center w-7 h-7 rounded-lg flex-shrink-0 font-mono text-[9px] font-bold"
          style={{ background: 'var(--section-tag-bg)', border: '0.5px solid var(--section-tag-border)', color: 'var(--crm-text-bright)' }}>
          {badge}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-mono uppercase tracking-wider text-crm-muted">Workspace</span>
          <span className="block text-xs font-medium text-crm-text-bright truncate">{label}</span>
        </span>
        <ChevronDown className={'w-3.5 h-3.5 text-crm-muted flex-shrink-0 transition-transform ' + (open ? 'rotate-180' : '')} />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-2 right-2 mt-1 z-[70] rounded-xl overflow-hidden glass-card"
          style={{ maxHeight: '320px', overflowY: 'auto' }}
        >
          <button
            role="option"
            aria-selected={isAll}
            onClick={function() { choose(ALL_WORKSPACES); }}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-white/5 transition-colors"
          >
            <Layers className="w-4 h-4 text-crm-muted flex-shrink-0" />
            <span className="flex-1 min-w-0">
              <span className="block text-xs font-medium text-crm-text-bright">All Workspaces</span>
              <span className="block text-[10px] text-crm-muted">Combined view across companies</span>
            </span>
            {isAll && <Check className="w-3.5 h-3.5 text-crm-text-bright flex-shrink-0" />}
          </button>

          <hr className="divider" />

          {workspaces.map(function(ws) {
            var selected = ws.id === activeId;
            return (
              <button
                key={ws.id}
                role="option"
                aria-selected={selected}
                onClick={function() { choose(ws.id); }}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-white/5 transition-colors"
              >
                <Building2 className="w-4 h-4 text-crm-muted flex-shrink-0" />
                <span className="flex-1 min-w-0">
                  <span className="block text-xs font-medium text-crm-text-bright truncate">{ws.name}</span>
                  <span className="block text-[10px] text-crm-muted truncate">
                    {(ws.offers || []).length} offer{(ws.offers || []).length === 1 ? '' : 's'} &middot; {Math.round((ws.commissionRate || 0) * 1000) / 10}% commission
                  </span>
                </span>
                {selected && <Check className="w-3.5 h-3.5 text-crm-text-bright flex-shrink-0" />}
              </button>
            );
          })}

          {workspaces.length === 0 && (
            <div className="px-3 py-3 text-xs text-crm-muted">No workspaces yet</div>
          )}
        </div>
      )}
    </div>
  );
}
