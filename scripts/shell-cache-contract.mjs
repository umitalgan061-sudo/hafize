// Shared PWA shell-cache contract helpers.
//
// The service worker cache version is bumped on every shell change, so suites
// must never assert a literal version: they assert the invariants instead.
// This module is a helper, not a suite (run-checks only executes test-*/validate-*).

import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

export const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const PUBLIC_DIR = path.join(ROOT, 'public');
export const swPolicy = require('../public/sw-policy.js');
export const CACHE_VERSION_PATTERN = /^hafize-shell-v(\d+)$/;
export const CURRENT_CACHE_VERSION = Number(CACHE_VERSION_PATTERN.exec(swPolicy.CURRENT_CACHE)?.[1] ?? NaN);

/** Source text of `public/sw-policy.js`, for suites that assert on the file itself. */
export function readSwPolicySource() {
  return readFileSync(path.join(PUBLIC_DIR, 'sw-policy.js'), 'utf8');
}

export const TYPED_BUILD_PREFIX = '/typed-build/';

/**
 * Vite `build.lib.entry` map, read from `vite.config.ts` as the single source
 * of truth for which TypeScript file backs each `/typed-build/<name>.js` path.
 * Entries live under either `public/` or `public/typed/`, so the mapping cannot
 * be guessed from the path alone.
 */
export function typedBuildEntrySources() {
  const config = readFileSync(path.join(ROOT, 'vite.config.ts'), 'utf8');
  const entryBlock = /entry:\s*\{([\s\S]*?)\n\s*\},/.exec(config)?.[1] ?? '';
  const sources = new Map();
  for (const match of entryBlock.matchAll(/'([^']+)':\s*resolve\(ROOT,\s*'([^']+)'\)/g)) {
    sources.set(match[1], match[2]);
  }
  return sources;
}

const TYPED_BUILD_SOURCES = typedBuildEntrySources();

/**
 * Local file backing a shell asset path, or null for the bare `/` entry.
 *
 * `/typed-build/*.js` entries are Vite outputs that only exist after a build,
 * so they resolve to the TypeScript entry they are compiled from — that is the
 * file a contributor has to add for the cached path to be real.
 */
export function shellAssetFile(assetPath) {
  if (assetPath === '/') return path.join(PUBLIC_DIR, 'index.html');
  if (typeof assetPath !== 'string' || !assetPath.startsWith('/') || assetPath.includes('..')) return null;
  if (assetPath.startsWith(TYPED_BUILD_PREFIX)) {
    const built = path.join(PUBLIC_DIR, assetPath.slice(1));
    if (existsSync(built)) return built;
    const entryName = assetPath.slice(TYPED_BUILD_PREFIX.length).replace(/\.js$/, '');
    const source = TYPED_BUILD_SOURCES.get(entryName);
    return source ? path.join(ROOT, source) : null;
  }
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
 * Same-origin CSS/JS URLs pulled in at runtime rather than from the page:
 * feature loaders such as `prompt-library-enhancements.js` inject their own
 * `<script>`/`<link>` tags, so those paths never appear in index.html but must
 * still be cached for the feature to work offline.
 */
export function dynamicShellAssets() {
  const found = new Set();
  for (const entry of readdirSync(PUBLIC_DIR, { withFileTypes: true })) {
    if (!entry.isFile() || entry.name === 'sw-policy.js') continue;
    if (!/\.(js|ts)$/.test(entry.name)) continue;
    const source = readFileSync(path.join(PUBLIC_DIR, entry.name), 'utf8');
    for (const match of source.matchAll(/['"`](\/[A-Za-z0-9._\-/]+\.(?:css|js))['"`]/g)) found.add(match[1]);
  }
  return [...found];
}

/** Every same-origin asset the app is known to request: page markup plus runtime loaders. */
export function referencedShellAssets() {
  return new Set([...indexHtmlAssets(), ...dynamicShellAssets()]);
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
 * Legacy `public/<name>.js` shims left by the TypeScript migration. The page
 * now loads `/typed-build/<name>.js` directly, so these are not part of the
 * shell: they only re-import the built module for a browser still holding a
 * previously cached `index.html`. They must stay out of `SHELL_ASSETS` (a shim
 * is not a shell asset) while still pointing at a real Vite entry.
 */
export const LEGACY_BRIDGE_FILES = Object.freeze([
  'markdown-renderer.js', 'conversation-workspace.js', 'message-workspace.js',
  'prompt-library.js', 'scheduled-tasks.js'
]);

/**
 * Asserts each legacy shim re-imports a `/typed-build/<name>.js` path that is
 * a declared Vite entry — the `.ts.js` typo this guards against turned three
 * shims into a guaranteed 404 dynamic import.
 */
export function assertLegacyBridgeTargets() {
  const typedEntries = typedBuildEntrySources();
  for (const name of LEGACY_BRIDGE_FILES) {
    const file = path.join(PUBLIC_DIR, name);
    if (!existsSync(file)) continue;
    const source = readFileSync(file, 'utf8');
    const target = /import\('(\/typed-build\/[^']+\.js)'\)/.exec(source)?.[1];
    assert.ok(target, `legacy shim ${name} re-imports a built module`);
    const entryName = target.slice(TYPED_BUILD_PREFIX.length).replace(/\.js$/, '');
    assert.ok(typedEntries.has(entryName), `legacy shim ${name} targets Vite entry ${entryName}`);
    assert.equal(
      swPolicy.SHELL_ASSETS.includes('/' + name), false,
      `legacy shim /${name} stays out of the shell cache`
    );
  }
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

  // The list is kept in sync with the app in both directions: everything the
  // page or a runtime loader requests is cached, and nothing else is carried
  // around for free.
  const indexAssets = new Set(indexHtmlAssets());
  for (const asset of indexAssets) {
    assert.ok(swPolicy.SHELL_ASSETS.includes(asset), `index.html asset ${asset} is cached by the service worker`);
  }
  const referenced = referencedShellAssets();
  for (const asset of swPolicy.SHELL_ASSETS) {
    if (NON_INDEX_SHELL_ASSETS.includes(asset) || !/\.(css|js)$/.test(asset)) continue;
    assert.ok(referenced.has(asset), `shell asset ${asset} is still requested by the app`);
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

/**
 * Asserts the shell cache was bumped at or past `minimum`.
 *
 * A feature suite cares that its own shell change forced a cache bump, not
 * which number the cache is on today: pinning the literal makes every later
 * feature's bump fail every earlier feature's gate.
 */
export function assertMinimumCacheVersion(minimum, label = 'shell cache') {
  assertVersionedCacheDeclaration();
  assert.ok(
    CURRENT_CACHE_VERSION >= minimum,
    `${label} must stay at v${minimum} or later, found v${CURRENT_CACHE_VERSION}`
  );
}
