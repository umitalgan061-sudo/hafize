// Shared PWA shell-cache contract helpers.
//
// The service worker cache version is bumped on every shell change, so suites
// must never assert a literal version: they assert the invariants instead.
// This module is a helper, not a suite (run-checks only executes test-*/validate-*).

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as swPolicyModule from '../public/sw-policy.ts';

export const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const PUBLIC_DIR = path.join(ROOT, 'public');
export const swPolicy = swPolicyModule;
export const CACHE_VERSION_PATTERN = /^hafize-shell-v(\d+)$/;
export const CURRENT_CACHE_VERSION = Number(CACHE_VERSION_PATTERN.exec(swPolicy.CURRENT_CACHE)?.[1] ?? NaN);

/** Source text of `public/sw-policy.ts`, for suites that assert on the file itself. */
export function readSwPolicySource() {
  return readFileSync(path.join(PUBLIC_DIR, 'sw-policy.ts'), 'utf8');
}

/**
 * Vite entry name -> TypeScript source, read from vite.config.ts.
 * `/typed-build/*.js` assets are build outputs, so what must exist in the
 * repository is the entry that produces them.
 */
export function typedBuildEntries() {
  const config = readFileSync(path.join(ROOT, 'vite.config.ts'), 'utf8');
  const entries = new Map();
  for (const match of config.matchAll(/'([A-Za-z0-9._-]+)':\s*resolve\(ROOT,\s*'([^']+)'\)/g)) {
    entries.set(match[1], path.join(ROOT, match[2]));
  }
  return entries;
}

/** Local file backing a shell asset path, or null for the bare `/` entry. */
export function shellAssetFile(assetPath) {
  if (assetPath === '/') return path.join(PUBLIC_DIR, 'index.html');
  if (!assetPath.startsWith('/') || assetPath.includes('..')) return null;
  const built = /^\/typed-build\/([A-Za-z0-9._-]+)\.js$/.exec(assetPath);
  if (built) return typedBuildEntries().get(built[1]) ?? null;
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
  // The policy is an ES module now, so its namespace cannot be reassigned from
  // outside at all; what still needs asserting is that the exported collections
  // cannot be mutated in place.
  assert.ok(Object.isFrozen(swPolicy.SHELL_ASSETS));
  assert.ok(Object.isFrozen(swPolicy.SW_POLICY_LIMITS));

  assert.equal(swPolicy.SHELL_ASSETS.some((asset) => asset.startsWith('/api/')), false, 'API paths never enter the shell cache');
  assert.equal(new Set(swPolicy.SHELL_ASSETS).size, swPolicy.SHELL_ASSETS.length, 'shell assets are unique');

  // `cache.addAll()` rejects as a whole, so one stale path disables the
  // offline shell entirely: every entry must be backed by a real file.
  for (const asset of swPolicy.SHELL_ASSETS) {
    const file = shellAssetFile(asset);
    assert.ok(file && existsSync(file), `shell asset ${asset} is backed by a source file`);
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

/**
 * Shell asset that now delivers a browser module.
 *
 * A module is either its own Vite entry (`/typed-build/<name>.js`) or one of the
 * modules bundled into the single legacy entry (`/typed-build/legacy-app.js`).
 * Suites assert the delivering asset instead of a pre-migration `/x.js` path,
 * which no longer exists and is not cached.
 */
const MODULE_RENAMES = Object.freeze({ app: 'app-shell' });

export function shellAssetForBrowserModule(rawName) {
  const name = MODULE_RENAMES[rawName] ?? rawName;
  if (typedBuildEntries().has(name)) return `/typed-build/${name}.js`;
  if (existsSync(path.join(PUBLIC_DIR, 'typed', 'legacy', `${name}.ts`))) return '/typed-build/legacy-app.js';
  throw new Error(`UNKNOWN_BROWSER_MODULE:${name}`);
}

/**
 * Asserts a browser module is still delivered to the page and survives offline.
 *
 * A module that is not its own Vite entry is bundled into the single legacy entry,
 * so its pre-migration `/x.js` filename no longer appears in index.html or in the
 * shell list. What must still hold is that the entry carrying it is loaded by the
 * page and cached by the service worker, and that the legacy entry imports it.
 */
export function assertModuleDelivered(name) {
  const asset = shellAssetForBrowserModule(name);
  const html = readFileSync(path.join(PUBLIC_DIR, 'index.html'), 'utf8');
  assert.ok(html.includes(`src="${asset}"`), `index.html loads ${asset} for ${name}`);
  assert.ok(swPolicy.SHELL_ASSETS.includes(asset), `${asset} is cached for ${name}`);
  if (asset !== '/typed-build/legacy-app.js') return;
  const entry = readFileSync(path.join(PUBLIC_DIR, 'typed', 'legacy-app.ts'), 'utf8');
  assert.ok(entry.includes(`./legacy/${name}.ts`), `the legacy entry imports ${name}`);
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
