(function exposeHafizeSwPolicy(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module?.exports) module.exports = api;
  else root.HafizeSwPolicy = api;
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeSwPolicy() {
  'use strict';
  const CACHE_PREFIX = 'hafize-shell-';
  const CURRENT_CACHE = `${CACHE_PREFIX}v50`;
  const SHELL_ASSETS = Object.freeze([
    '/', '/index.html', '/offline.html',
    '/scheduled-task-preview.css', '/scheduled-task-duplicate.css', '/scheduled-task-templates.css', '/scheduled-task-planning.css', '/scheduled-task-templates-backup.css', '/scheduled-task-status-summary.css', '/scheduled-task-preview-activity.css', '/scheduled-task-template-presets.css', '/scheduled-task-draft.css', '/scheduled-task-insights.css', '/scheduled-task-actions.css', '/scheduled-task-detail.css', '/scheduled-task-templates-backup.css',
    '/styles.css', '/premium.css', '/voice-output.css', '/screen-share.css', '/hands-free.css',
    '/workspace-navigation.css', '/chat-composer-features.css', '/chat-history-search.css', '/chat-history-export.css',
    '/settings-workspace.css', '/chat-history-management.css', '/chat-drafts.css',
    '/conversation-workspace.css', '/conversation-workspace-keyboard.css', '/conversation-forks.css', '/message-workspace.css',
    '/prompt-library.css', '/model-preferences.css', '/typed-build/legacy-prompt-library-safety.js', '/typed-build/legacy-prompt-library-import-preview.js', '/typed-build/legacy-prompt-library-diagnostics.js', '/prompt-library-smart-fill.css', '/prompt-library-command-palette.css',
    '/prompt-library-collections.css', '/prompt-library-revisions.css', '/workspace-backup.css', '/github-workspace.css', '/github-workspace-extra.css', '/github-workspace-actions.css', '/github-workspace-details.css', '/github-workspace-write.css', '/connector-hub.css', '/composer-history.css', '/scheduled-tasks.css', '/hafize-runtime.css',
    '/prompt-library-smart-insert.css', '/prompt-library-smart-insert-center.css', '/prompt-library-smart-insert-history.css', '/prompt-library-smart-insert-suggestions.css', '/prompt-library-smart-insert-activity.css',
    '/typed-build/auth.js', '/typed-build/app-shell.js', '/typed-build/ui-shell.js', '/typed-build/voice-input.js', '/typed-build/voice-output.js', '/typed-build/legacy-chat-composer-features.js', '/typed-build/legacy-chat-history-search.js', '/typed-build/legacy-chat-history-export.js',
    '/typed-build/legacy-chat-history-management.js', '/typed-build/legacy-chat-drafts.js', '/typed-build/conversation-workspace.js', '/typed-build/conversation-forks.js', '/typed-build/message-workspace.js', '/typed-build/legacy-conversation-workspace-keyboard.js',
    '/typed-build/legacy-message-workspace-policy.js', '/message-workspace.js',
    '/typed-build/prompt-library.js', '/typed-build/legacy-prompt-library-starters.js', '/typed-build/legacy-prompt-library-enhancements.js', '/typed-build/legacy-prompt-library-keyboard.js',
    '/typed-build/legacy-prompt-library-usage.js', '/typed-build/legacy-prompt-library-collections.js', '/typed-build/legacy-prompt-library-collections-enhancements.js',
    '/typed-build/legacy-prompt-library-revisions.js', '/typed-build/legacy-prompt-library-revisions-enhancements.js', '/typed-build/legacy-prompt-library-smart-insert.js', '/typed-build/legacy-prompt-library-smart-insert-center.js',
    '/typed-build/legacy-prompt-library-smart-insert-history.js', '/typed-build/legacy-prompt-library-smart-insert-history-bridge.js', '/typed-build/legacy-prompt-library-smart-insert-suggestions.js', '/typed-build/legacy-prompt-library-smart-insert-shortcuts.js', '/typed-build/legacy-prompt-library-smart-insert-presets.js', '/typed-build/legacy-prompt-library-smart-insert-validation.js', '/typed-build/legacy-prompt-library-smart-insert-activity.js',
    '/typed-build/legacy-composer-history.js', '/typed-build/legacy-composer-history-panel.js', '/typed-build/legacy-composer-history-backup.js', '/typed-build/legacy-composer-history-help.js', '/typed-build/legacy-composer-history-settings.js',
    '/typed-build/scheduled-tasks.js', '/typed-build/legacy-scheduled-tasks-enhancements.js', '/typed-build/legacy-scheduled-tasks-keyboard.js', '/typed-build/legacy-scheduled-task-preview.js', '/typed-build/legacy-scheduled-task-duplicate.js', '/typed-build/legacy-scheduled-task-templates.js', '/typed-build/legacy-scheduled-task-planning.js', '/typed-build/legacy-scheduled-task-templates-backup.js', '/typed-build/legacy-scheduled-task-status-summary.js', '/typed-build/legacy-scheduled-task-preview-activity.js', '/typed-build/legacy-scheduled-task-template-presets.js', '/typed-build/legacy-scheduled-task-draft.js', '/typed-build/legacy-scheduled-task-insights.js', '/typed-build/legacy-scheduled-task-actions.js', '/typed-build/legacy-scheduled-task-detail.js', '/typed-build/legacy-scheduled-task-export.js', '/typed-build/legacy-scheduled-task-templates-backup.js',
    '/voice-input.js', '/voice-output.js', '/typed-build/legacy-hands-free.js', '/typed-build/legacy-hands-free-background-guard.js', '/typed-build/legacy-screen-share.js',
    '/typed-build/legacy-settings-workspace.js', '/typed-build/legacy-workspace-navigation.js', '/ui-shell.js',
    '/typed-build/app-runtime.js', '/typed-build/prompt-library-smart-fill.js', '/typed-build/prompt-library-command-palette.js',
    '/typed-build/prompt-library-smart-fill-hints.js', '/typed-build/workspace-backup.js', '/typed-build/github-workspace.js', '/typed-build/github-workspace-extra.js', '/typed-build/github-workspace-actions.js', '/typed-build/github-workspace-details.js', '/typed-build/github-workspace-write.js', '/typed-build/scheduled-tasks-countdown.js',
    '/sw-policy.js', '/manifest.webmanifest', '/hafize.jpeg'
  ]);
  const SHELL_PATHS = new Set(SHELL_ASSETS);
  function readHeader(headers, name) {
    if (!headers) return '';
    if (typeof headers.get === 'function') return headers.get(name) || '';
    const target = name.toLowerCase();
    for (const [key, value] of Object.entries(headers)) if (key.toLowerCase() === target) return String(value ?? '');
    return '';
  }
  function isSameOriginUrl(url, origin) {
    if (typeof origin !== 'string' || !origin) return false;
    try { return new URL(url, origin).origin === origin; } catch { return false; }
  }
  function pathnameFor(url, origin) { try { return new URL(url, origin).pathname; } catch { return ''; } }
  function classifyRequest(request, origin) {
    if (!request || String(request.method || 'GET').toUpperCase() !== 'GET') return 'ignore';
    if (!isSameOriginUrl(request.url, origin)) return 'ignore';
    if (readHeader(request.headers, 'range')) return 'ignore';
    const pathname = pathnameFor(request.url, origin);
    if (!pathname) return 'ignore';
    if (pathname.startsWith('/api/')) return 'network-only';
    if (request.mode === 'navigate' || readHeader(request.headers, 'accept').toLowerCase().includes('text/html')) return 'navigation';
    if (SHELL_PATHS.has(pathname)) return 'shell';
    return 'network-only';
  }
  function shouldDeleteCache(cacheName) { return typeof cacheName === 'string' && cacheName.startsWith(CACHE_PREFIX) && cacheName !== CURRENT_CACHE; }
  return Object.freeze({ CACHE_PREFIX, CURRENT_CACHE, SHELL_ASSETS, classifyRequest, isSameOriginUrl, shouldDeleteCache });
});