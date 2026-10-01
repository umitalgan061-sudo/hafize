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

/** Prefix of the generated Vite entrypoints, which exist only after a build. */
export const TYPED_BUILD_PREFIX = '/typed-build/';

/**
 * Entry names declared in `vite.config.ts`, i.e. the `/typed-build/<name>.js`
 * URLs a build is guaranteed to emit. A fresh checkout has no build output, so
 * these shell assets are checked against the config rather than the disk.
 */
export function viteBuildEntries() {
  const config = readFileSync(path.join(ROOT, 'vite.config.ts'), 'utf8');
  return new Set([...config.matchAll(/^\s*'([\w-]+)':\s*resolve\(ROOT,/gm)].map((match) => match[1]));
}

/**
 * Local file backing a shell asset path, or null when the path is not a static
 * file: the bare `/` entry maps to index.html, a generated `/typed-build/` URL
 * has no checked-in source, and anything escaping `public/` is rejected.
 */
export function shellAssetFile(assetPath) {
  if (assetPath === '/') return path.join(PUBLIC_DIR, 'index.html');
  if (!assetPath.startsWith('/') || assetPath.includes('..')) return null;
  if (assetPath.startsWith(TYPED_BUILD_PREFIX)) return null;
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
 * Same-origin CSS/JS URLs that browser code injects at runtime instead of
 * declaring in the page — the smart-insert bundle, for one, is appended by
 * `prompt-library-enhancements.js` once the prompt library card mounts. They
 * belong in the shell cache just like a `<script>` tag, so the sync check
 * below has to see them too.
 */
export function injectedRuntimeAssets() {
  const found = new Set();
  for (const entry of readdirSync(PUBLIC_DIR, { withFileTypes: true })) {
    if (!entry.isFile() || !/\.(js|ts)$/.test(entry.name) || entry.name === 'sw-policy.js') continue;
    const source = readFileSync(path.join(PUBLIC_DIR, entry.name), 'utf8');
    for (const match of source.matchAll(/['"](\/[\w./-]+\.(?:css|js))['"]/g)) found.add(match[1]);
  }
  return found;
}

/** Every same-origin shell asset the app loads, however it is loaded. */
export function referencedShellAssets() {
  return new Set([...indexHtmlAssets(), ...injectedRuntimeAssets()]);
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

  // A shell path that 404s is what broke the install before: `addAll` rejected
  // as a whole and the offline shell never cached anything. Every entry must
  // therefore resolve to something the server can actually serve — a file in
  // `public/`, or a `/typed-build/` URL the Vite build is declared to emit.
  const buildEntries = viteBuildEntries();
  assert.ok(buildEntries.size > 0, 'vite build entries are discoverable');
  for (const asset of swPolicy.SHELL_ASSETS) {
    if (asset.startsWith(TYPED_BUILD_PREFIX)) {
      const entry = asset.slice(TYPED_BUILD_PREFIX.length).replace(/\.js$/, '');
      assert.ok(buildEntries.has(entry), `generated shell asset ${asset} is a declared Vite entry`);
      continue;
    }
    const file = shellAssetFile(asset);
    assert.ok(file && existsSync(file), `shell asset ${asset} exists on disk`);
  }

  // The list is kept in sync with the app in both directions: everything the
  // app loads is cached, so the feature still works offline, and nothing else
  // is carried around for free. Runtime-injected assets count as loaded.
  for (const asset of indexHtmlAssets()) {
    assert.ok(swPolicy.SHELL_ASSETS.includes(asset), `index.html asset ${asset} is cached by the service worker`);
  }
  for (const asset of injectedRuntimeAssets()) {
    if (!/^\/[\w./-]+\.(?:css|js)$/.test(asset) || asset.startsWith('/api/')) continue;
    if (!existsSync(path.join(PUBLIC_DIR, asset.slice(1)))) continue;
    assert.ok(
      swPolicy.SHELL_ASSETS.includes(asset),
      `runtime-injected asset ${asset} is cached by the service worker`
    );
  }
  const referenced = referencedShellAssets();
  for (const asset of swPolicy.SHELL_ASSETS) {
    if (NON_INDEX_SHELL_ASSETS.includes(asset) || !/\.(css|js)$/.test(asset)) continue;
    assert.ok(referenced.has(asset), `shell asset ${asset} is still loaded by the app`);
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
 * Asserts the shell cache has been bumped at least as far as the version a
 * feature shipped in.
 *
 * A suite must never pin the exact version: every later shell change bumps it
 * again, which used to leave a trail of suites failing on a number that was
 * only ever correct on the day they were written. What the feature actually
 * needs is that its own bump happened and was never rolled back.
 */
export function assertCacheVersionAtLeast(version, feature) {
  assert.ok(Number.isInteger(version) && version > 0, 'expected a positive integer cache version');
  assert.ok(
    CURRENT_CACHE_VERSION >= version,
    `${feature}: shell cache is v${CURRENT_CACHE_VERSION} but must be at least v${version}`
  );
}
