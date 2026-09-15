import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('public/prompt-library-smart-insert.js', 'utf8');
assert.match(source, /role['\"]?, ['\"]dialog/);
assert.match(source, /aria-modal/);
assert.match(source, /aria-labelledby/);
assert.match(source, /Composer’a aktar/);
assert.match(source, /Akıllı doldur/);
assert.match(source, /Escape/);
assert.match(source, /\bTab\b/);
assert.match(source, /maxLength = MAX_VALUE/);
assert.match(source, /textContent =/);
assert.doesNotMatch(source, /innerHTML\s*=/);
assert.doesNotMatch(source, /outerHTML/);
assert.doesNotMatch(source, /fetch\s*\(/);
assert.doesNotMatch(source, /XMLHttpRequest/);

const events = [];
const listeners = new Map();
const document = {
  readyState: 'complete',
  body: { append() {} },
  documentElement: { append() {} },
  activeElement: null,
  createElement() {
    return {
      className: '',
      dataset: {},
      style: {},
      setAttribute() {},
      addEventListener(type, fn) { listeners.set(type, fn); },
      remove() {},
      append() {},
      appendChild() {},
      querySelector() { return null; },
      querySelectorAll() { return []; },
      textContent: '',
      value: '',
      focus() {},
      select() {}
    };
  },
  getElementById() { return null; },
  querySelector() { return null; }
};
const root = {
  document,
  MutationObserver: class { observe() {} disconnect() {} },
  localStorage: { getItem() { return '[]'; } },
  addEventListener(type, fn) { events.push([type, fn]); },
  removeEventListener() {},
  CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
  HafizePromptLibrary: {
    extractVariables(body) { return [...String(body).matchAll(/\{\{\s*([a-zA-Z0-9_-]{1,32})\s*\}\}/g)].map((m) => m[1]); },
    replaceVariables(body, values) { return body.replace(/\{\{\s*([a-zA-Z0-9_-]{1,32})\s*\}\}/g, (_m, n) => values[n] ?? ''); },
    loadItems() { return []; }
  },
  console,
  Event,
  setTimeout,
  clearTimeout
};

vm.runInNewContext(source, root);
assert.equal(events.some(([type]) => type === 'beforeunload'), true);
assert.equal(typeof listeners.get('click'), 'undefined');
console.log('prompt library smart-insert contracts: ok');
