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

/** Same-origin CSS/JS URLs referenced by `public/index.html`. */
export function indexHtmlAssets() {
  const html = readFileSync(path.join(PUBLIC_DIR, 'index.html'), 'utf8');
  const found = new Set();
  for (const match of html.matchAll(/(?:href|src)="(\/[^"?#]+\.(?:css|js))"/g)) found.add(match[1]);
  return [...found];
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
  for (const asset of swPolicy.SHELL_ASSETS) {
    const file = shellAssetFile(asset);
    assert.ok(file && existsSync(file), `shell asset ${asset} exists on disk`);
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
