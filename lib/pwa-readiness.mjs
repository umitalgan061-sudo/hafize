const REQUIRED_SHELL_PATHS = Object.freeze(['/', '/index.html', '/offline.html', '/styles.css', '/app.js', '/sw.js', '/manifest.webmanifest']);
const REQUIRED_MANIFEST_FIELDS = Object.freeze(['name', 'short_name', 'start_url', 'display', 'icons']);
const ALLOWED_DISPLAY = new Set(['standalone', 'minimal-ui', 'fullscreen', 'browser']);

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function text(value, max, code) {
  const result = typeof value === 'string' ? value.trim() : '';
  if (!result || result.length > max) fail(code);
  return result;
}

export function checkPwaManifest(manifest) {
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

export function checkPwaShell(paths) {
  if (!Array.isArray(paths)) fail('INVALID_PWA_SHELL');
  const normalized = new Set(paths.filter((path) => typeof path === 'string').map((path) => path.trim()));
  const missing = REQUIRED_SHELL_PATHS.filter((path) => !normalized.has(path));
  const networkApiCached = [...normalized].filter((path) => path.startsWith('/api/'));
  return Object.freeze({ pass: missing.length === 0 && networkApiCached.length === 0, missing, forbiddenCachedPaths: networkApiCached });
}

export function evaluatePwaReadiness({ manifest, shellPaths, serviceWorker } = {}) {
  const manifestResult = checkPwaManifest(manifest);
  const shellResult = checkPwaShell(shellPaths);
  const swResult = typeof serviceWorker === 'object' && serviceWorker !== null
    ? Object.freeze({ pass: serviceWorker.networkOnlyApi === true && serviceWorker.offlineFallback === true })
    : Object.freeze({ pass: false });
  return Object.freeze({ pass: manifestResult.pass && shellResult.pass && swResult.pass, manifest: manifestResult, shell: shellResult, serviceWorker: swResult });
}

export const PWA_READINESS_CONTRACT = Object.freeze({ requiredShellPaths: REQUIRED_SHELL_PATHS, requiredManifestFields: REQUIRED_MANIFEST_FIELDS, allowedDisplayModes: Object.freeze([...ALLOWED_DISPLAY]) });
