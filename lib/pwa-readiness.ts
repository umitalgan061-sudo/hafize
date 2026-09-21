export interface PwaManifestResult { pass: boolean; missing: string[]; issues: string[]; name?: string; shortName?: string; startUrl?: string; display?: string; iconCount?: number }
export interface PwaShellResult { pass: boolean; missing: string[]; forbiddenCachedPaths: string[] }
export interface PwaReadinessResult { pass: boolean; manifest: PwaManifestResult; shell: PwaShellResult; serviceWorker: { pass: boolean } }
const REQUIRED_SHELL_PATHS = Object.freeze(['/', '/index.html', '/offline.html', '/styles.css', '/app.js', '/sw.js', '/manifest.webmanifest']);
const REQUIRED_MANIFEST_FIELDS = Object.freeze(['name', 'short_name', 'start_url', 'display', 'icons']);
const ALLOWED_DISPLAY = new Set(['standalone', 'minimal-ui', 'fullscreen', 'browser']);

function fail(code: string): never {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function text(value: unknown, max: number, code: string): string {
  const result = typeof value === 'string' ? value.trim() : '';
  if (!result || result.length > max) fail(code);
  return result;
}

export export function checkPwaManifest(manifest: Record<string, unknown>): PwaManifestResult {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) fail('INVALID_PWA_MANIFEST');
  const missing = REQUIRED_MANIFEST_FIELDS.filter((field) => manifest[field] == null);
  if (missing.length) return Object.freeze({ pass: false, missing, issues: [`missing:${missing.join(',')}`] });
  const issues = [];
  const name = text(manifest.name, 200, 'INVALID_PWA_MANIFEST_NAME');
  const shortName = text(manifest.short_name, 80, 'INVALID_PWA_MANIFEST_SHORT_NAME');
  const startUrl = text(manifest.start_url, 200, 'INVALID_PWA_MANIFEST_START_URL');
  const display = text(manifest.display, 40, 'INVALID_PWA_MANIFEST_DISPLAY');
  if (!ALLOWED_DISPLAY.has(display)) issues.push('display:not-supported');
  if (!startUrl.startsWith('/')) issues.push('start_url:not-same-origin-path');
  if (!Array.isArray(manifest.icons) || manifest.icons.length === 0) issues.push('icons:missing');
  return Object.freeze({ pass: issues.length === 0, missing: [], issues, name, shortName, startUrl, display, iconCount: Array.isArray(manifest.icons) ? manifest.icons.length : 0 });
}

export export function checkPwaShell(paths: unknown): PwaShellResult {
  if (!Array.isArray(paths)) fail('INVALID_PWA_SHELL');
  const normalized = new Set(paths.filter((path) => typeof path === 'string').map((path) => path.trim()));
  const missing = REQUIRED_SHELL_PATHS.filter((path) => !normalized.has(path));
  const networkApiCached = [...normalized].filter((path) => path.startsWith('/api/'));
  return Object.freeze({ pass: missing.length === 0 && networkApiCached.length === 0, missing, forbiddenCachedPaths: networkApiCached });
}

export function evaluatePwaReadiness({ manifest, shellPaths, serviceWorker }: { manifest?: Record<string, unknown>; shellPaths?: unknown; serviceWorker?: unknown } = {}): PwaReadinessResult {
  const manifestResult = checkPwaManifest(manifest);
  const shellResult = checkPwaShell(shellPaths);
  const swResult = typeof serviceWorker === 'object' && serviceWorker !== null
    ? Object.freeze({ pass: serviceWorker.networkOnlyApi === true && serviceWorker.offlineFallback === true })
    : Object.freeze({ pass: false });
  return Object.freeze({ pass: manifestResult.pass && shellResult.pass && swResult.pass, manifest: manifestResult, shell: shellResult, serviceWorker: swResult });
}

export const PWA_READINESS_CONTRACT = Object.freeze({ requiredShellPaths: REQUIRED_SHELL_PATHS, requiredManifestFields: REQUIRED_MANIFEST_FIELDS, allowedDisplayModes: Object.freeze([...ALLOWED_DISPLAY]) });
