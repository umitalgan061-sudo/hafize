// Shared harness for loading a `public/*.js` browser module under Node.
//
// The frontend modules are IIFEs that resolve their root as
// `typeof globalThis !== 'undefined' ? globalThis : self` and attach their API
// to it. Suites used to re-implement that logic inline and assert on the copy,
// which tests nothing about the product, so this harness runs the real file.
//
// The source is evaluated in the current realm with `globalThis`/`self` bound to
// a stub root. Staying in-realm matters: values built inside a `vm` context get
// that context's intrinsics, and `assert.deepStrictEqual` compares prototypes,
// so cross-realm arrays never match.
//
// With no `document` on the stub root the modules skip mounting and only publish
// their pure API, which is exactly the surface a unit test wants.
// This module is a helper, not a suite (run-checks only executes test-*/validate-*).

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const PUBLIC_DIR = path.join(ROOT, 'public');

/**
 * An in-memory `Storage` stand-in.
 *
 * `failOn` makes the matching operations throw the way a browser does when the
 * quota is exhausted or when site data is blocked, so suites can assert that a
 * module degrades instead of propagating the error.
 */
export function createStorage(initial = {}, { failOn = [] } = {}) {
  const data = new Map(Object.entries(initial));
  const guard = (operation) => {
    if (failOn.includes(operation)) throw new Error(`storage ${operation} blocked`);
  };
  return {
    get length() { return data.size; },
    key(index) { return [...data.keys()][index] ?? null; },
    getItem(name) { guard('getItem'); return data.has(String(name)) ? data.get(String(name)) : null; },
    setItem(name, value) { guard('setItem'); data.set(String(name), String(value)); },
    removeItem(name) { guard('removeItem'); data.delete(String(name)); },
    clear() { guard('clear'); data.clear(); },
    /** Test-only view of the backing map, so suites can assert isolation between keys. */
    snapshot() { return Object.fromEntries(data); }
  };
}

/** Records events a module dispatches on its root, so suites can assert on them. */
export function createEventRecorder() {
  const listeners = new Map();
  const dispatched = [];
  return {
    dispatched,
    addEventListener(type, handler) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(handler);
    },
    removeEventListener(type, handler) {
      listeners.get(type)?.delete(handler);
    },
    dispatchEvent(event) {
      dispatched.push(event);
      for (const handler of listeners.get(event?.type) ?? []) handler(event);
      return true;
    },
    /** Number of listeners still registered, so suites can assert teardown. */
    listenerCount(type) {
      if (type === undefined) return [...listeners.values()].reduce((total, set) => total + set.size, 0);
      return listeners.get(type)?.size ?? 0;
    }
  };
}

/** Minimal `CustomEvent` stand-in for roots that have no DOM. */
class HarnessCustomEvent {
  constructor(type, options = {}) {
    this.type = String(type);
    this.detail = options.detail;
  }
}

/**
 * Builds the stub root a browser module is evaluated against.
 * `overrides` replaces or adds anything a specific suite needs.
 */
const HARNESS_ROOT = Symbol.for('hafize.harness.root');

export function createRoot(overrides = {}) {
  const recorder = createEventRecorder();
  const root = {
    [HARNESS_ROOT]: true,
    CustomEvent: HarnessCustomEvent,
    Event: HarnessCustomEvent,
    localStorage: createStorage(),
    setTimeout,
    clearTimeout,
    addEventListener: recorder.addEventListener,
    removeEventListener: recorder.removeEventListener,
    dispatchEvent: recorder.dispatchEvent,
    ...overrides
  };
  root.events = overrides.events ?? recorder;
  return root;
}

/**
 * Evaluates `public/<fileName>` with `globalThis`/`self` bound to a stub root.
 *
 * Accepts either a root from `createRoot` or a plain overrides object, which is
 * wrapped so a caller never silently loses the default stubs.
 * Returns the root so the caller can read whatever the module published.
 */
export function loadBrowserModule(fileName, rootOrOverrides = {}) {
  const root = rootOrOverrides?.[HARNESS_ROOT] ? rootOrOverrides : createRoot(rootOrOverrides);
  const file = path.join(PUBLIC_DIR, fileName);
  const source = readFileSync(file, 'utf8');
  // eslint-disable-next-line no-new-func -- loading the shipped file is the point of the harness.
  const run = new Function('globalThis', 'self', 'window', `${source}\n//# sourceURL=${file}`);
  run(root, root, root);
  return root;
}

/** Loads a module and returns the single global it publishes, plus its root. */
export function loadBrowserApi(fileName, globalName, overrides = {}) {
  const root = createRoot(overrides);
  loadBrowserModule(fileName, root);
  const api = root[globalName];
  if (!api) throw new Error(`${fileName} did not publish ${globalName}`);
  return { api, root };
}
