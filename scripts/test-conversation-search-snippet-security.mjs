import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const snippets = require('../public/conversation-search-snippets.js');

const source = String.raw`${snippets.createController}`;
assert.doesNotMatch(source, /fetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon/i);
assert.doesNotMatch(source, /innerHTML|outerHTML|insertAdjacentHTML/i);
assert.doesNotMatch(source, /sessionStorage|indexedDB|document\.cookie|clipboard/i);

const hostile = '<img src=x onerror=alert(1)> hedef & secret';
const text = snippets.boundedWindow(hostile, 'hedef');
assert.match(text, /<img src=x onerror=alert\(1\)>/);

const nodes = [];
const documentRef = {
  createElement(tag) {
    const node = {
      tag,
      className: '',
      textContent: '',
      hidden: false,
      removed: false,
      remove() { this.removed = true; }
    };
    nodes.push(node);
    return node;
  }
};
const row = {
  children: [],
  querySelector(selector) {
    return selector === `.${snippets.SNIPPET_CLASS}`
      ? this.children.find((node) => node.className === snippets.SNIPPET_CLASS) || null
      : null;
  },
  append(node) { this.children.push(node); }
};
assert.equal(snippets.renderRowSnippet(documentRef, row, hostile), true);
assert.equal(row.children.length, 1);
assert.equal(row.children[0].textContent, hostile);
assert.equal(row.children[0].hidden, false);
assert.equal(snippets.renderRowSnippet(documentRef, row, ''), true);
assert.equal(row.children[0].hidden, true);
assert.equal(row.children[0].textContent, '');

const many = Array.from({ length: snippets.MAX_CONVERSATIONS + 5 }, (_, index) => ({
  id: `conv-${index}`,
  messages: [{ role: 'user', content: `hedef ${index}` }]
}));
assert.equal(snippets.buildSnippetIndex(many, 'hedef').size, snippets.MAX_CONVERSATIONS);

const flood = {
  id: 'bounded-messages',
  messages: Array.from({ length: snippets.MAX_MESSAGES_PER_CONVERSATION + 10 }, (_, index) => ({
    role: 'user',
    content: index === snippets.MAX_MESSAGES_PER_CONVERSATION + 1 ? 'hedef-sonra' : `normal-${index}`
  }))
};
assert.equal(snippets.firstMessageSnippet(flood, 'hedef-sonra'), '');

console.log('conversation search snippet security tests passed');
