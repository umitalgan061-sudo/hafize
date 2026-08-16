import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../public/github-write-readiness-style.js');

assert.equal(api.HREF, '/github-write-readiness.css');
assert.equal(api.MARKER, 'data-hafize-github-write-readiness-style');

let existing = null;
const appended = [];
const documentRef = {
  head: { append(node) { appended.push(node); existing = node; } },
  querySelector(selector) {
    return selector === `link[${api.MARKER}]` ? existing : null;
  },
  createElement(tag) {
    assert.equal(tag, 'link');
    return {
      rel: '', href: '', attributes: new Map(),
      setAttribute(name, value) { this.attributes.set(name, String(value)); }
    };
  }
};

const originalDocument = globalThis.document;
try {
  globalThis.document = documentRef;
  assert.equal(api.mount(), false, 'CommonJS loader must not capture a later global document');
} finally {
  globalThis.document = originalDocument;
}

assert.match(api.MARKER, /^data-hafize-/);
assert.ok(api.HREF.startsWith('/'));
assert.equal(api.HREF.includes('://'), false);
assert.equal(api.HREF.includes('?'), false);
assert.equal(api.HREF.includes('#'), false);

console.log('github write readiness style loader contract passed');
