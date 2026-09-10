'use client';

import { useEffect } from 'react';
import { useWorkspace, useWorkspaceList, ALL_WORKSPACES } from '@/lib/workspace-client';
import { getTheme } from '@/lib/theme';
import { applyAccent, clearAccent } from '@/lib/brand-theme';

// Dresses the platform in the active workspace's brand colour. Renders nothing;
// it only writes CSS variables onto <html>, which every component already reads.
export default function BrandTheme() {
  var workspaceId = useWorkspace();
  var workspaces = useWorkspaceList();

  useEffect(function() {
    function apply() {
      // The combined view belongs to no single client, so it stays neutral.
      if (!workspaceId || workspaceId === ALL_WORKSPACES) { clearAccent(); return; }
      var ws = workspaces.filter(function(w) { return w.id === workspaceId; })[0];
      var brand = ws && ws.branding && (ws.branding.accentColor || '');
      if (!brand) { clearAccent(); return; }
      applyAccent(brand, getTheme());
    }

    apply();

    // The readable form of a brand colour depends on what it sits on, so the
    // accent is re-derived whenever the user flips between dark and light.
    if (typeof MutationObserver === 'undefined') return;
    var observer = new MutationObserver(apply);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return function() { observer.disconnect(); };
  }, [workspaceId, workspaces]);

  return null;
}
