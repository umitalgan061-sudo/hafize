const REQUIRED_SHELL_PATHS = Object.freeze(['/', '/index.html', '/offline.html', '/styles.css', '/app.js', '/manifest.webmanifest']);
// The service worker script is fetched by the update machinery, not by the page.
// Serving it from the shell cache pins whichever worker was current when the
// cache was filled, so it must stay out of the precache list.
const FORBIDDEN_SHELL_PATHS = Object.freeze(['/sw.js']);
const REQUIRED_MANIFEST_FIELDS = Object.freeze(['name', 'short_name', 'start_url', 'display', 'icons']);
const ALLOWED_DISPLAY = new Set(['standalone', 'minimal-ui', 'fullscreen', 'browser']);
// Browsers require a square icon of at least this edge before they offer an
// install prompt, and want a large icon plus a maskable one for the launcher.
const MIN_INSTALL_ICON = 192;
const LARGE_ICON = 512;
const SIZE_PATTERN = /^(\d+)x(\d+)$/;

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

/**
 * Reads the square edge an icon declares, or 0 when the entry is unusable.
 * `sizes` may list several boxes ("192x192 512x512"); the largest square wins.
 */
function squareEdge(icon) {
  if (!icon || typeof icon !== 'object' || typeof icon.src !== 'string' || !icon.src.trim()) return 0;
  const boxes = String(icon.sizes ?? '').trim().split(/\s+/);
  let edge = 0;
  for (const box of boxes) {
    const match = SIZE_PATTERN.exec(box);
    if (!match) continue;
    const width = Number(match[1]);
    const height = Number(match[2]);
    if (width === height) edge = Math.max(edge, width);
  }
  return edge;
}

function purposes(icon) {
  return String(icon?.purpose ?? 'any').trim().split(/\s+/).filter(Boolean);
}

/**
 * Checks the icon set against what a browser needs before it offers to install:
 * at least one square icon of 192px or more for general use, a 512px icon for
 * splash screens and store listings, and a maskable icon for launchers that
 * crop to their own shape.
 */
export function checkPwaIcons(icons) {
  if (!Array.isArray(icons) || icons.length === 0) {
    return Object.freeze({ pass: false, issues: ['icons:missing'], installable: 0, largest: 0, maskable: 0 });
  }
  const issues = [];
  let installable = 0;
  let largest = 0;
  let maskable = 0;
  for (const icon of icons) {
    const edge = squareEdge(icon);
    if (!edge) { issues.push('icons:unparsable-entry'); continue; }
    const kinds = purposes(icon);
    largest = Math.max(largest, edge);
    if (kinds.includes('any') && edge >= MIN_INSTALL_ICON) installable = Math.max(installable, edge);
    if (kinds.includes('maskable') && edge >= MIN_INSTALL_ICON) maskable = Math.max(maskable, edge);
  }
  if (!installable) issues.push(`icons:no-square-${MIN_INSTALL_ICON}px-any`);
  if (largest < LARGE_ICON) issues.push(`icons:no-${LARGE_ICON}px`);
  if (!maskable) issues.push('icons:no-maskable');
  return Object.freeze({ pass: issues.length === 0, issues: Object.freeze(issues), installable, largest, maskable });
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
  const icons = checkPwaIcons(manifest.icons);
  issues.push(...icons.issues);
  return Object.freeze({ pass: issues.length === 0, missing: [], issues, name, shortName, startUrl, display, icons, iconCount: Array.isArray(manifest.icons) ? manifest.icons.length : 0 });
}

export function checkPwaShell(paths) {
  if (!Array.isArray(paths)) fail('INVALID_PWA_SHELL');
  const normalized = new Set(paths.filter((path) => typeof path === 'string').map((path) => path.trim()));
  const missing = REQUIRED_SHELL_PATHS.filter((path) => !normalized.has(path));
  const networkApiCached = [...normalized].filter((path) => path.startsWith('/api/'));
  const forbiddenCachedPaths = [...networkApiCached, ...FORBIDDEN_SHELL_PATHS.filter((path) => normalized.has(path))];
  return Object.freeze({ pass: missing.length === 0 && forbiddenCachedPaths.length === 0, missing, forbiddenCachedPaths });
}

export function evaluatePwaReadiness({ manifest, shellPaths, serviceWorker } = {}) {
  const manifestResult = checkPwaManifest(manifest);
  const shellResult = checkPwaShell(shellPaths);
  const swResult = typeof serviceWorker === 'object' && serviceWorker !== null
    ? Object.freeze({ pass: serviceWorker.networkOnlyApi === true && serviceWorker.offlineFallback === true })
    : Object.freeze({ pass: false });
  return Object.freeze({ pass: manifestResult.pass && shellResult.pass && swResult.pass, manifest: manifestResult, shell: shellResult, serviceWorker: swResult });
}

export const PWA_READINESS_CONTRACT = Object.freeze({
  requiredShellPaths: REQUIRED_SHELL_PATHS,
  forbiddenShellPaths: FORBIDDEN_SHELL_PATHS,
  requiredManifestFields: REQUIRED_MANIFEST_FIELDS,
  allowedDisplayModes: Object.freeze([...ALLOWED_DISPLAY]),
  minInstallIconEdge: MIN_INSTALL_ICON,
  largeIconEdge: LARGE_ICON
});
