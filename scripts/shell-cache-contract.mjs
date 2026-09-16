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
export const swPolicy = require('../public/sw-policy.js');
export const CACHE_VERSION_PATTERN = /^hafize-shell-v(\d+)$/;
export const CURRENT_CACHE_VERSION = Number(CACHE_VERSION_PATTERN.exec(swPolicy.CURRENT_CACHE)?.[1] ?? NaN);

/** Source text of `public/sw-policy.js`, for suites that assert on the file itself. */
export function readSwPolicySource() {
  return readFileSync(path.join(PUBLIC_DIR, 'sw-policy.js'), 'utf8');
}

/** Local file backing a shell asset path, or null for the bare `/` entry. */
export function shellAssetFile(assetPath) {
  if (assetPath === '/') return path.join(PUBLIC_DIR, 'index.html');
  if (!assetPath.startsWith('/') || assetPath.includes('..')) return null;
  return path.join(PUBLIC_DIR, assetPath.slice(1));
}

/**
 * Entry name → TypeScript source, read from the Vite config.
 *
 * `public/typed-build/*.js` is produced by `npm run build`, so it is absent in a
 * clean checkout. The invariant the shell cares about is that nothing stale is
 * listed, which is the same question as "does the build still emit this entry",
 * so a generated asset is checked against its Vite entry instead of the disk.
 */
export function viteEntrySources() {
  const config = readFileSync(path.join(ROOT, 'vite.config.ts'), 'utf8');
  const entries = new Map();
  for (const match of config.matchAll(/'([\w-]+)':\s*resolve\(ROOT,\s*'([^']+)'\)/g)) {
    entries.set(match[1], path.join(ROOT, match[2]));
  }
  return entries;
}

const GENERATED_PREFIX = '/typed-build/';

/** True when the asset is emitted by the build rather than committed. */
export function isGeneratedAsset(assetPath) {
  return typeof assetPath === 'string' && assetPath.startsWith(GENERATED_PREFIX);
}

/**
 * Asserts a generated asset is still produced: its Vite entry exists and the
 * TypeScript source behind that entry is on disk.
 */
export function assertGeneratedAsset(assetPath, entries = viteEntrySources()) {
  const name = assetPath.slice(GENERATED_PREFIX.length).replace(/\.js$/, '');
  const source = entries.get(name);
  assert.ok(source, `generated shell asset ${assetPath} has no Vite entry`);
  assert.ok(existsSync(source), `Vite entry ${name} points at a missing source`);
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
  // offline shell entirely: every entry must be backed by a real file, or — for
  // the compiled entries — by a Vite entry that still emits it.
  const entries = viteEntrySources();
  for (const asset of swPolicy.SHELL_ASSETS) {
    if (isGeneratedAsset(asset)) {
      assertGeneratedAsset(asset, entries);
      continue;
    }
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
