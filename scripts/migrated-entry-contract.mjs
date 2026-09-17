// Shared helpers for the modules that moved from `public/<name>.js` to
// TypeScript sources bundled into `public/typed-build/<name>.js`.
//
// Source-contract suites must read the TypeScript source, because that is the
// file a contributor edits, while markup and service-worker suites must assert
// the generated entry, because that is the file the browser loads. Both used to
// be spelled `public/<name>.js`, so every suite pointed at a file the migration
// removed. This module is a helper, not a suite (run-checks only executes
// test-*/validate-*).

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const PUBLIC_DIR = path.join(ROOT, 'public');
export const TYPED_BUILD_DIR = path.join(PUBLIC_DIR, 'typed-build');

/** Modules whose implementation now lives in TypeScript. */
export const MIGRATED_ENTRIES = Object.freeze([
  'prompt-library-smart-fill',
  'prompt-library-command-palette',
  'prompt-library-smart-fill-hints',
  'scheduled-tasks-countdown'
]);

function assertMigrated(name) {
  assert.ok(MIGRATED_ENTRIES.includes(name), `${name} is not a migrated entry`);
}

/** Absolute path of the TypeScript source behind a migrated entry. */
export function migratedSourcePath(name) {
  assertMigrated(name);
  return path.join(PUBLIC_DIR, `${name}.ts`);
}

/** TypeScript source text of a migrated entry. */
export function readMigratedSource(name) {
  return readFileSync(migratedSourcePath(name), 'utf8');
}

/** Bundled output of a migrated entry, as served to the browser. */
export function readMigratedBundle(name) {
  assertMigrated(name);
  return readFileSync(path.join(TYPED_BUILD_DIR, `${name}.js`), 'utf8');
}

/** Same-origin URL the page and the service worker use for a migrated entry. */
export function migratedEntryUrl(name) {
  assertMigrated(name);
  return `/typed-build/${name}.js`;
}

/** Asserts `html` loads the generated entry as a module and not the old path. */
export function assertMigratedEntryLoaded(html, name) {
  const url = migratedEntryUrl(name);
  assert.ok(
    html.includes(`<script type="module" src="${url}"></script>`),
    `index.html loads ${url} as a module`
  );
  assert.ok(!html.includes(`/${name}.js" defer`), `index.html no longer loads the pre-migration /${name}.js`);
}
