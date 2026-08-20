import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const cancelUi = require('../public/schedule-cancel.js');

class FakeElement {
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
    this.dataset = {};
    this.attributes = new Map();
    this.children = [];
    this.parentNode = null;
    this.className = '';
    this.textContent = '';
    this.hidden = false;
    this.disabled = false;
    this.isConnected = false;
    this.listeners = new Map();
  }
  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    if (name === 'data-hafize-schedule-cancel-style') this.dataset.hafizeScheduleCancelStyle = String(value);
  }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  removeAttribute(name) { this.attributes.delete(name); }
  append(...nodes) {
    for (const node of nodes) {
      node.parentNode = this;
      node.setConnected?.(this.isConnected);
      this.children.push(node);
    }
  }
  setConnected(value) {
    this.isConnected = Boolean(value);
    for (const child of this.children) child.setConnected?.(value);
  }
  remove() {
    if (!this.parentNode) return;
    this.parentNode.children = this.parentNode.children.filter((node) => node !== this);
    this.parentNode = null;
    this.setConnected(false);
  }
  addEventListener(name, listener) {
    if (!this.listeners.has(name)) this.listeners.set(name, []);
    this.listeners.get(name).push(listener);
  }
  removeEventListener(name, listener) {
    const entries = this.listeners.get(name) || [];
    this.listeners.set(name, entries.filter((candidate) => candidate !== listener));
  }
  listenerCount(name) { return (this.listeners.get(name) || []).length; }
  matches(selector) {
    if (selector === '.schedule-list-items') return this.className === 'schedule-list-items';
    if (selector === '.schedule-cancel-action') return this.className === 'schedule-cancel-action';
    if (selector === '.schedule-cancel-button') return this.className === 'schedule-cancel-button';
    if (selector === '.schedule-list-item[data-schedule-id]') {
      return this.className === 'schedule-list-item' && typeof this.dataset.scheduleId === 'string';
    }
    return false;
  }
  querySelector(selector) {
    return this.findAll(selector)[0] || null;
  }
  querySelectorAll(selector) { return this.findAll(selector); }
  findAll(selector) {
    const found = [];
    for (const child of this.children) {
      if (child.matches?.(selector)) found.push(child);
      found.push(...(child.findAll?.(selector) || []));
    }
    return found;
  }
  closest(selector) {
    let node = this;
    while (node) {
      if (node.matches?.(selector)) return node;
      node = node.parentNode;
    }
    return null;
  }
  contains(candidate) {
    if (candidate === this) return true;
    return this.children.some((child) => child.contains?.(candidate));
  }
}

function fixture({ observerObserveError = false } = {}) {
  const head = new FakeElement('head');
  const body = new FakeElement('body');
  const card = new FakeElement('section');
  const list = new FakeElement('div');
  list.className = 'schedule-list-items';
  const article = new FakeElement('article');
  article.className = 'schedule-list-item';
  article.dataset.scheduleId = 'sched-1';
  article.dataset.state = 'scheduled';
  list.append(article);
  card.append(list);
  body.append(card);
  head.setConnected(true);
  body.setConnected(true);

  const documentRef = {
    head,
    body,
    createElement: (tagName) => new FakeElement(tagName),
    querySelector(selector) {
      if (selector === '#scheduleListCard') return card;
      if (selector === 'link[data-hafize-schedule-cancel-style]' || selector === 'link[data-hafize-schedule-cancel-style="1"]') {
        return head.children.find((node) => node.getAttribute('data-hafize-schedule-cancel-style') === '1') || null;
      }
      if (selector === '[data-hafize-schedule-cancel-mounted]') {
        return card.getAttribute('data-hafize-schedule-cancel-mounted') !== null ? card : null;
      }
      return null;
    }
  };

  const rootListeners = new Map();
  class FakeObserver {
    constructor(callback) { this.callback = callback; this.disconnected = false; }
    observe() {
      if (observerObserveError) throw new Error('observer installation failed');
    }
    disconnect() { this.disconnected = true; }
  }
  const root = {
    fetch: async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) }),
    confirm: () => true,
    MutationObserver: FakeObserver,
    addEventListener(name, listener) {
      if (!rootListeners.has(name)) rootListeners.set(name, []);
      rootListeners.get(name).push(listener);
    },
    removeEventListener(name, listener) {
      const entries = rootListeners.get(name) || [];
      rootListeners.set(name, entries.filter((candidate) => candidate !== listener));
    }
  };
  return { documentRef, root, rootListeners, head, card, list, article };
}

function mount(f) {
  return cancelUi.mount(f.documentRef, f.root, {
    fetchImpl: f.root.fetch,
    confirmImpl: f.root.confirm
  });
}

{
  const f = fixture();
  const hostAction = new FakeElement('div');
  hostAction.className = 'schedule-cancel-action';
  const hostArticle = new FakeElement('article');
  hostArticle.className = 'schedule-list-item';
  hostArticle.dataset.scheduleId = 'host-2';
  hostArticle.dataset.state = 'scheduled';
  hostArticle.append(hostAction);
  f.list.append(hostArticle);

  const controller = mount(f);
  assert.ok(controller, 'first controller mounts');
  assert.equal(f.card.getAttribute('data-hafize-schedule-cancel-mounted'), '1');
  assert.equal(f.list.listenerCount('click'), 1);
  assert.equal((f.rootListeners.get('hafize:schedule-created') || []).length, 1);
  assert.equal(f.head.children.length, 1, 'controller-owned stylesheet installed');
  assert.equal(f.article.querySelectorAll('.schedule-cancel-action').length, 1, 'controller decorates scheduled article');
  assert.equal(hostArticle.querySelector('.schedule-cancel-action'), hostAction, 'pre-existing host action is preserved');

  assert.equal(mount(f), null, 'duplicate active mount fails closed');
  assert.equal(controller.destroy(), true);
  assert.equal(controller.destroy(), false, 'destroy is idempotent');
  assert.equal(f.card.getAttribute('data-hafize-schedule-cancel-mounted'), null, 'owned mount marker removed');
  assert.equal(f.list.listenerCount('click'), 0, 'list listener removed exactly');
  assert.equal((f.rootListeners.get('hafize:schedule-created') || []).length, 0, 'root listener removed exactly');
  assert.equal(f.head.children.length, 0, 'controller-owned stylesheet removed');
  assert.equal(f.article.querySelector('.schedule-cancel-action'), null, 'controller-owned action removed');
  assert.equal(hostArticle.querySelector('.schedule-cancel-action'), hostAction, 'host action survives teardown');

  const remounted = mount(f);
  assert.ok(remounted, 'destroy releases ownership for clean remount');
  remounted.destroy();
}

{
  const f = fixture();
  let addCalls = 0;
  f.root.addEventListener = (name, listener) => {
    addCalls += 1;
    throw new Error(`root listener failed after ${name}:${Boolean(listener)}`);
  };
  assert.equal(mount(f), null, 'partial listener installation fails closed');
  assert.equal(f.list.listenerCount('click'), 0, 'earlier list listener rolled back');
  assert.equal(f.card.getAttribute('data-hafize-schedule-cancel-mounted'), null, 'marker rolled back');
  assert.equal(f.head.children.length, 0, 'style rolled back');
  assert.equal(f.article.querySelector('.schedule-cancel-action'), null, 'no partial action remains');
  assert.equal(addCalls, 1);

  f.root.addEventListener = (name, listener) => {
    if (!f.rootListeners.has(name)) f.rootListeners.set(name, []);
    f.rootListeners.get(name).push(listener);
  };
  const retry = mount(f);
  assert.ok(retry, 'failed listener install releases ownership for retry');
  retry.destroy();
}

{
  const f = fixture({ observerObserveError: true });
  assert.equal(mount(f), null, 'observer installation failure fails closed');
  assert.equal(f.list.listenerCount('click'), 0, 'list listener rolled back after observer failure');
  assert.equal((f.rootListeners.get('hafize:schedule-created') || []).length, 0, 'root listener rolled back after observer failure');
  assert.equal(f.card.getAttribute('data-hafize-schedule-cancel-mounted'), null);
  assert.equal(f.head.children.length, 0);
  assert.equal(f.article.querySelector('.schedule-cancel-action'), null);
}

{
  const f = fixture();
  const hostStyle = new FakeElement('link');
  hostStyle.setAttribute('data-hafize-schedule-cancel-style', '1');
  f.head.append(hostStyle);
  const controller = mount(f);
  assert.ok(controller);
  assert.equal(f.head.children.length, 1, 'existing host stylesheet is reused');
  controller.destroy();
  assert.equal(f.head.children.length, 1, 'host-owned stylesheet survives teardown');
  assert.equal(f.head.children[0], hostStyle);
}

console.log('schedule cancel installation ownership tests passed');
