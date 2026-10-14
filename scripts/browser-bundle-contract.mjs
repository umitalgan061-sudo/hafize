// Shared browser-bundle contract helpers.
//
// Before the TypeScript migration every feature shipped as its own
// `public/<feature>.js` file and `index.html` carried one `<script>` per
// feature, so suites asserted that file name. Vite now bundles the typed
// sources into `public/typed-build/`, and the remaining single-purpose browser
// modules ride along inside `legacy-app.js`. These helpers assert the wiring
// that actually ships: a real typed source, a declared bundle entry, the page
// loading that bundle and the service worker caching it.
// (Helper module: run-checks only executes `test-*` and `validate-*`.)

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const LEGACY_BUNDLE = '/typed-build/legacy-app.js';

const read = (file) => readFileSync(path.join(ROOT, file), 'utf8');

/** Typed source backing a browser module name, or null when there is none. */
export function browserModuleSource(name) {
  for (const candidate of [`public/typed/legacy/${name}.ts`, `public/typed/${name}.ts`, `public/${name}.ts`]) {
    if (existsSync(path.join(ROOT, candidate))) return candidate;
  }
  return null;
}

/** Vite entry name -> source path, parsed from `vite.config.ts`. */
export function viteEntries() {
  const config = read('vite.config.ts');
  const entries = new Map();
  for (const match of config.matchAll(/'([A-Za-z0-9-]+)':\s*resolve\(ROOT,\s*'([^']+)'\)/g)) {
    entries.set(match[1], match[2]);
  }
  return entries;
}

/** Bundle path the browser really downloads for a module name. */
export function bundlePathFor(name) {
  const source = browserModuleSource(name);
  assert.ok(source, `browser module ${name} has no typed source`);
  if (isLegacyBundleMember(name)) return LEGACY_BUNDLE;
  assert.ok(viteEntries().has(name), `vite.config.ts declares an entry for ${name}`);
  return `/typed-build/${name}.js`;
}

/** True when the module ships inside the bundled legacy entry. */
export function isLegacyBundleMember(name) {
  return existsSync(path.join(ROOT, `public/typed/legacy/${name}.ts`));
}

/**
 * Asserts a browser module still reaches the browser: typed source present,
 * bundled (directly or through the legacy entry), loaded by the page and
 * cached by the service worker shell.
 */
export function assertBrowserModuleShipped(name) {
  const source = browserModuleSource(name);
  assert.ok(source, `browser module ${name} has a typed source`);
  const bundle = bundlePathFor(name);
  if (isLegacyBundleMember(name)) {
    assert.match(
      read('public/typed/legacy-app.ts'),
      new RegExp(`'\\./legacy/${name}\\.ts'`),
      `legacy-app.ts imports ${name}`
    );
  }
  const html = read('public/index.html');
  assert.ok(html.includes(`src="${bundle}"`), `index.html loads ${bundle} for ${name}`);
  assert.ok(read('public/sw-policy.ts').includes(`"${bundle}"`), `the shell caches ${bundle} for ${name}`);
}

/** Same contract for several modules at once. */
export function assertBrowserModulesShipped(names) {
  for (const name of names) assertBrowserModuleShipped(name);
}

/** Legacy module names in the order `legacy-app.ts` imports them. */
export function legacyBundleOrder() {
  const entry = read('public/typed/legacy-app.ts');
  return [...entry.matchAll(/'\.\/legacy\/([A-Za-z0-9-]+)\.ts'/g)].map((match) => match[1]);
}

/**
 * Asserts the bundled legacy modules still mount in the given relative order.
 * The page used to carry one `<script>` per module, so load order was asserted
 * against `index.html`; inside the bundle the import order in `legacy-app.ts`
 * is what decides it.
 */
export function assertLegacyBundleOrder(names) {
  const order = legacyBundleOrder();
  let previous = -1;
  for (const name of names) {
    const index = order.indexOf(name);
    assert.ok(index >= 0, `legacy-app.ts imports ${name}`);
    assert.ok(index > previous, `${name} mounts after the previous module in the legacy bundle`);
    previous = index;
  }
}

/** Asserts the page loads a module's bundle after the application shell. */
export function assertLoadsAfterAppShell(name) {
  const html = read('public/index.html');
  const bundle = bundlePathFor(name);
  const shellIndex = html.indexOf('src="/typed-build/app-shell.js"');
  assert.ok(shellIndex >= 0, 'index.html loads the application shell bundle');
  if (bundle === '/typed-build/app-shell.js') return;
  assert.ok(html.indexOf(`src="${bundle}"`) > shellIndex, `${bundle} loads after the application shell`);
}
