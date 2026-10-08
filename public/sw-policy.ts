export const CACHE_PREFIX = 'hafize-shell-';
export const CURRENT_CACHE = `${CACHE_PREFIX}v56`;
export const SHELL_ASSETS = Object.freeze([
  '/',
  '/index.html',
  '/offline.html',
  '/styles.css',
  '/premium.css',
  '/voice-output.css',
  '/screen-share.css',
  '/hands-free.css',
  '/workspace-navigation.css',
  '/chat-markdown.css',
  '/stream-status.css',
  '/chat-composer-features.css',
  '/chat-history-search.css',
  '/chat-history-export.css',
  '/settings-workspace.css',
  '/chat-history-management.css',
  '/chat-drafts.css',
  '/conversation-workspace.css',
  '/conversation-workspace-keyboard.css',
  '/conversation-forks.css',
  '/message-workspace.css',
  '/prompt-library.css',
  '/system-readiness.css',
  '/prompt-library-smart-views.css',
  '/prompt-library-smart-views-extras.css',
  '/prompt-library-smart-views-safety.css',
  '/prompt-library-smart-insert.css',
  '/prompt-library-smart-insert-center.css',
  '/prompt-library-smart-insert-history.css',
  '/prompt-library-smart-insert-suggestions.css',
  '/prompt-library-smart-insert-activity.css',
  '/prompt-library-smart-fill.css',
  '/prompt-library-command-palette.css',
  '/composer-history.css',
  '/scheduled-tasks.css',
  '/scheduled-task-preview.css',
  '/scheduled-task-duplicate.css',
  '/scheduled-task-templates.css',
  '/scheduled-task-planning.css',
  '/scheduled-task-templates-backup.css',
  '/scheduled-task-status-summary.css',
  '/scheduled-task-preview-activity.css',
  '/scheduled-task-template-presets.css',
  '/scheduled-task-draft.css',
  '/scheduled-task-insights.css',
  '/scheduled-task-actions.css',
  '/scheduled-task-detail.css',
  '/hafize-runtime.css',
  '/prompt-library-collections.css',
  '/prompt-library-revisions.css',
  '/github-workspace.css',
  '/github-workspace-extra.css',
  '/github-workspace-actions.css',
  '/github-workspace-details.css',
  '/github-workspace-write.css',
  '/connector-hub.css',
  '/model-preferences.css',
  '/workspace-backup.css',
  '/settings-privacy.css',
  '/typed-build/auth.js',
  '/typed-build/app-shell.js',
  '/typed-build/markdown-renderer.js',
  '/typed-build/conversation-workspace.js',
  '/typed-build/conversation-forks.js',
  '/typed-build/message-workspace.js',
  '/typed-build/prompt-library.js',
  '/typed-build/prompt-library-smart-fill.js',
  '/typed-build/prompt-library-command-palette.js',
  '/typed-build/github-workspace.js',
  '/typed-build/github-workspace-extra.js',
  '/typed-build/github-workspace-actions.js',
  '/typed-build/github-workspace-details.js',
  '/typed-build/github-workspace-write.js',
  '/typed-build/prompt-library-smart-fill-hints.js',
  '/typed-build/scheduled-tasks.js',
  '/typed-build/scheduled-tasks-countdown.js',
  '/typed-build/voice-input.js',
  '/typed-build/voice-output.js',
  '/typed-build/ui-shell.js',
  '/typed-build/app-runtime.js',
  '/typed-build/workspace-backup.js',
  '/typed-build/system-readiness-panel.js',
  '/typed-build/chat-markdown.js',
  '/typed-build/chat-composer-features.js',
  '/typed-build/chat-history-search.js',
  '/typed-build/chat-history-management.js',
  '/typed-build/hands-free.js',
  '/typed-build/hands-free-background-guard.js',
  '/typed-build/settings-privacy.js',
  '/typed-build/workspace-navigation.js',
  '/typed-build/legacy-app.js',
  '/manifest.webmanifest',
  '/hafize.jpeg'
]);
const SHELL_PATHS = new Set(SHELL_ASSETS);

function readHeader(headers: Headers | Record<string, string> | undefined, name: string): string {
  if (!headers) return '';
  if (typeof (headers as Headers).get === 'function') return (headers as Headers).get(name) || '';
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) if (key.toLowerCase() === target) return String(value ?? '');
  return '';
}

export function isSameOriginUrl(url: string, origin: string): boolean {
  if (!origin) return false;
  try { return new URL(url, origin).origin === origin; } catch { return false; }
}

export function pathnameFor(url: string, origin: string): string {
  try { return new URL(url, origin).pathname; } catch { return ''; }
}

export type CacheStrategy = 'ignore' | 'network-only' | 'navigation' | 'shell';

export function classifyRequest(request: Pick<Request, 'method'|'url'|'mode'|'headers'>, origin: string): CacheStrategy {
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

export function shouldDeleteCache(cacheName: unknown): boolean {
  return typeof cacheName === 'string' && cacheName.startsWith(CACHE_PREFIX) && cacheName !== CURRENT_CACHE;
}

export const SW_POLICY_LIMITS = Object.freeze({ cacheVersion: CURRENT_CACHE, assetCount: SHELL_ASSETS.length });
