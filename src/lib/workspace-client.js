'use client';
// Client-side active-workspace state. Persists the selection to localStorage and
// broadcasts changes so every mounted page refetches against the new tenant.

import { useState, useEffect } from 'react';
import { ALL_WORKSPACES } from '@/lib/workspaces';

var STORAGE_KEY = 'summit-crm-workspace';
var EVENT = 'summit-workspace-change';

export function getActiveWorkspace() {
  if (typeof window === 'undefined') return ALL_WORKSPACES;
  try {
    return localStorage.getItem(STORAGE_KEY) || ALL_WORKSPACES;
  } catch (e) {
    return ALL_WORKSPACES;
  }
}

export function setActiveWorkspace(id) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch (e) {
    // Storage can be unavailable (private mode); the event still drives this tab.
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: id }));
}

// Append ?workspace=<id> to an API path. Omitted when viewing all workspaces so
// existing unscoped behaviour is preserved.
export function withWorkspace(path, workspaceId) {
  var id = workspaceId || getActiveWorkspace();
  if (!id || id === ALL_WORKSPACES) return path;
  return path + (path.indexOf('?') === -1 ? '?' : '&') + 'workspace=' + encodeURIComponent(id);
}

// Returns the active workspace id, re-rendering whenever it changes.
// Starts as null on the server and on the first client render so SSR markup
// matches; callers should skip fetching until it is non-null.
export function useWorkspace() {
  var s = useState(null), workspaceId = s[0], setWorkspaceId = s[1];

  useEffect(function() {
    setWorkspaceId(getActiveWorkspace());

    function onChange(e) {
      setWorkspaceId(e.detail || getActiveWorkspace());
    }
    function onStorage(e) {
      if (e.key === STORAGE_KEY) setWorkspaceId(e.newValue || ALL_WORKSPACES);
    }

    window.addEventListener(EVENT, onChange);
    window.addEventListener('storage', onStorage);
    return function() {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return workspaceId;
}

// Loads the workspace registry from the API once per mount.
export function useWorkspaceList() {
  var s = useState([]), workspaces = s[0], setWorkspaces = s[1];

  useEffect(function() {
    var cancelled = false;
    fetch('/api/workspaces')
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (!cancelled && d.success) setWorkspaces(d.workspaces || []);
      })
      .catch(function() {});
    return function() { cancelled = true; };
  }, []);

  return workspaces;
}
