import { readFileSync, statSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const ALLOWED_HOSTS = new Set(['hafize-ua.web.app', 'hafize-ua.firebaseapp.com']);
const IMPORTANT_ASSETS = Object.freeze([
  '/styles.css',
  '/premium.css',
  '/typed-build/app-shell.js',
  '/typed-build/ui-shell.js',
  '/typed-build/workspace-navigation.js',
  '/typed-build/live-screen.js',
  '/typed-build/legacy-app.js',
  '/manifest.webmanifest'
]);

function safePath(value) {
  if (typeof value !== 'string' || !value.startsWith('/') ||
      value.startsWith('//') || value.includes('\\')) return '';
  let pathname;
  try { pathname = new URL(value, 'https://hafize-ua.web.app').pathname; }
  catch { return ''; }
  if (!/^\/[A-Za-z0-9/_\-.]+$/.test(pathname) ||
      pathname.split('/').includes('..')) return '';
  return pathname;
}

/** Enumerate explicitly referenced local HTML assets, not arbitrary external links. */
export function referencedAssets(html) {
  const found = new Set();
  if (typeof html !== 'string') return [];
  const tag = /<(script|link|img)\b[^>]*?>/gi;
  for (const match of html.matchAll(tag)) {
    const element = match[0];
    const attrs = [...element.matchAll(/\b(src|href)\s*=\s*(["'])(.*?)\2/gi)];
    for (const [, , , candidate] of attrs) {
      if (typeof candidate !== 'string') continue;
      const path = safePath(candidate);
      if (path) found.add(path);
    }
  }
  return [...found];
}

function pathExists(pathname) {
  try { return statSync(pathname).isFile() && statSync(pathname).size > 0; }
  catch { return false; }
}

/**
 * Check that Vite actually produced every asset index.html will load.
 * Run AFTER npm run build. Does not touch production or git.
 */
export function auditLocalBuild(root = ROOT) {
  const publicDir = resolve(root, 'public');
  const indexPath = resolve(publicDir, 'index.html');
  if (!pathExists(indexPath)) return { ok: false, problems: ['INDEX_HTML_MISSING'], checked: 0 };
  const html = readFileSync(indexPath, 'utf8');
  const paths = [...new Set([...IMPORTANT_ASSETS, ...referencedAssets(html)])];
  const problems = [];
  if (!/<title>\s*Hafize\s*<\/title>/i.test(html) ||
      !/\bid\s*=\s*["']composer["']/.test(html)) problems.push('HAFIZE_ENTRYPOINT_MISSING');
  for (const path of paths) {
    const target = resolve(publicDir, '.' + path);
    if (!target.startsWith(publicDir + sep) || !pathExists(target)) {
      problems.push('ASSET_MISSING:' + path);
    }
  }
  return { ok: problems.length === 0, problems, checked: paths.length };
}

function expectedContentType(path) {
  if (path.endsWith('.js') || path.endsWith('.mjs')) return 'javascript';
  if (path.endsWith('.css')) return 'text/css';
  if (path.endsWith('.webmanifest') || path.endsWith('.json')) return 'json';
  return '';
}

function contentTypeMatches(path, contentType) {
  const type = String(contentType || '').toLowerCase();
  const expected = expectedContentType(path);
  if (!expected) return true;
  return type.includes(expected) ||
    (expected === 'javascript' && type.includes('ecmascript')) ||
    (expected === 'json' && type.includes('manifest+json'));
}

function originOf(value) {
  let url;
  try { url = new URL(value); }
  catch { throw new Error('INVALID_SITE_URL'); }
  if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname) ||
      url.port || url.username || url.password || url.search || url.hash ||
      url.pathname !== '/') throw new Error('INVALID_SITE_URL');
  return url.origin;
}

export async function probeLiveSite({
  site = 'https://hafize-ua.web.app/',
  fetchImpl = globalThis.fetch,
  timeoutMs = 12_000
} = {}) {
  const origin = originOf(site);
  if (typeof fetchImpl !== 'function') throw new Error('FETCH_UNAVAILABLE');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 30_000) {
    throw new Error('INVALID_TIMEOUT');
  }
  async function get(path) {
    try {
      const response = await fetchImpl(origin + path, {
        method: 'GET',
        redirect: 'error',
        cache: 'no-store',
        headers: { Accept: path === '/api/health' ? 'application/json' : '*/*' },
        signal: AbortSignal.timeout(timeoutMs)
      });
      return response;
    } catch {
      return null; // Never reflect an upstream stack trace or response body.
    }
  }

  const home = await get('/');
  const homeType = home?.headers?.get?.('content-type') || '';
  let html = '';
  if (home?.ok && homeType.toLowerCase().includes('text/html')) {
    try { html = (await home.text()).slice(0, 300_000); } catch {}
  }
  const validHome = Boolean(home?.ok && html &&
    /<title>\s*Hafize\s*<\/title>/i.test(html) &&
    /\bid\s*=\s*["']composer["']/.test(html) &&
    !/<title>\s*(?:Site Not Found|404 Not Found|Firebase Hosting Setup Complete)\s*<\/title>/i.test(html));
  const siteResult = {
    state: validHome ? 'healthy' : 'broken',
    status: home?.status ?? null,
    reason: !home ? 'NETWORK_UNAVAILABLE' : !home.ok ? 'HTTP_ERROR' :
      !homeType.toLowerCase().includes('text/html') ? 'UNEXPECTED_CONTENT_TYPE' :
      validHome ? 'HAFIZE_HTML_OK' : 'UNEXPECTED_HTML'
  };

  const assets = [];
  if (validHome) {
    const embedded = new Set(referencedAssets(html));
    // Always check critical app assets; discover missing references as well.
    const paths = [...new Set([...IMPORTANT_ASSETS, ...embedded])].slice(0, 18);
    for (const path of paths) {
      const response = await get(path);
      const type = response?.headers?.get?.('content-type') || '';
      const ok = Boolean(response?.ok && contentTypeMatches(path, type));
      assets.push({
        path,
        ok,
        status: response?.status ?? null,
        reason: !response ? 'NETWORK_UNAVAILABLE' : !response.ok ? 'HTTP_ERROR' :
          !contentTypeMatches(path, type) ? 'WRONG_CONTENT_TYPE' : 'OK'
      });
    }
  }

  const api = await get('/api/health');
  const apiType = api?.headers?.get?.('content-type') || '';
  let validApi = Boolean(api?.ok && apiType.toLowerCase().includes('application/json'));
  if (validApi) {
    try { const obj = await api.json(); validApi = Boolean(obj && typeof obj === 'object' && !Array.isArray(obj)); }
    catch { validApi = false; }
  }
  const apiResult = {
    state: validApi ? 'healthy' : 'unavailable',
    status: api?.status ?? null,
    reason: !api ? 'NETWORK_UNAVAILABLE' : !api.ok ? 'HTTP_ERROR' :
      validApi ? 'JSON_HEALTH_OK' : 'NOT_JSON_HEALTH'
  };

  const allAssetsOk = assets.every((a) => a.ok);
  const state = !validHome || !allAssetsOk ? 'broken' : validApi ? 'healthy' : 'degraded';
  return Object.freeze({
    target: origin,
    state,
    site: siteResult,
    assetCount: assets.length,
    failedAssets: assets.filter((x) => !x.ok),
    api: apiResult
  });
}

async function main() {
  const mode = process.argv[2];
  if (mode === '--local') {
    const result = auditLocalBuild();
    console.log(JSON.stringify({ mode: 'local-release-check', ...result }, null, 2));
    if (!result.ok) process.exitCode = 1;
    return;
  }
  if (mode === '--live') {
    const url = process.argv[3] || 'https://hafize-ua.web.app/';
    const report = await probeLiveSite({ site: url });
    console.log(JSON.stringify({ mode: 'live-readonly-probe', ...report }, null, 2));
    if (report.state !== 'healthy') process.exitCode = 1;
    return;
  }
  console.error('Usage: node scripts/site-release-health.mjs --local | --live https://hafize-ua.web.app/');
  process.exitCode = 2;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : 'SITE_CHECK_FAILED');
    process.exitCode = 1;
  });
}
