// Shared helpers for the bundled browser entrypoints.
//
// The TypeScript migration stopped shipping one `<script>` per feature. The
// remaining DOM modules now live in `public/typed/legacy/` and are pulled into
// a single Vite entry (`legacy-app`), while a handful of larger features keep
// their own entry. Suites must therefore assert that a feature is *reachable*
// from the page — part of a bundle that index.html loads and the service
// worker caches — instead of looking for a per-feature `/<name>.js` URL that
// no longer exists.
// This module is a helper, not a suite (run-checks only executes test-*/validate-*).

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const readRoot = (relative) => readFileSync(path.join(ROOT, relative), 'utf8');

export const LEGACY_BUNDLE_ENTRY = 'legacy-app';
export const LEGACY_BUNDLE_URL = `/typed-build/${LEGACY_BUNDLE_ENTRY}.js`;

/** Browser source of a module, wherever the migration left it. */
export function browserModulePath(name) {
  const candidates = [
    `public/typed/legacy/${name}.ts`,
    `public/typed/${name}.ts`,
    `public/${name}.ts`,
    `public/${name}.js`
  ];
  const found = candidates.find((candidate) => existsSync(path.join(ROOT, candidate)));
  assert.ok(found, `browser module ${name} exists in public/`);
  return found;
}

export function readBrowserModule(name) {
  return readRoot(browserModulePath(name));
}

/** The Vite entry that ships `name` to the browser. */
export function bundleEntryFor(name) {
  const vite = readRoot('vite.config.ts');
  const modulePath = browserModulePath(name);
  const ownEntry = new RegExp(`'([\\w-]+)':\\s*resolve\\(ROOT,\\s*'${modulePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'\\)`);
  const own = ownEntry.exec(vite);
  if (own) return own[1];
  const legacyApp = readRoot('public/typed/legacy-app.ts');
  assert.match(
    legacyApp,
    new RegExp(`import '\\./legacy/${name}\\.ts';`),
    `${name} is pulled into the ${LEGACY_BUNDLE_ENTRY} bundle`
  );
  return LEGACY_BUNDLE_ENTRY;
}

/** URL the browser actually requests for `name`. */
export function bundleUrlFor(name) {
  return `/typed-build/${bundleEntryFor(name)}.js`;
}

/**
 * Asserts a browser module reaches the page: it has a source file, a Vite
 * entry, a `<script>` tag on index.html and a shell-cache entry so it also
 * works offline.
 */
export function assertBundledModule(name, { html = readRoot('public/index.html'), sw = readRoot('public/sw-policy.ts') } = {}) {
  const url = bundleUrlFor(name);
  assert.ok(html.includes(`src="${url}"`), `index.html loads ${name} through ${url}`);
  assert.ok(sw.includes(`"${url}"`), `service worker caches ${url} for ${name}`);
  return url;
}

/** Asserts a stylesheet is linked by index.html, cached, and present on disk. */
export function assertStylesheet(name, { html = readRoot('public/index.html'), sw = readRoot('public/sw-policy.ts') } = {}) {
  const href = `/${name}.css`;
  assert.ok(existsSync(path.join(ROOT, 'public', `${name}.css`)), `public/${name}.css exists`);
  assert.ok(html.includes(`href="${href}"`), `index.html links ${href}`);
  assert.ok(sw.includes(`"${href}"`), `service worker caches ${href}`);
  return href;
}
