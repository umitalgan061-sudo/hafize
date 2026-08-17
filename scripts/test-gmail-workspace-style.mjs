import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const styleLoader = require('../public/gmail-workspace-style.js');

assert.equal(styleLoader.HREF, '/gmail-workspace.css');
assert.equal(styleLoader.MARKER, 'data-hafize-gmail-workspace-style');
assert.equal(styleLoader.install(null), false);
assert.equal(styleLoader.install({}), false);

function createDocument({ existing = false } = {}) {
  const appended = [];
  const link = {
    attributes: new Map(),
    rel: '',
    href: '',
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
  };
  const documentRef = {
    head: {
      append(node) { appended.push(node); }
    },
    createElement(tag) {
      assert.equal(tag, 'link');
      return link;
    },
    querySelector(selector) {
      assert.equal(selector, 'link[data-hafize-gmail-workspace-style]');
      return existing ? link : null;
    }
  };
  return { documentRef, appended, link };
}

const first = createDocument();
assert.equal(styleLoader.install(first.documentRef), true);
assert.equal(first.appended.length, 1);
assert.equal(first.appended[0], first.link);
assert.equal(first.link.rel, 'stylesheet');
assert.equal(first.link.href, '/gmail-workspace.css');
assert.equal(first.link.attributes.get('data-hafize-gmail-workspace-style'), '1');

const existing = createDocument({ existing: true });
assert.equal(styleLoader.install(existing.documentRef), false);
assert.equal(existing.appended.length, 0, 'existing marker must prevent duplicate stylesheet insertion');

const missingCreateElement = {
  head: { append() { throw new Error('must not append'); } },
  querySelector() { return null; }
};
assert.equal(styleLoader.install(missingCreateElement), false);

console.log('gmail workspace style loader tests passed');
