import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../public/code-block-copy.js', import.meta.url), 'utf8');
const module = { exports: {} };
vm.runInNewContext(source, { module, exports: module.exports, globalThis: {}, self: {} });
const api = module.exports;

class FakeClassList {
  constructor() {
    this.values = new Set();
  }

  contains(value) {
    return this.values.has(value);
  }

  toggle(value, force) {
    const enabled = force === undefined ? !this.values.has(value) : Boolean(force);
    if (enabled) this.values.add(value);
    else this.values.delete(value);
    return enabled;
  }
}

class FakeElement {
  constructor(tagName) {
    this.tagName = String(tagName || '').toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.dataset = {};
    this.classList = new FakeClassList();
    this.className = '';
    this.textContent = '';
    this.disabled = false;
    this.attributes = new Map();
    this.listeners = new Map();
    this.type = '';
    this.id = '';
    this.title = '';
  }

  get nextSibling() {
    if (!this.parentNode) return null;
    const index = this.parentNode.children.indexOf(this);
    return index >= 0 ? this.parentNode.children[index + 1] || null : null;
  }

  setAttribute(name, value) {
    this.attributes.set(String(name), String(value));
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  emit(type) {
    for (const listener of [...(this.listeners.get(type) || [])]) listener({ type, currentTarget: this });
  }

  detach(node) {
    if (!node?.parentNode) return;
    const siblings = node.parentNode.children;
    const index = siblings.indexOf(node);
    if (index >= 0) siblings.splice(index, 1);
    node.parentNode = null;
  }

  append(...nodes) {
    for (const node of nodes) {
      this.detach(node);
      this.children.push(node);
      node.parentNode = this;
    }
  }

  prepend(...nodes) {
    for (const node of [...nodes].reverse()) {
      this.detach(node);
      this.children.unshift(node);
      node.parentNode = this;
    }
  }

  insertBefore(node, reference) {
    this.detach(node);
    const index = reference ? this.children.indexOf(reference) : -1;
    if (index < 0) this.children.push(node);
    else this.children.splice(index, 0, node);
    node.parentNode = this;
    return node;
  }

  remove() {
    this.detach(this);
  }

  querySelector(selector) {
    if (selector !== ':scope > code') return null;
    return this.children.find((child) => child.tagName === 'CODE') || null;
  }
}

function findByClass(root, className) {
  return root.children.find((child) => child.className === className) || null;
}

function createFixture() {
  const head = new FakeElement('head');
  const messages = new FakeElement('main');
  const pre = new FakeElement('pre');
  const code = new FakeElement('code');
  code.dataset.language = 'js';
  code.textContent = 'const answer = 42;\r\n';
  pre.append(code);
  messages.append(pre);
  messages.querySelectorAll = () => [pre];

  const documentRef = {
    head,
    querySelector(selector) {
      if (selector === '#messages') return messages;
      if (selector === `#${api.STYLE_ID}`) return head.children.find((child) => child.id === api.STYLE_ID) || null;
      return null;
    },
    createElement(tagName) {
      return new FakeElement(tagName);
    }
  };

  return { documentRef, messages, pre, code };
}

const clipboardWrites = [];
const scheduled = new Set();
const cleared = [];
const observers = [];
class FakeObserver {
  constructor(callback) {
    this.callback = callback;
    this.disconnected = false;
    observers.push(this);
  }

  observe() {}

  disconnect() {
    this.disconnected = true;
  }
}

function setTimeoutImpl(fn) {
  const token = { fn };
  scheduled.add(token);
  return token;
}

function clearTimeoutImpl(token) {
  cleared.push(token);
  scheduled.delete(token);
}

const fixture = createFixture();
const controller = api.createController({
  documentRef: fixture.documentRef,
  clipboard: { async writeText(value) { clipboardWrites.push(value); } },
  secureContext: true,
  MutationObserverImpl: FakeObserver,
  setTimeoutImpl,
  clearTimeoutImpl
});

assert.equal(controller.mount(), true);
assert.equal(controller.mount(), false);
assert.equal(fixture.pre.dataset[api.MARKER], '1');
assert.equal(observers.length, 1);
const shell = fixture.messages.children[0];
assert.equal(shell.className, 'hafize-code-shell');
const wrapButton = findByClass(shell, 'hafize-code-wrap-toggle');
const copyButton = findByClass(shell, 'hafize-code-copy');
assert.ok(wrapButton);
assert.ok(copyButton);

wrapButton.emit('click');
assert.equal(fixture.pre.classList.contains(api.WRAP_CLASS), true);
copyButton.emit('click');
await Promise.resolve();
await Promise.resolve();
assert.deepEqual(clipboardWrites, ['const answer = 42;\n']);
assert.ok(scheduled.size > 0);

controller.destroy();
assert.equal(observers[0].disconnected, true);
assert.equal(fixture.messages.children[0], fixture.pre);
assert.equal(fixture.pre.parentNode, fixture.messages);
assert.equal(fixture.pre.dataset[api.MARKER], undefined);
assert.equal(fixture.pre.classList.contains(api.WRAP_CLASS), false);
assert.equal(shell.parentNode, null);
assert.equal(wrapButton.listeners.get('click')?.size || 0, 0);
assert.equal(copyButton.listeners.get('click')?.size || 0, 0);
assert.equal(scheduled.size, 0);
assert.ok(cleared.length > 0);

wrapButton.emit('click');
copyButton.emit('click');
await Promise.resolve();
assert.equal(fixture.pre.classList.contains(api.WRAP_CLASS), false);
assert.deepEqual(clipboardWrites, ['const answer = 42;\n']);
assert.equal(await controller.copy(copyButton, fixture.code), false);
assert.equal(controller.decorate(fixture.pre), false);
assert.equal(controller.decorateAll(fixture.messages), 0);
controller.destroy();

const remounted = api.createController({
  documentRef: fixture.documentRef,
  clipboard: { async writeText(value) { clipboardWrites.push(value); } },
  secureContext: true,
  MutationObserverImpl: FakeObserver,
  setTimeoutImpl,
  clearTimeoutImpl
});
assert.equal(remounted.mount(), true);
const freshShell = fixture.messages.children[0];
const freshCopyButton = findByClass(freshShell, 'hafize-code-copy');
assert.ok(freshCopyButton);
assert.notEqual(freshCopyButton, copyButton);
freshCopyButton.emit('click');
await Promise.resolve();
await Promise.resolve();
assert.deepEqual(clipboardWrites, ['const answer = 42;\n', 'const answer = 42;\n']);
remounted.destroy();

assert.ok(!source.includes('fetch('));
assert.ok(!source.includes('WebSocket'));
assert.ok(!source.includes('XMLHttpRequest'));
assert.ok(!source.includes('localStorage'));
assert.ok(!source.includes('sessionStorage'));
assert.ok(!source.includes('document.cookie'));

console.log('code block copy lifecycle contract ok');