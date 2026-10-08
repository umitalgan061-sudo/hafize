// Shared PWA shell-cache contract helpers.
//
// The service worker cache version is bumped on every shell change, so suites
// must never assert a literal version: they assert the invariants instead.
// This module is a helper, not a suite (run-checks only executes test-*/validate-*).

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';


export const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const PUBLIC_DIR = path.join(ROOT, 'public');
export const swPolicy = await import('../public/sw-policy.ts');
export const CACHE_VERSION_PATTERN = /^hafize-shell-v(\d+)$/;
export const CURRENT_CACHE_VERSION = Number(CACHE_VERSION_PATTERN.exec(swPolicy.CURRENT_CACHE)?.[1] ?? NaN);

/** Source text of `public/sw-policy.ts`, for suites that assert on the file itself. */
export function readSwPolicySource() {
  return readFileSync(path.join(PUBLIC_DIR, 'sw-policy.ts'), 'utf8');
}

/**
 * Vite build entries, as `typed-build/<name>.js` -> source path. The bundles are
 * build output, so a suite that has not run `npm run build` must check the entry
 * that produces each one instead of the artifact.
 */
export function viteEntrySources() {
  const config = readFileSync(path.join(ROOT, 'vite.config.ts'), 'utf8');
  const block = config.slice(config.indexOf('entry: {'), config.indexOf("formats: ['es']"));
  const entries = new Map();
  for (const match of block.matchAll(/'([A-Za-z0-9._-]+)':\s*resolve\(ROOT,\s*'([^']+)'\)/g)) {
    entries.set(`typed-build/${match[1]}.js`, match[2]);
  }
  return entries;
}

const VITE_ENTRIES = viteEntrySources();

/**
 * Local file backing a shell asset path, or null when the path is not a file.
 * A `typed-build/*.js` bundle resolves to the TypeScript entry it is built from.
 */
export function shellAssetFile(assetPath) {
  if (assetPath === '/') return path.join(PUBLIC_DIR, 'index.html');
  if (!assetPath.startsWith('/') || assetPath.includes('..')) return null;
  const relative = assetPath.slice(1);
  const entry = VITE_ENTRIES.get(relative);
  if (entry) return path.join(ROOT, entry);
  return path.join(PUBLIC_DIR, relative);
}

/** Same-origin CSS/JS URLs referenced by `public/index.html`. */
export function indexHtmlAssets() {
  const html = readFileSync(path.join(PUBLIC_DIR, 'index.html'), 'utf8');
  const found = new Set();
  for (const match of html.matchAll(/(?:href|src)="(\/[^"?#]+\.(?:css|js))"/g)) found.add(match[1]);
  return [...found];
}

/**
 * Shell entries that are not `<link>`ed or `<script>`ed from index.html:
 * documents, the policy module the service worker imports, and
 * static assets referenced from the manifest.
 */
export const NON_INDEX_SHELL_ASSETS = Object.freeze([
  '/', '/index.html', '/offline.html', '/manifest.webmanifest', '/hafize.jpeg'
]);

/**
 * Asserts the version-independent shell-cache invariants:
 * a well-formed current cache name, scoped cleanup of older versions, no API
 * paths in the shell list, no duplicates, and a real file behind every asset.
 */
export function assertShellCacheContract() {
  assert.equal(swPolicy.CACHE_PREFIX, 'hafize-shell-');
  assert.match(swPolicy.CURRENT_CACHE, CACHE_VERSION_PATTERN, 'shell cache name carries a numeric version');
  assert.ok(Number.isInteger(CURRENT_CACHE_VERSION) && CURRENT_CACHE_VERSION > 0);
  assert.equal(swPolicy.CURRENT_CACHE, `${swPolicy.CACHE_PREFIX}v${CURRENT_CACHE_VERSION}`);
  // The policy is now an ES module, so immutability comes from the namespace
  // rather than a frozen object literal: consumers cannot add or rebind exports.
  assert.equal(Object.isExtensible(swPolicy), false, 'policy namespace is not extensible');
  assert.throws(() => { swPolicy.CURRENT_CACHE = 'hafize-shell-v0'; }, TypeError, 'policy exports are read-only');
  assert.ok(Object.isFrozen(swPolicy.SHELL_ASSETS));

  assert.equal(swPolicy.SHELL_ASSETS.some((asset) => asset.startsWith('/api/')), false, 'API paths never enter the shell cache');
  assert.equal(new Set(swPolicy.SHELL_ASSETS).size, swPolicy.SHELL_ASSETS.length, 'shell assets are unique');

  // `cache.addAll()` rejects as a whole, so one stale path disables the
  // offline shell entirely: every entry must be backed by a real file.
  for (const asset of swPolicy.SHELL_ASSETS) {
    const file = shellAssetFile(asset);
    assert.ok(file && existsSync(file), `shell asset ${asset} is backed by a source file`);
    if (asset.startsWith('/typed-build/')) {
      assert.ok(VITE_ENTRIES.has(asset.slice(1)), `shell bundle ${asset} has a vite build entry`);
    }
  }

  // The list is kept in sync with the page in both directions: everything
  // index.html loads is cached, and nothing else is carried around for free.
  const indexAssets = new Set(indexHtmlAssets());
  for (const asset of indexAssets) {
    assert.ok(swPolicy.SHELL_ASSETS.includes(asset), `index.html asset ${asset} is cached by the service worker`);
  }
  for (const asset of swPolicy.SHELL_ASSETS) {
    if (NON_INDEX_SHELL_ASSETS.includes(asset) || !/\.(css|js)$/.test(asset)) continue;
    assert.ok(indexAssets.has(asset), `shell asset ${asset} is still loaded by index.html`);
  }

  // Every older version is cleaned up, the current one is kept and foreign caches are untouched.
  for (let version = 1; version < CURRENT_CACHE_VERSION; version += 1) {
    assert.equal(swPolicy.shouldDeleteCache(`hafize-shell-v${version}`), true, `hafize-shell-v${version} is evicted`);
  }
  assert.equal(swPolicy.shouldDeleteCache(swPolicy.CURRENT_CACHE), false);
  assert.equal(swPolicy.shouldDeleteCache('other-app-cache-v1'), false);
  assert.equal(swPolicy.shouldDeleteCache('hafize-runtime-v1'), false);
  assert.equal(swPolicy.shouldDeleteCache(null), false);
}

/** Asserts each given path is cached by the shell, so the feature also works offline. */
export function assertShellAssets(assetPaths, label = 'shell asset') {
  for (const assetPath of assetPaths) {
    assert.ok(swPolicy.SHELL_ASSETS.includes(assetPath), `${label} ${assetPath} is cached by the service worker`);
  }
}

/** Asserts the service worker source still declares a versioned cache name. */
export function assertVersionedCacheDeclaration(source = readSwPolicySource()) {
  assert.match(source, /CURRENT_CACHE = `\$\{CACHE_PREFIX\}v\d+`/, 'service worker declares a versioned shell cache');
}

/** The single bundle that ships every remaining legacy browser module. */
export const LEGACY_APP_BUNDLE = '/typed-build/legacy-app.js';

/** Module names imported by `public/typed/legacy-app.ts`, e.g. `connector-hub`. */
export function legacyBrowserModules() {
  const source = readFileSync(path.join(PUBLIC_DIR, 'typed', 'legacy-app.ts'), 'utf8');
  return new Set([...source.matchAll(/^import '\.\/legacy\/([A-Za-z0-9._-]+)\.ts';$/gm)].map((match) => match[1]));
}

const LEGACY_MODULES = legacyBrowserModules();

/**
 * Published bundle for a browser module, whether it has its own Vite entry or
 * ships inside `legacy-app`. Throws for a name the build does not produce, so a
 * suite cannot quietly assert on an asset that is never served.
 */
export function bundleFor(moduleName) {
  const own = `typed-build/${moduleName}.js`;
  if (VITE_ENTRIES.has(own)) return `/${own}`;
  if (LEGACY_MODULES.has(moduleName)) return LEGACY_APP_BUNDLE;
  throw new Error(`UNKNOWN_BROWSER_MODULE:${moduleName}`);
}

/**
 * Asserts a browser module still reaches the page: it is wired into a build
 * entry (directly or through `legacy-app`), index.html loads that bundle, and
 * the service worker caches it so the feature also survives offline.
 */
export function assertModuleShipped(moduleName, label = 'browser module') {
  const bundle = bundleFor(moduleName);
  const html = readFileSync(path.join(PUBLIC_DIR, 'index.html'), 'utf8');
  assert.ok(html.includes(`src="${bundle}"`), `${label} ${moduleName} ships in ${bundle}, loaded by index.html`);
  assert.ok(swPolicy.SHELL_ASSETS.includes(bundle), `${label} ${moduleName} is cached by the service worker`);
  if (bundle === LEGACY_APP_BUNDLE) {
    const entry = readFileSync(path.join(PUBLIC_DIR, 'typed', 'legacy-app.ts'), 'utf8');
    assert.ok(entry.includes(`import './legacy/${moduleName}.ts';`), `${label} ${moduleName} is imported by the legacy entry`);
  }
}

/** Asserts each stylesheet is linked by index.html and cached by the shell. */
export function assertStylesheetShipped(href, label = 'stylesheet') {
  const html = readFileSync(path.join(PUBLIC_DIR, 'index.html'), 'utf8');
  assert.ok(html.includes(`href="${href}"`), `${label} ${href} is linked by index.html`);
  assert.ok(swPolicy.SHELL_ASSETS.includes(href), `${label} ${href} is cached by the service worker`);
}
