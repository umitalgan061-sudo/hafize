export type CacheDecision = 'shell' | 'network-only' | 'ignore';
export interface CachePolicy { readonly prefix: string; readonly current: string; readonly assets: readonly string[] }
export interface CacheClassificationInput { readonly method?: string; readonly url?: string; readonly origin: string; readonly mode?: string; readonly accept?: string; readonly range?: string }

export const PLATFORM_ASSET_PATHS = Object.freeze([
  '/typed-build/app-runtime.js',
  '/typed-build/prompt-library-smart-fill.js',
  '/typed-build/prompt-library-command-palette.js',
  '/typed-build/prompt-library-smart-fill-hints.js',
  '/typed-build/scheduled-tasks-countdown.js'
]);

export const PLATFORM_CACHE_POLICY: CachePolicy = Object.freeze({ prefix: 'hafize-shell-', current: 'hafize-shell-v36', assets: PLATFORM_ASSET_PATHS });

export function sameOrigin(url: string, origin: string): boolean {
  try { return new URL(url, origin).origin === origin; } catch { return false; }
}
export function classifyCacheRequest(input: CacheClassificationInput): CacheDecision {
  if ((input.method || 'GET').toUpperCase() !== 'GET' || !sameOrigin(input.url || '', input.origin) || input.range) return 'ignore';
  const pathname = new URL(input.url || '', input.origin).pathname;
  if (pathname.startsWith('/api/')) return 'network-only';
  if (input.mode === 'navigate' || (input.accept || '').toLowerCase().includes('text/html')) return 'shell';
  return PLATFORM_ASSET_PATHS.includes(pathname) ? 'shell' : 'network-only';
}
export function shouldDeleteCache(name: string): boolean { return name.startsWith(PLATFORM_CACHE_POLICY.prefix) && name !== PLATFORM_CACHE_POLICY.current; }
