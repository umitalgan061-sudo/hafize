// Every Vite entry must parse and link.
//
// Two build-breaking faults reached this repo without any suite noticing,
// because the browser suites only grep source text:
//
//   - `conversation-forks.ts` held three concatenated copies of its own body
//     and ended on an unbalanced `})();` — a plain SyntaxError.
//   - `app-shell.ts` re-exported four names that live inside its IIFE, so the
//     entry failed to link with "Export 'fetchJson' is not defined in module".
//
// Either one stops `npm run build` from producing that entry and leaves the
// page loading a 404. This suite loads each entry under a small browser stub
// and fails on parse and link errors only: a module that runs far enough to
// trip over a stub gap has already proved it parses and links.

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const config = readFileSync(path.join(ROOT, 'vite.config.ts'), 'utf8');
const entryBlock = /entry:\s*\{([\s\S]*?)\n\s*\},/.exec(config)?.[1] ?? '';
const entries = [...entryBlock.matchAll(/'([^']+)':\s*resolve\(ROOT,\s*'([^']+)'\)/g)]
  .map(([, name, file]) => ({ name, file }));

assert.ok(entries.length > 10, `vite.config.ts declares build entries, found ${entries.length}`);
for (const { name, file } of entries) {
  assert.ok(existsSync(path.join(ROOT, file)), `entry ${name} source ${file} exists`);
}

const noop = () => {};
const node = () => ({
  querySelector: () => null, querySelectorAll: () => [], getElementById: () => null,
  addEventListener: noop, removeEventListener: noop, dispatchEvent: noop,
  setAttribute: noop, getAttribute: () => null, removeAttribute: noop, hasAttribute: () => false,
  append: noop, prepend: noop, after: noop, before: noop, remove: noop, replaceChildren: noop,
  appendChild: noop, insertBefore: noop, focus: noop, blur: noop, click: noop, select: noop,
  closest: () => null, contains: () => false, scrollIntoView: noop,
  classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
  dataset: {}, style: {}, children: [], childNodes: [], value: '', textContent: '', hidden: false
});
const storage = () => ({ getItem: () => null, setItem: noop, removeItem: noop, clear: noop, key: () => null, length: 0 });

globalThis.document = {
  ...node(),
  readyState: 'complete',
  createElement: node,
  createTextNode: () => node(),
  createDocumentFragment: node,
  body: node(),
  head: node(),
  documentElement: { ...node(), lang: 'tr' },
  activeElement: null
};
globalThis.window = globalThis;
globalThis.self = globalThis;
globalThis.localStorage = storage();
globalThis.sessionStorage = storage();
globalThis.matchMedia = () => ({ matches: false, addEventListener: noop, removeEventListener: noop, addListener: noop, removeListener: noop });
globalThis.MutationObserver = class { observe() {} disconnect() {} takeRecords() { return []; } };
globalThis.ResizeObserver = globalThis.MutationObserver;
globalThis.IntersectionObserver = globalThis.MutationObserver;
globalThis.CustomEvent = class { constructor(type, init = {}) { this.type = type; Object.assign(this, init); } };
globalThis.Event = globalThis.CustomEvent;
globalThis.StorageEvent = globalThis.CustomEvent;
globalThis.HTMLElement = class {};
globalThis.Element = class {};

const LINK_FAILURE = /\b(?:Unexpected|Expected|Invalid|Missing)\b|is not defined in module|does not provide an export|Cannot find module/;
const failures = [];
for (const { name, file } of entries) {
  try {
    await import(pathToFileURL(path.join(ROOT, file)).href);
  } catch (error) {
    const message = String(error?.message ?? error).split('\n')[0];
    if (error instanceof SyntaxError || LINK_FAILURE.test(message)) failures.push(`${name} (${file}): ${message}`);
  }
}
assert.deepEqual(failures, [], 'every Vite entry parses and links');

console.log(`Vite entry link gate OK: ${entries.length} entries parse and link`);
