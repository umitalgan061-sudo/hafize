import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const consent = require('../public/memory-consent-review.js');

class FakeClassList {
  constructor() { this.values = new Set(); }
  add(value) { this.values.add(value); }
  remove(value) { this.values.delete(value); }
  contains(value) { return this.values.has(value); }
}

class FakeNode {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.dataset = {};
    this.attributes = new Map();
    this.listeners = new Map();
    this.classList = new FakeClassList();
    this.hidden = false;
    this.value = '';
    this.textContent = '';
    this.className = '';
    this.id = '';
    this.focused = false;
  }
  append(...nodes) {
    for (const node of nodes) {
      node.parentNode = this;
      this.children.push(node);
    }
  }
  remove() {
    if (!this.parentNode) return;
    this.parentNode.children = this.parentNode.children.filter((child) => child !== this);
    this.parentNode = null;
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  removeAttribute(name) { this.attributes.delete(name); }
  addEventListener(type, listener) {
    const list = this.listeners.get(type) || [];
    list.push(listener);
    this.listeners.set(type, list);
  }
  removeEventListener(type, listener) {
    this.listeners.set(type, (this.listeners.get(type) || []).filter((item) => item !== listener));
  }
  dispatchEvent(event) {
    event.target ||= this;
    event.prevented ||= false;
    event.stopped ||= false;
    event.preventDefault ||= () => { event.prevented = true; };
    event.stopImmediatePropagation ||= () => { event.stopped = true; };
    for (const listener of [...(this.listeners.get(event.type) || [])]) {
      listener(event);
      if (event.stopped) break;
    }
    return !event.prevented;
  }
  click() { return this.dispatchEvent({ type: 'click', target: this }); }
  focus() { this.focused = true; }
  contains(target) {
    if (target === this) return true;
    return this.children.some((child) => child.contains?.(target));
  }
  closest(selector) {
    if (selector === '.memory-delete-btn' && this.className.includes('memory-delete-btn')) return this;
    return this.parentNode?.closest?.(selector) || null;
  }
  querySelector(selector) {
    if (selector === '[data-hafize-memory-review]') {
      return this.children.find((child) => child.dataset?.hafizeMemoryReview === '1') || null;
    }
    return null;
  }
  requestSubmit() { this.dispatchEvent({ type: 'submit', target: this }); }
}

const form = new FakeNode('form');
const kind = new FakeNode('select');
kind.value = 'preference';
const content = new FakeNode('textarea');
content.value = 'Sessiz kalıcı bellek yazımı istemiyorum.';
const results = new FakeNode('div');
const status = new FakeNode('p');
const head = new FakeNode('head');
const body = new FakeNode('body');
const deleteButton = new FakeNode('button');
deleteButton.className = 'memory-delete-btn';
deleteButton.dataset.memoryId = 'memory_abcdefgh';
results.append(deleteButton);

const nodes = new Map([
  ['#memoryWriteForm', form],
  ['#memoryWriteKind', kind],
  ['#memoryContent', content],
  ['#memoryResults', results],
  ['#memoryStatus', status]
]);
const documentListeners = new Map();
const documentRef = {
  body,
  head,
  querySelector(selector) {
    if (selector === 'link[data-hafize-memory-consent-style]') return null;
    return nodes.get(selector) || null;
  },
  createElement: (tag) => new FakeNode(tag),
  addEventListener(type, listener) { documentListeners.set(type, listener); },
  removeEventListener(type) { documentListeners.delete(type); }
};
let timerCallback = null;
const root = {
  setTimeout(callback) { timerCallback = callback; return 7; },
  clearTimeout() { timerCallback = null; }
};

let writes = 0;
form.addEventListener('submit', () => { writes += 1; });
let deletes = 0;
results.addEventListener('click', () => { deletes += 1; });

const controller = consent.install(documentRef, root);
assert.ok(controller);
assert.equal(head.children.some((node) => node.href === '/memory-consent-review.css'), true);

form.requestSubmit();
assert.equal(writes, 0, 'first submit must be intercepted before the memory write handler');
assert.ok(controller.getReview());
const reviewNode = form.children.find((node) => node.dataset?.hafizeMemoryReview === '1');
assert.ok(reviewNode);
assert.equal(reviewNode.hidden, false);
assert.match(status.textContent, /henüz yapılmadı/i);

const confirm = reviewNode.children.at(-1).children.at(-1);
confirm.click();
assert.equal(writes, 1, 'second explicit confirmation should release exactly one submit');
assert.equal(controller.getReview(), null);

content.value = 'Yeni içerik';
content.dispatchEvent({ type: 'input', target: content });
form.requestSubmit();
assert.equal(writes, 1);
content.value = 'Onaydan sonra değiştirilmiş içerik';
content.dispatchEvent({ type: 'input', target: content });
assert.equal(controller.getReview(), null, 'editing must invalidate the prepared review');

const firstDelete = { type: 'click', target: deleteButton };
results.dispatchEvent(firstDelete);
assert.equal(deletes, 0, 'first delete click must not reach the existing delete handler');
assert.equal(deleteButton.dataset.confirming, 'true');
assert.match(deleteButton.textContent, /Tekrar tıkla/i);
assert.equal(typeof timerCallback, 'function');

results.dispatchEvent({ type: 'click', target: deleteButton });
assert.equal(deletes, 1, 'second click on the same record should release one delete');
assert.equal(deleteButton.dataset.confirming, undefined);

results.dispatchEvent({ type: 'click', target: deleteButton });
assert.equal(deletes, 1);
timerCallback();
assert.equal(deleteButton.dataset.confirming, undefined);
assert.match(status.textContent, /zaman aşımına/i);

form.requestSubmit();
assert.ok(controller.getReview());
const escape = documentListeners.get('keydown');
escape({ key: 'Escape', preventDefault() {} });
assert.equal(controller.getReview(), null);
assert.equal(content.focused, true);

controller.destroy();
assert.equal(form.children.includes(reviewNode), false);
assert.equal(documentListeners.has('keydown'), false);

console.log('memory consent lifecycle tests passed');
