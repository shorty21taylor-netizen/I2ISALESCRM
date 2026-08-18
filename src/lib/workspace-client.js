'use client';
// Client-side active-workspace state. Persists the selection and broadcasts changes
// so every mounted page refetches against the newly selected company.

import { useState, useEffect } from 'react';
import { getUser } from '@/lib/auth';

export var ALL_WORKSPACES = '__all__';

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

// Append ?workspace=<id> to an API path. Omitted for the combined view so existing
// unscoped behaviour is preserved exactly.
export function withWorkspace(path, workspaceId) {
  var id = workspaceId || getActiveWorkspace();
  if (!id || id === ALL_WORKSPACES) return path;
  return path + (path.indexOf('?') === -1 ? '?' : '&') + 'workspace=' + encodeURIComponent(id);
}

// Active workspace id, re-rendering on change. Null on the server and on the first
// client render so SSR markup matches — callers should skip fetching until non-null.
export function useWorkspace() {
  var s = useState(null), workspaceId = s[0], setWorkspaceId = s[1];

  useEffect(function() {
    setWorkspaceId(getActiveWorkspace());

    function onChange(e) { setWorkspaceId(e.detail || getActiveWorkspace()); }
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

export function useWorkspaceList() {
  var s = useState([]), workspaces = s[0], setWorkspaces = s[1];

  useEffect(function() {
    var cancelled = false;
    fetch('/api/workspaces')
      .then(function(r) { return r.json(); })
      .then(function(d) { if (!cancelled && d.success) setWorkspaces(d.workspaces || []); })
      .catch(function() {});
    return function() { cancelled = true; };
  }, []);

  return workspaces;
}


// Every API call identifies the caller so the server can pin them to their own
// workspace. Pass this to fetch() as the options object.
export function authFetchOptions(extra) {
  var user = null;
  try { user = getUser(); } catch (e) { user = null; }
  var headers = Object.assign({}, (extra && extra.headers) || {});
  if (user && user.email) headers['x-user-email'] = user.email;
  return Object.assign({}, extra, { headers: headers });
}

// fetch() that always carries the caller's identity.
export function apiFetch(path, options) {
  return fetch(path, authFetchOptions(options));
}

// The caller's access profile: which workspaces they may use, and whether they are
// the owner. Non-owners get exactly one workspace and no combined view.
export function useAccess() {
  var s = useState(null), access = s[0], setAccess = s[1];

  useEffect(function() {
    var cancelled = false;
    apiFetch('/api/auth/me')
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (cancelled || !d.success) return;
        setAccess(d);
        // Never leave someone viewing a workspace they cannot access. Someone in
        // several keeps their choice as long as it is one of theirs.
        if (!d.canSeeAll) {
          var allowed = d.workspaceIds || [];
          var current = getActiveWorkspace();
          if (allowed.indexOf(current) === -1) {
            setActiveWorkspace(allowed[0] || 'default');
          }
        }
      })
      .catch(function() {});
    return function() { cancelled = true; };
  }, []);

  return access;
}
