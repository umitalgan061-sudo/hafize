// Shared PWA shell-cache contract helpers.
//
// The service worker cache version is bumped on every shell change, so suites
// must never assert a literal version: they assert the invariants instead.
// This module is a helper, not a suite (run-checks only executes test-*/validate-*).

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

export const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const PUBLIC_DIR = path.join(ROOT, 'public');
export const swPolicy = require('../public/sw-policy.ts');
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
 * documents, the policy the service worker pulls in with `importScripts`, and
 * static assets referenced from the manifest.
 */
export const NON_INDEX_SHELL_ASSETS = Object.freeze([
  '/', '/index.html', '/offline.html', '/sw-policy.js', '/manifest.webmanifest', '/hafize.jpeg'
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
  assert.ok(Object.isFrozen(swPolicy));
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

// --- Shipped browser modules -------------------------------------------------
//
// Before the TypeScript migration every browser module was its own
// `<script src="/name.js">` tag, so suites asserted the asset path appeared in
// index.html and in the precache list. Vite now bundles the typed sources into
// a smaller set of entrypoints — most of the former standalone modules reach
// the page through `typed-build/legacy-app.js` — so the literal path no longer
// appears anywhere even though the module still ships. These helpers assert the
// contract (the module reaches the browser, and the shell carrying it is
// precached) instead of the spelling of one script tag.

const readRepoFile = (relative) => readFileSync(path.join(ROOT, relative), 'utf8');

/** Entry name -> typed source, for every entrypoint Vite builds. */
function viteEntries() {
  const config = readRepoFile('vite.config.ts');
  const entries = new Map();
  for (const match of config.matchAll(/'?([A-Za-z0-9-]+)'?\s*:\s*resolve\(ROOT,\s*'([^']+)'\)/g)) {
    entries.set(match[1], match[2]);
  }
  return entries;
}

/** Typed sources imported by the unified legacy entrypoint. */
function legacyBundleMembers() {
  const source = readRepoFile('public/typed/legacy-app.ts');
  return new Set(
    [...source.matchAll(/import\s+'\.\/([A-Za-z0-9./-]+)\.ts';/g)].map((match) => match[1])
  );
}

/**
 * The typed source that replaced a legacy `name.js` browser module, or null
 * when no such source exists.
 */
export function canonicalSource(name) {
  const stem = String(name).replace(/^\/+/, '').replace(/\.(js|ts)$/, '');
  for (const candidate of [
    `public/${stem}.ts`,
    `public/typed/${stem}.ts`,
    `public/typed/legacy/${stem}.ts`
  ]) {
    if (existsSync(path.join(ROOT, candidate))) return candidate;
  }
  return null;
}

/**
 * The built entrypoint that carries `name` into the browser: either its own
 * Vite entry, or `legacy-app` when it is part of the unified legacy bundle.
 */
export function shippingEntry(name) {
  const source = canonicalSource(name);
  if (!source) return null;
  for (const [entry, entrySource] of viteEntries()) {
    if (entrySource === source) return entry;
  }
  const relative = source.replace(/^public\/typed\//, '').replace(/\.ts$/, '');
  return legacyBundleMembers().has(relative) ? 'legacy-app' : null;
}

/**
 * Assert that a browser module ships: it has a canonical typed source, a built
 * entrypoint carries it, `index.html` loads that entrypoint, and the service
 * worker precaches it.
 */
export function assertShippedBrowserModule(name, { html, sw } = {}) {
  const source = canonicalSource(name);
  assert.ok(source, `no canonical typed source for browser module: ${name}`);
  const entry = shippingEntry(name);
  assert.ok(entry, `browser module is not reachable from any built entrypoint: ${name}`);
  const indexHtml = html ?? readRepoFile('public/index.html');
  const swPolicy = sw ?? readRepoFile('public/sw-policy.ts');
  assert.ok(
    indexHtml.includes(`typed-build/${entry}.js`),
    `index.html does not load the entrypoint carrying ${name}: typed-build/${entry}.js`
  );
  assert.ok(
    swPolicy.includes(`typed-build/${entry}.js`),
    `service worker does not precache the entrypoint carrying ${name}: typed-build/${entry}.js`
  );
  return { source, entry };
}

/** Assert that a stylesheet still ships through index.html and the precache list. */
export function assertShippedStylesheet(name) {
  const asset = `/${String(name).replace(/^\/+/, '')}`;
  const file = shellAssetFile(asset);
  assert.ok(file && existsSync(file), `missing stylesheet: public${asset}`);
  assert.ok(indexHtmlAssets().includes(asset), `index.html does not load ${asset}`);
  assertShellAssets([asset], 'stylesheet');
}

/**
 * Assert the shell cache is at least `minimum`, the version at which a
 * feature's assets entered the precache list. Pinning an exact version made
 * every later PWA change fail unrelated suites, while the contract a feature
 * actually needs is that the cache was bumped at or after its own release.
 */
export function assertCacheVersionAtLeast(minimum, label) {
  assertVersionedCacheDeclaration();
  assert.ok(
    CURRENT_CACHE_VERSION >= minimum,
    label ?? `shell cache should be at least v${minimum}, found v${CURRENT_CACHE_VERSION}`
  );
}

/**
 * Assert the mount order of several browser modules. Modules sharing one
 * bundled entrypoint are ordered by their imports in that entrypoint; the
 * legacy suites expressed the same contract as index.html script order.
 */
export function assertMountOrder(names) {
  const app = readRepoFile('public/typed/legacy-app.ts');
  const html = readRepoFile('public/index.html');
  let previous = -1;
  for (const name of names) {
    const source = canonicalSource(name);
    assert.ok(source, `no canonical typed source for browser module: ${name}`);
    const relative = source.replace(/^public\/typed\//, '').replace(/\.ts$/, '');
    const inBundle = app.indexOf(`import './${relative}.ts';`);
    const index = inBundle >= 0 ? inBundle : html.indexOf(`typed-build/${path.basename(relative)}.js`);
    assert.ok(index >= 0, `browser module has no mount position: ${name}`);
    assert.ok(index > previous, `mount order regression at ${name}`);
    previous = index;
  }
}
