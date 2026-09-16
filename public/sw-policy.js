(function exposeHafizeSwPolicy(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module?.exports) module.exports = api;
  else root.HafizeSwPolicy = api;
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeSwPolicy() {
  'use strict';
  const CACHE_PREFIX = 'hafize-shell-';
  const CURRENT_CACHE = `${CACHE_PREFIX}v39`;
  const SHELL_ASSETS = Object.freeze([
    '/', '/index.html', '/offline.html', '/styles.css', '/premium.css', '/voice-output.css', '/screen-share.css', '/hands-free.css',
    '/workspace-navigation.css', '/chat-composer-features.css', '/chat-history-search.css', '/chat-history-export.css', '/settings-workspace.css', '/chat-history-management.css', '/chat-drafts.css',
    '/conversation-workspace.css', '/conversation-workspace-keyboard.css', '/message-workspace.css', '/prompt-library.css', '/prompt-library-smart-fill.css', '/prompt-library-command-palette.css',
    '/prompt-library-collections.css', '/prompt-library-revisions.css', '/composer-history.css', '/scheduled-tasks.css', '/hafize-runtime.css', '/prompt-library-fill.css', '/prompt-library-fill-history.css',
    '/auth.js', '/app.js', '/chat-composer-features.js', '/chat-history-search.js', '/chat-history-export.js', '/chat-history-management.js', '/chat-drafts.js',
    '/conversation-workspace.js', '/conversation-workspace-keyboard.js', '/message-workspace-policy.js', '/message-workspace.js', '/prompt-library.js', '/prompt-library-starters.js', '/prompt-library-enhancements.js', '/prompt-library-keyboard.js',
    '/prompt-library-usage.js', '/prompt-library-fill.js', '/prompt-library-fill-presets.js', '/prompt-library-fill-keyboard.js', '/prompt-library-fill-backup.js', '/prompt-library-fill-backup-ui.js', '/prompt-library-fill-history.js', '/prompt-library-fill-history-ui.js', '/prompt-library-fill-privacy.js', '/prompt-library-fill-field-status.js', '/prompt-library-fill-defaults.js', '/prompt-library-fill-session.js', '/prompt-library-fill-copy.js',
    '/prompt-library-collections.js', '/prompt-library-collections-enhancements.js', '/prompt-library-revisions.js', '/prompt-library-revisions-enhancements.js', '/composer-history.js', '/composer-history-panel.js', '/composer-history-backup.js', '/composer-history-help.js', '/composer-history-settings.js',
    '/scheduled-tasks.js', '/scheduled-tasks-enhancements.js', '/scheduled-tasks-keyboard.js', '/voice-input.js', '/voice-output.js', '/hands-free.js', '/hands-free-background-guard.js', '/screen-share.js', '/settings-workspace.js', '/workspace-navigation.js', '/ui-shell.js',
    '/typed-build/app-runtime.js', '/typed-build/prompt-library-smart-fill.js', '/typed-build/prompt-library-command-palette.js', '/typed-build/prompt-library-smart-fill-hints.js', '/typed-build/scheduled-tasks-countdown.js', '/sw-policy.js', '/manifest.webmanifest', '/hafize.jpeg'
  ]);
  const SHELL_PATHS = new Set(SHELL_ASSETS);
  function readHeader(headers, name) { if (!headers) return ''; if (typeof headers.get === 'function') return headers.get(name) || ''; const target = name.toLowerCase(); for (const [key, value] of Object.entries(headers)) if (key.toLowerCase() === target) return String(value ?? ''); return ''; }
  function isSameOriginUrl(url, origin) { if (typeof origin !== 'string' || !origin) return false; try { return new URL(url, origin).origin === origin; } catch { return false; } }
  function pathnameFor(url, origin) { try { return new URL(url, origin).pathname; } catch { return ''; } }
  function classifyRequest(request, origin) { if (!request || String(request.method || 'GET').toUpperCase() !== 'GET') return 'ignore'; if (!isSameOriginUrl(request.url, origin)) return 'ignore'; if (readHeader(request.headers, 'range')) return 'ignore'; const pathname = pathnameFor(request.url, origin); if (!pathname) return 'ignore'; if (pathname.startsWith('/api/')) return 'network-only'; if (request.mode === 'navigate' || readHeader(request.headers, 'accept').toLowerCase().includes('text/html')) return 'navigation'; if (SHELL_PATHS.has(pathname)) return 'shell'; return 'network-only'; }
  function shouldDeleteCache(cacheName) { return typeof cacheName === 'string' && cacheName.startsWith(CACHE_PREFIX) && cacheName !== CURRENT_CACHE; }
  return Object.freeze({ CACHE_PREFIX, CURRENT_CACHE, SHELL_ASSETS, classifyRequest, isSameOriginUrl, shouldDeleteCache });
});
