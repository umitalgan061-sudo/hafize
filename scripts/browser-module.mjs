// Loads a browser module the way the page does and hands back the API it
// publishes.
//
// The migrated modules are UMD: they assign `module.exports` when a CommonJS
// wrapper is present and fall back to a global otherwise. Under `"type":
// "module"` a `.ts` file is always an ES module, so `require()` of one returns
// an empty namespace and the API only ever reaches `globalThis`. Suites use
// this helper instead of `require()` so they read the same object the browser
// gets.
// This module is a helper, not a suite (run-checks only executes test-*/validate-*).

import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

/**
 * Imports `relativePath` (relative to the repository root) for its side effect
 * and returns `globalThis[globalName]`.
 */
export async function loadBrowserModule(relativePath, globalName) {
  await import(pathToFileURL(path.join(ROOT, relativePath)).href);
  const api = globalThis[globalName];
  assert.ok(api, `${relativePath} publishes ${globalName}`);
  return api;
}

/**
 * Minimal `document`/`window` stand-in for modules that self-mount at import
 * time. The mount path finds no elements and bails out, which is exactly what
 * the suites want: the module is loaded, nothing is rendered.
 */
export function installDomStub(overrides = {}) {
  const noop = () => {};
  const element = {
    style: {},
    dataset: {},
    classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    addEventListener: noop,
    removeEventListener: noop,
    setAttribute: noop,
    removeAttribute: noop,
    getAttribute: () => null,
    append: noop,
    appendChild: noop,
    replaceChildren: noop,
    remove: noop,
    querySelector: () => null,
    querySelectorAll: () => [],
    focus: noop,
    textContent: ''
  };
  const documentRef = {
    readyState: 'complete',
    documentElement: element,
    head: element,
    body: element,
    addEventListener: noop,
    removeEventListener: noop,
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: () => null,
    createElement: () => ({ ...element }),
    createTextNode: (value) => ({ textContent: String(value ?? '') }),
    ...overrides
  };
  globalThis.document = documentRef;
  if (!globalThis.window) globalThis.window = globalThis;
  if (!globalThis.matchMedia) globalThis.matchMedia = () => ({ matches: false, addEventListener: noop, removeEventListener: noop });
  return documentRef;
}
