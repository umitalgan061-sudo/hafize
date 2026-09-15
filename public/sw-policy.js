(function exposeHafizeSwPolicy(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module?.exports) module.exports = api;
  else root.HafizeSwPolicy = api;
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeSwPolicy() {
  'use strict';
  const CACHE_PREFIX = 'hafize-shell-';
  const CURRENT_CACHE = `${CACHE_PREFIX}v31`;
  const SHELL_ASSETS = Object.freeze([
    '/', '/index.html', '/offline.html', '/styles.css', '/premium.css', '/voice-output.css', '/screen-share.css', '/hands-free.css',
    '/workspace-navigation.css', '/chat-composer-features.css', '/chat-history-search.css', '/chat-history-export.css', '/chat-history-management.css',
    '/settings-workspace.css', '/chat-drafts.css', '/conversation-workspace.css', '/conversation-workspace-keyboard.css', '/message-workspace.css',
    '/prompt-library.css', '/prompt-library-smart-fill.css', '/prompt-library-command-palette.css', '/composer-history.css', '/local-data-center.css', '/auth.js', '/app.js', '/chat-composer-features.js', '/chat-history-search.js', '/chat-history-export.js',
    '/chat-history-management.js', '/chat-drafts.js', '/conversation-workspace.js', '/conversation-workspace-keyboard.js', '/message-workspace-policy.js',
    '/message-workspace.js', '/prompt-library.js', '/prompt-library-starters.js', '/prompt-library-enhancements.js', '/prompt-library-keyboard.js', '/prompt-library-usage.js',
    '/prompt-library-smart-fill.js', '/prompt-library-command-palette.js', '/prompt-library-smart-fill-hints.js', '/composer-history.js', '/composer-history-panel.js',
    '/composer-history-backup.js', '/composer-history-help.js', '/composer-history-settings.js', '/local-data-center.js', '/voice-input.js', '/voice-output.js', '/screen-share.js', '/hands-free.js', '/hands-free-background-guard.js', '/settings-workspace.js',
    '/workspace-navigation.js', '/ui-shell.js', '/sw-policy.js', '/manifest.webmanifest', '/hafize.jpeg'
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