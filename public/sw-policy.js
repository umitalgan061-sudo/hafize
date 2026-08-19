(function exposeHafizeSwPolicy(root, factory) {
  'use strict';

  const api = factory();
  if (typeof module === 'object' && module?.exports) {
    module.exports = api;
  } else {
    root.HafizeSwPolicy = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeSwPolicy() {
  'use strict';

  const CACHE_PREFIX = 'hafize-shell-';
  const CURRENT_CACHE = `${CACHE_PREFIX}v125`;
  const SHELL_ASSETS = Object.freeze([
    '/',
    '/index.html',
    '/offline.html',
    '/styles.css',
    '/premium.css',
    '/cloud-session-ui.css',
    '/memory-ui.css',
    '/voice-output.css',
    '/screen-share.css',
    '/screen-analysis-consent.css',
    '/hands-free.css',
    '/hands-free-consent.css',
    '/chat-run-controller.css',
    '/conversation-insights.css',
    '/conversation-reading-controls.css',
    '/app.js',
    '/chat-run-controller.js',
    '/message-copy.js',
    '/message-edit.js',
    '/keyboard-shortcuts.js',
    '/conversation-search.js',
    '/conversation-search-snippets.js',
    '/conversation-search-navigation.js',
    '/scroll-to-latest.js',
    '/composer-limit-feedback.js',
    '/mobile-sidebar-dismiss.js',
    '/draft-clear-undo.js',
    '/draft-navigation-guard.js',
    '/conversation-keyboard-nav.js',
    '/conversation-delete-confirm.js',
    '/shortcut-help.js',
    '/network-status.js',
    '/conversation-copy.js',
    '/in-chat-find.js',
    '/safe-markdown-render.js',
    '/code-block-copy.js',
    '/conversation-export.js',
    '/response-fold.js',
    '/code-block-focus.js',
    '/composer-history.js',
    '/code-block-download.js',
    '/text-file-import-style.js',
    '/text-file-import.js',
    '/text-file-import.css',
    '/composer-paste-guard.js',
    '/message-timeline.js',
    '/message-keyboard-nav.js',
    '/model-selector-enhancement.js',
    '/response-progress.js',
    '/conversation-model-state.js',
    '/conversation-branch-lineage.js',
    '/conversation-fork.js',
    '/schedule-runtime-status-style.js',
    '/schedule-runtime-status.js',
    '/schedule-runtime-status.css',
    '/schedule-list.js',
    '/schedule-list.css',
    '/schedule-list-filter.js',
    '/schedule-list-filter.css',
    '/schedule-scope-counts-ui.js',
    '/schedule-create.js',
    '/schedule-create.css',
    '/schedule-cancel.js',
    '/schedule-cancel.css',
    '/schedule-reschedule.js',
    '/schedule-reschedule.css',
    '/schedule-retry-policy.js',
    '/schedule-retry-policy.css',
    '/desktop-device-status.js',
    '/desktop-device-status.css',
    '/github-write-readiness-style.js',
    '/github-write-readiness.js',
    '/github-write-readiness.css',
    '/github-branch-create-style.js',
    '/github-branch-create.js',
    '/github-branch-create.css',
    '/github-draft-pr-create-style.js',
    '/github-draft-pr-create.js',
    '/github-draft-pr-create.css',
    '/github-file-update-style.js',
    '/github-file-update.js',
    '/github-file-update.css',
    '/github-write-activity-style.js',
    '/github-write-activity.js',
    '/github-write-activity.css',
    '/github-pr-merge-style.js',
    '/github-pr-merge.js',
    '/github-pr-merge.css',
    '/response-retry-style.js',
    '/response-retry.js',
    '/response-retry.css',
    '/reading-focus.js',
    '/reading-focus.css',
    '/conversation-outline.js',
    '/conversation-outline.css',
    '/conversation-organize.js',
    '/conversation-organize.css',
    '/canva-connection-status-style.js',
    '/canva-connection-status.js',
    '/canva-connection-status.css',
    '/canva-session-sync.js',
    '/gmail-workspace-style.js',
    '/gmail-workspace.js',
    '/gmail-workspace.css',
    '/memory-consent-review.js',
    '/memory-consent-review.css',
    '/cloud-session-ui.js',
    '/memory-ui.js',
    '/voice-input.js',
    '/voice-output.js',
    '/screen-analysis-client.js',
    '/screen-analysis-ui.js',
    '/screen-share.js',
    '/hands-free-consent.js',
    '/hands-free.js',
    '/conversation-storage-guard.js',
    '/ui-shell.js',
    '/sw-policy.js',
    '/manifest.webmanifest',
    '/hafize.jpeg'
  ]);
  const SHELL_PATHS = new Set(SHELL_ASSETS);

  function readHeader(headers, name) {
    if (!headers) return '';
    if (typeof headers.get === 'function') return headers.get(name) || '';
    const target = name.toLowerCase();
    for (const [key, value] of Object.entries(headers)) {
      if (key.toLowerCase() === target) return String(value ?? '');
    }
    return '';
  }

  function isSameOriginUrl(url, origin) {
    if (typeof origin !== 'string' || !origin) return false;
    try {
      return new URL(url, origin).origin === origin;
    } catch {
      return false;
    }
  }

  function pathnameFor(url, origin) {
    try {
      return new URL(url, origin).pathname;
    } catch {
      return '';
    }
  }

  function classifyRequest(request, origin) {
    if (!request || String(request.method || 'GET').toUpperCase() !== 'GET') return 'ignore';
    if (!isSameOriginUrl(request.url, origin)) return 'ignore';
    if (readHeader(request.headers, 'range')) return 'ignore';

    const pathname = pathnameFor(request.url, origin);
    if (!pathname) return 'ignore';
    if (pathname.startsWith('/api/')) return 'network-only';

    const acceptsHtml = readHeader(request.headers, 'accept').toLowerCase().includes('text/html');
    if (request.mode === 'navigate' || acceptsHtml) return 'navigation';
    if (SHELL_PATHS.has(pathname)) return 'shell';
    return 'network-only';
  }

  function shouldDeleteCache(cacheName) {
    return typeof cacheName === 'string'
      && cacheName.startsWith(CACHE_PREFIX)
      && cacheName !== CURRENT_CACHE;
  }

  return Object.freeze({
    CACHE_PREFIX,
    CURRENT_CACHE,
    SHELL_ASSETS,
    classifyRequest,
    isSameOriginUrl,
    shouldDeleteCache
  });
});