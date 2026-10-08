// Shared PWA shell-cache contract helpers.
//
// The service worker cache version is bumped on every shell change, so suites
// must never assert a literal version: they assert the invariants instead.
// This module is a helper, not a suite (run-checks only executes test-*/validate-*).

import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadBrowserModule } from './lib/source-registry.mjs';

export const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const PUBLIC_DIR = path.join(ROOT, 'public');
export const swPolicy = await loadBrowserModule('public/sw-policy.ts');
export const CACHE_VERSION_PATTERN = /^hafize-shell-v(\d+)$/;
export const CURRENT_CACHE_VERSION = Number(CACHE_VERSION_PATTERN.exec(swPolicy.CURRENT_CACHE)?.[1] ?? NaN);

/** Source text of `public/sw-policy.ts`, for suites that assert on the file itself. */
export function readSwPolicySource() {
  return readFileSync(path.join(PUBLIC_DIR, 'sw-policy.ts'), 'utf8');
}

/** Local file backing a shell asset path, or null for the bare `/` entry. */
export function shellAssetFile(assetPath) {
  if (assetPath === '/') return path.join(PUBLIC_DIR, 'index.html');
  if (!assetPath.startsWith('/') || assetPath.includes('..')) return null;
  return path.join(PUBLIC_DIR, assetPath.slice(1));
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
 * documents and static assets referenced from the manifest. The cache policy
 * itself is no longer a served asset: `public/sw.ts` imports `./sw-policy.ts`
 * and Vite bundles both into `typed-build/sw.js`.
 */
export const NON_INDEX_SHELL_ASSETS = Object.freeze([
  '/', '/index.html', '/offline.html', '/manifest.webmanifest', '/hafize.jpeg'
]);

/** Directories holding the typed browser sources that may inject assets at runtime. */
const BROWSER_SOURCE_DIRS = Object.freeze(['public', 'public/typed', 'public/typed/legacy']);

/**
 * Same-origin stylesheets the browser modules add with `injectCss()` instead of
 * a `<link>` in index.html.
 *
 * These are as necessary offline as the linked ones, and because they never
 * appear in index.html the older index-only check could not see them: the
 * smart-insert sheets were injected at runtime and missing from the shell for
 * several waves.
 */
export function injectedStylesheets() {
  const found = new Set();
  for (const dir of BROWSER_SOURCE_DIRS) {
    const absolute = path.join(ROOT, dir);
    if (!existsSync(absolute)) continue;
    for (const entry of readdirSync(absolute, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.ts') || entry.name.endsWith('.test.ts')) continue;
      const source = readFileSync(path.join(absolute, entry.name), 'utf8');
      for (const match of source.matchAll(/injectCss\(\s*'(\/[^']+\.css)'/g)) found.add(match[1]);
    }
  }
  return [...found].sort();
}

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
  // `sw-policy` is an ES module now, so the exported bindings are read-only for
  // consumers instead of living on a frozen object literal.
  assert.ok(Object.isSealed(swPolicy), 'the policy namespace cannot gain new entries');
  assert.throws(() => { swPolicy.CURRENT_CACHE = 'hafize-shell-v0'; }, 'the cache name cannot be reassigned by a consumer');
  assert.ok(Object.isFrozen(swPolicy.SHELL_ASSETS));

  assert.equal(swPolicy.SHELL_ASSETS.some((asset) => asset.startsWith('/api/')), false, 'API paths never enter the shell cache');
  assert.equal(new Set(swPolicy.SHELL_ASSETS).size, swPolicy.SHELL_ASSETS.length, 'shell assets are unique');

  // `cache.addAll()` rejects as a whole, so one stale path disables the
  // offline shell entirely: every entry must be backed by a real file.
  for (const asset of swPolicy.SHELL_ASSETS) {
    const file = shellAssetFile(asset);
    assert.ok(file && existsSync(file), `shell asset ${asset} exists on disk`);
  }

  // The list is kept in sync with the page in both directions: everything
  // index.html loads is cached, and nothing else is carried around for free.
  const indexAssets = new Set(indexHtmlAssets());
  for (const asset of indexAssets) {
    assert.ok(swPolicy.SHELL_ASSETS.includes(asset), `index.html asset ${asset} is cached by the service worker`);
  }
  const injected = new Set(injectedStylesheets());
  for (const asset of injected) {
    assert.ok(swPolicy.SHELL_ASSETS.includes(asset), `runtime-injected asset ${asset} is cached by the service worker`);
  }
  for (const asset of swPolicy.SHELL_ASSETS) {
    if (NON_INDEX_SHELL_ASSETS.includes(asset) || !/\.(css|js)$/.test(asset)) continue;
    assert.ok(
      indexAssets.has(asset) || injected.has(asset),
      `shell asset ${asset} is still loaded by index.html or injected at runtime`
    );
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

/**
 * Asserts the shell cache is at or past the version a feature's assets landed in.
 *
 * Suites used to pin the literal version they shipped with (`v41`, `v54`, ...),
 * so every later shell change broke an unrelated suite and the pin was silently
 * re-pinned. The version only ever moves forward, so the durable assertion is
 * "at least the version this feature landed in", paired with the asset checks
 * that prove the feature is actually cached.
 */
export function assertShellCacheAtLeast(landedVersion, label = 'shell cache') {
  assert.ok(Number.isInteger(landedVersion) && landedVersion > 0, 'landedVersion is a positive integer');
  assert.ok(
    Number.isInteger(CURRENT_CACHE_VERSION) && CURRENT_CACHE_VERSION >= landedVersion,
    `${label}: shell cache is v${CURRENT_CACHE_VERSION}, expected at least v${landedVersion}`
  );
}

/** Asserts the service worker source still declares a versioned cache name. */
export function assertVersionedCacheDeclaration(source = readSwPolicySource()) {
  assert.match(source, /CURRENT_CACHE = `\$\{CACHE_PREFIX\}v\d+`/, 'service worker declares a versioned shell cache');
}
