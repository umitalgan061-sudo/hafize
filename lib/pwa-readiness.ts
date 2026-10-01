const REQUIRED_SHELL_PATHS = Object.freeze(['/', '/index.html', '/offline.html', '/styles.css', '/app.js', '/sw.js', '/manifest.webmanifest'] as const);
const REQUIRED_MANIFEST_FIELDS = Object.freeze(['name', 'short_name', 'start_url', 'display', 'icons'] as const);
const ALLOWED_DISPLAY = new Set(['standalone', 'minimal-ui', 'fullscreen', 'browser'] as const);
export interface PwaManifest { readonly [key: string]: unknown; }
export interface PwaCheckResult {
  readonly pass: boolean;
  readonly missing: readonly string[];
  readonly issues: readonly string[];
  readonly name?: string;
  readonly shortName?: string;
  readonly startUrl?: string;
  readonly display?: string;
  readonly iconCount?: number;
}
const fail = (code: string): never => { const error = new Error(code) as Error & { code?: string }; error.code = code; throw error; };
const text = (value: unknown, max: number, code: string): string => {
  const result = typeof value === 'string' ? value.trim() : '';
  if (!result || result.length > max) fail(code);
  return result;
};
export function checkPwaManifest(manifest: PwaManifest): PwaCheckResult {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) fail('INVALID_PWA_MANIFEST');
  const missing = REQUIRED_MANIFEST_FIELDS.filter((field) => manifest[field] == null);
  if (missing.length) return Object.freeze({ pass: false, missing, issues: ['missing:' + missing.join(',')] });
  const issues: string[] = [];
  const name = text(manifest.name, 200, 'INVALID_PWA_MANIFEST_NAME');
  const shortName = text(manifest.short_name, 80, 'INVALID_PWA_MANIFEST_SHORT_NAME');
  const startUrl = text(manifest.start_url, 200, 'INVALID_PWA_MANIFEST_START_URL');
  const display = text(manifest.display, 40, 'INVALID_PWA_MANIFEST_DISPLAY');
  if (!ALLOWED_DISPLAY.has(display as never)) issues.push('display:not-supported');
  if (!startUrl.startsWith('/')) issues.push('start_url:not-same-origin-path');
  const iconCount = Array.isArray(manifest.icons) ? manifest.icons.length : 0;
  if (!iconCount) issues.push('icons:missing');
  return Object.freeze({ pass: issues.length === 0, missing: [], issues, name, shortName, startUrl, display, iconCount });
}
export function checkPwaShell(paths: readonly unknown[]): { readonly pass: boolean; readonly missing: readonly string[]; readonly forbiddenCachedPaths: readonly string[] } {
  if (!Array.isArray(paths)) fail('INVALID_PWA_SHELL');
  const normalized = new Set(paths.filter((path): path is string => typeof path === 'string').map((path) => path.trim()));
  const missing = REQUIRED_SHELL_PATHS.filter((path) => !normalized.has(path));
  const networkApiCached = [...normalized].filter((path) => path.startsWith('/api/'));
  return Object.freeze({ pass: missing.length === 0 && networkApiCached.length === 0, missing, forbiddenCachedPaths: networkApiCached });
}
export function evaluatePwaReadiness(input: { manifest?: PwaManifest; shellPaths?: readonly unknown[]; serviceWorker?: { networkOnlyApi?: boolean; offlineFallback?: boolean } } = {}) {
  const manifestResult = checkPwaManifest(input.manifest ?? {});
  const shellResult = checkPwaShell(input.shellPaths ?? []);
  const sw = input.serviceWorker;
  const swResult = typeof sw === 'object' && sw !== null ? Object.freeze({ pass: sw.networkOnlyApi === true && sw.offlineFallback === true }) : Object.freeze({ pass: false });
  return Object.freeze({ pass: manifestResult.pass && shellResult.pass && swResult.pass, manifest: manifestResult, shell: shellResult, serviceWorker: swResult });
}
export const PWA_READINESS_CONTRACT = Object.freeze({ requiredShellPaths: REQUIRED_SHELL_PATHS, requiredManifestFields: REQUIRED_MANIFEST_FIELDS, allowedDisplayModes: Object.freeze([...ALLOWED_DISPLAY]) });
