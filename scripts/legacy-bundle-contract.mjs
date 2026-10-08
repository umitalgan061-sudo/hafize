/**
 * Shared contract for browser modules that ship inside the unified legacy entry.
 *
 * Before the TypeScript waves each legacy module had its own `<script>` tag and
 * its own shell-cache entry, so suites asserted `/<module>.js` against
 * `index.html` and `sw-policy`. Those modules now live in
 * `public/typed/legacy/*.ts` and Vite bundles all of them into the single
 * `typed-build/legacy-app.js` entry, so the per-module URL assertions could only
 * pass by accident. This helper states the contract that actually holds:
 * the module is imported by the unified entry, and the unified entry is loaded
 * by the page and cached by the service worker.
 *
 * It is a helper, not a suite: `run-checks.mjs` only executes `test-*` and
 * `validate-*` files.
 */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

export const LEGACY_ENTRY_SOURCE = 'public/typed/legacy-app.ts';
export const LEGACY_ENTRY_URL = '/typed-build/legacy-app.js';

const read = (relative) => readFileSync(path.join(ROOT, relative), 'utf8');

/** Module names (without extension) the unified legacy entry imports, in order. */
export function legacyBundledModules() {
  const source = read(LEGACY_ENTRY_SOURCE);
  return [...source.matchAll(/^import '\.\/legacy\/([A-Za-z0-9_-]+)\.ts';$/gm)].map((match) => match[1]);
}

/**
 * Asserts a legacy browser module is part of the shipped bundle: the typed
 * source exists, the unified entry imports it, and the page plus the shell
 * cache load that unified entry.
 */
export function assertLegacyModuleBundled(moduleName, { html = read('public/index.html'), sw = read('public/sw-policy.ts') } = {}) {
  const source = path.posix.join('public/typed/legacy', `${moduleName}.ts`);
  assert.ok(existsSync(path.join(ROOT, source)), `${moduleName}: typed source ${source} exists`);
  assert.ok(legacyBundledModules().includes(moduleName), `${moduleName}: unified legacy entry imports it`);
  assert.ok(html.includes(LEGACY_ENTRY_URL), `${moduleName}: index.html loads ${LEGACY_ENTRY_URL}`);
  assert.ok(sw.includes(LEGACY_ENTRY_URL), `${moduleName}: shell cache carries ${LEGACY_ENTRY_URL}`);
}

/**
 * Asserts the unified legacy entry imports the given modules in this order.
 *
 * Mount order used to be the `<script>` order in `index.html`; with one bundled
 * entry the equivalent guarantee is the import order inside
 * `public/typed/legacy-app.ts`, which is the order Vite evaluates them in.
 */
export function assertLegacyModuleOrder(moduleNames) {
  const bundled = legacyBundledModules();
  const positions = moduleNames.map((name) => {
    const at = bundled.indexOf(name);
    assert.ok(at >= 0, `${name}: unified legacy entry imports it`);
    return at;
  });
  for (let index = 1; index < positions.length; index += 1) {
    assert.ok(
      positions[index - 1] < positions[index],
      `${moduleNames[index - 1]} is evaluated before ${moduleNames[index]}`
    );
  }
}

/** Asserts every given module ships inside the unified legacy entry. */
export function assertLegacyModulesBundled(moduleNames) {
  const html = read('public/index.html');
  const sw = read('public/sw-policy.ts');
  for (const moduleName of moduleNames) assertLegacyModuleBundled(moduleName, { html, sw });
}
