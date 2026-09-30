const CACHE_PREFIX = 'hafize-shell-';
export const CURRENT_CACHE = `${CACHE_PREFIX}v51`;
export const SHELL_ASSETS = Object.freeze([
  '/', '/index.html', '/offline.html',
  '/styles.css', '/premium.css', '/voice-output.css', '/screen-share.css', '/hands-free.css',
  '/workspace-navigation.css', '/chat-composer-features.css', '/chat-history-search.css', '/chat-history-export.css',
  '/settings-workspace.css', '/chat-history-management.css', '/chat-drafts.css',
  '/conversation-workspace.css', '/conversation-workspace-keyboard.css', '/conversation-forks.css', '/message-workspace.css',
  '/prompt-library.css', '/model-preferences.css', '/prompt-library-smart-fill.css', '/prompt-library-command-palette.css',
  '/prompt-library-collections.css', '/prompt-library-revisions.css', '/workspace-backup.css',
  '/github-workspace.css', '/github-workspace-extra.css', '/github-workspace-actions.css', '/github-workspace-details.css', '/github-workspace-write.css',
  '/connector-hub.css', '/composer-history.css', '/scheduled-tasks.css', '/hafize-runtime.css',
  '/prompt-library-smart-insert.css', '/prompt-library-smart-insert-center.css', '/prompt-library-smart-insert-history.css', '/prompt-library-smart-insert-suggestions.css', '/prompt-library-smart-insert-activity.css',
  '/typed-build/auth.js', '/typed-build/app-shell.js', '/typed-build/ui-shell.js', '/typed-build/voice-input.js', '/typed-build/voice-output.js',
  '/typed-build/app-runtime.js', '/typed-build/conversation-workspace.js', '/typed-build/conversation-forks.js', '/typed-build/message-workspace.js', '/typed-build/prompt-library.js',
  '/typed-build/prompt-library-smart-fill.js', '/typed-build/prompt-library-command-palette.js', '/typed-build/prompt-library-smart-fill-hints.js', '/typed-build/workspace-backup.js',
  '/typed-build/github-workspace.js', '/typed-build/github-workspace-extra.js', '/typed-build/github-workspace-actions.js', '/typed-build/github-workspace-details.js', '/typed-build/github-workspace-write.js',
  '/typed-build/scheduled-tasks.js', '/typed-build/scheduled-tasks-countdown.js', '/typed-build/sw.js',
  '/sw-policy.js', '/manifest.webmanifest', '/hafize.jpeg'
]);
export function readHeader(headers: Headers | null | undefined, name: string): string {
  if (!headers) return '';
  return headers.get(name) || '';
}
export function isSameOriginUrl(url: string, origin: string): boolean {
  if (!origin) return false;
  try { return new URL(url, origin).origin === origin; } catch { return false; }
}
export function pathnameFor(url: string, origin: string): string {
  try { return new URL(url, origin).pathname; } catch { return ''; }
}
export type RequestClass = 'ignore' | 'network-only' | 'navigation' | 'shell';
export function classifyRequest(request: Request, origin: string): RequestClass {
  if (!request || request.method.toUpperCase() !== 'GET') return 'ignore';
  if (!isSameOriginUrl(request.url, origin)) return 'ignore';
  if (readHeader(request.headers, 'range')) return 'ignore';
  const pathname = pathnameFor(request.url, origin);
  if (!pathname) return 'ignore';
  if (pathname.startsWith('/api/')) return 'network-only';
  if (request.mode === 'navigate' || readHeader(request.headers, 'accept').toLowerCase().includes('text/html')) return 'navigation';
  if (SHELL_ASSETS.includes(pathname)) return 'shell';
  return 'network-only';
}
export function shouldDeleteCache(cacheName: string): boolean {
  return cacheName.startsWith(CACHE_PREFIX) && cacheName !== CURRENT_CACHE;
}
