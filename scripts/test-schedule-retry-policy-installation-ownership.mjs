import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const retryUi = require('../public/schedule-retry-policy.js');

class FakeOption {
  constructor(text, value) {
    this.text = text;
    this.value = String(value);
    this.parentNode = null;
    this.isConnected = false;
  }
  setConnected(value) { this.isConnected = Boolean(value); }
}
globalThis.Option = FakeOption;

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
    this.value = '';
    this.type = '';
    this.isConnected = false;
    this.listeners = new Map();
    this.focusCount = 0;
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
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
  emit(name, event) {
    for (const listener of [...(this.listeners.get(name) || [])]) listener(event);
  }
  listenerCount(name) { return (this.listeners.get(name) || []).length; }
  focus() { this.focusCount += 1; }
  matches(selector) {
    if (selector === '.schedule-list-items') return this.className === 'schedule-list-items';
    if (selector === '.schedule-retry-policy-action') return this.className === 'schedule-retry-policy-action';
    if (selector === '.schedule-retry-policy-toggle') return this.className === 'schedule-retry-policy-toggle';
    if (selector === '.schedule-retry-policy-form') return this.className === 'schedule-retry-policy-form';
    if (selector === '.schedule-retry-policy-close') return this.className === 'schedule-retry-policy-close';
    if (selector === '.schedule-retry-policy-save') return this.className === 'schedule-retry-policy-save';
    if (selector === '.schedule-retry-policy-status') return this.className === 'schedule-retry-policy-status';
    if (selector === '.schedule-retry-policy-select') return this.className === 'schedule-retry-policy-select';
    if (selector === '.schedule-list-item[data-schedule-id]') {
      return this.className === 'schedule-list-item' && typeof this.dataset.scheduleId === 'string';
    }
    return false;
  }
  querySelector(selector) { return this.findAll(selector)[0] || null; }
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

function fixture({ observerObserveError = false, documentListenerError = false, fetchImpl } = {}) {
  const head = new FakeElement('head');
  const body = new FakeElement('body');
  const card = new FakeElement('section');
  const list = new FakeElement('div');
  list.className = 'schedule-list-items';
  const article = new FakeElement('article');
  article.className = 'schedule-list-item';
  article.dataset.scheduleId = 'sched-1';
  article.dataset.state = 'scheduled';
  article.dataset.maxAttempts = '3';
  list.append(article);
  card.append(list);
  body.append(card);
  head.setConnected(true);
  body.setConnected(true);

  const documentListeners = new Map();
  const documentRef = {
    head,
    body,
    createElement: (tagName) => new FakeElement(tagName),
    querySelector(selector) {
      if (selector === '#scheduleListCard') return card;
      if (selector === 'link[data-hafize-schedule-retry-policy-style]' || selector === 'link[data-hafize-schedule-retry-policy-style="1"]') {
        return head.children.find((node) => node.getAttribute('data-hafize-schedule-retry-policy-style') === '1') || null;
      }
      if (selector === '[data-hafize-schedule-retry-policy-mounted]') {
        return card.getAttribute('data-hafize-schedule-retry-policy-mounted') !== null ? card : null;
      }
      return null;
    },
    addEventListener(name, listener) {
      if (documentListenerError) throw new Error(`document listener failed: ${name}`);
      if (!documentListeners.has(name)) documentListeners.set(name, []);
      documentListeners.get(name).push(listener);
    },
    removeEventListener(name, listener) {
      const entries = documentListeners.get(name) || [];
      documentListeners.set(name, entries.filter((candidate) => candidate !== listener));
    }
  };

  let observerInstance = null;
  class FakeObserver {
    constructor(callback) { this.callback = callback; this.disconnected = false; observerInstance = this; }
    observe() { if (observerObserveError) throw new Error('observer installation failed'); }
    disconnect() { this.disconnected = true; }
  }

  const dispatched = [];
  const root = {
    fetch: fetchImpl || (async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) })),
    confirm: () => true,
    AbortController,
    MutationObserver: FakeObserver,
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
    dispatchEvent(event) { dispatched.push(event); return true; },
    setTimeout,
    clearTimeout
  };

  return {
    documentRef, documentListeners, root, dispatched,
    head, body, card, list, article,
    getObserver: () => observerInstance
  };
}

function mount(f, options = {}) {
  return retryUi.mount(f.documentRef, f.root, {
    fetchImpl: f.root.fetch,
    confirmImpl: f.root.confirm,
    ...options
  });
}

{
  const f = fixture();
  const hostArticle = new FakeElement('article');
  hostArticle.className = 'schedule-list-item';
  hostArticle.dataset.scheduleId = 'host-2';
  hostArticle.dataset.state = 'scheduled';
  hostArticle.dataset.maxAttempts = '4';
  const hostAction = new FakeElement('div');
  hostAction.className = 'schedule-retry-policy-action';
  hostArticle.append(hostAction);
  f.list.append(hostArticle);

  const controller = mount(f);
  assert.ok(controller, 'first controller mounts');
  assert.equal(f.card.getAttribute('data-hafize-schedule-retry-policy-mounted'), '1');
  assert.equal(f.list.listenerCount('click'), 1);
  assert.equal(f.list.listenerCount('submit'), 1);
  assert.equal((f.documentListeners.get('keydown') || []).length, 1);
  assert.equal(f.head.children.length, 1, 'controller-owned stylesheet installed');
  assert.equal(f.article.querySelectorAll('.schedule-retry-policy-action').length, 1, 'eligible article decorated');
  assert.equal(hostArticle.querySelector('.schedule-retry-policy-action'), hostAction, 'pre-existing host action is preserved');
  assert.deepEqual(controller.getState(), { busy: 0, mountedActions: 1, requests: 0 });

  f.card.removeAttribute('data-hafize-schedule-retry-policy-mounted');
  assert.equal(mount(f), null, 'weak ownership blocks duplicate mount after external marker removal');
  f.card.setAttribute('data-hafize-schedule-retry-policy-mounted', '1');

  assert.equal(controller.destroy(), true);
  assert.equal(controller.destroy(), false, 'destroy is idempotent');
  assert.equal(f.card.getAttribute('data-hafize-schedule-retry-policy-mounted'), null);
  assert.equal(f.list.listenerCount('click'), 0);
  assert.equal(f.list.listenerCount('submit'), 0);
  assert.equal((f.documentListeners.get('keydown') || []).length, 0);
  assert.equal(f.head.children.length, 0, 'controller-owned stylesheet removed');
  assert.equal(f.article.querySelector('.schedule-retry-policy-action'), null, 'controller action removed');
  assert.equal(hostArticle.querySelector('.schedule-retry-policy-action'), hostAction, 'host action survives teardown');

  const remounted = mount(f);
  assert.ok(remounted, 'destroy releases ownership for clean remount');
  remounted.destroy();
}

{
  const f = fixture({ documentListenerError: true });
  assert.equal(mount(f), null, 'partial listener installation fails closed');
  assert.equal(f.list.listenerCount('click'), 0, 'click listener rolled back');
  assert.equal(f.list.listenerCount('submit'), 0, 'submit listener rolled back');
  assert.equal(f.card.getAttribute('data-hafize-schedule-retry-policy-mounted'), null, 'marker rolled back');
  assert.equal(f.head.children.length, 0, 'style rolled back');
  assert.equal(f.article.querySelector('.schedule-retry-policy-action'), null, 'no action survives failed install');

  f.documentRef.addEventListener = (name, listener) => {
    if (!f.documentListeners.has(name)) f.documentListeners.set(name, []);
    f.documentListeners.get(name).push(listener);
  };
  const retry = mount(f);
  assert.ok(retry, 'failed install releases ownership for retry');
  retry.destroy();
}

{
  const f = fixture({ observerObserveError: true });
  assert.equal(mount(f), null, 'observer installation failure fails closed');
  assert.equal(f.list.listenerCount('click'), 0);
  assert.equal(f.list.listenerCount('submit'), 0);
  assert.equal((f.documentListeners.get('keydown') || []).length, 0);
  assert.equal(f.card.getAttribute('data-hafize-schedule-retry-policy-mounted'), null);
  assert.equal(f.head.children.length, 0);
  assert.equal(f.article.querySelector('.schedule-retry-policy-action'), null);
}

{
  const f = fixture();
  const hostStyle = new FakeElement('link');
  hostStyle.setAttribute('data-hafize-schedule-retry-policy-style', '1');
  f.head.append(hostStyle);
  const controller = mount(f);
  assert.ok(controller);
  assert.equal(f.head.children.length, 1, 'existing host stylesheet is reused');
  controller.destroy();
  assert.equal(f.head.children.length, 1, 'host-owned stylesheet survives teardown');
  assert.equal(f.head.children[0], hostStyle);
}

{
  const f = fixture();
  f.card.setAttribute('data-hafize-schedule-retry-policy-mounted', 'host');
  assert.equal(mount(f), null, 'pre-existing mount marker is treated as foreign ownership');
  assert.equal(f.head.children.length, 0);
  assert.equal(f.list.listenerCount('click'), 0);
}

{
  let resolveFetch;
  let capturedSignal = null;
  const fetchImpl = async (_url, options) => {
    capturedSignal = options.signal;
    return await new Promise((resolve) => { resolveFetch = resolve; });
  };
  const f = fixture({ fetchImpl });
  const controller = mount(f);
  assert.ok(controller);
  const form = f.article.querySelector('.schedule-retry-policy-form');
  const select = f.article.querySelector('.schedule-retry-policy-select');
  select.value = '900000';
  f.list.emit('submit', { target: form, preventDefault() {} });
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(controller.getState(), { busy: 1, mountedActions: 1, requests: 1 });
  assert.equal(capturedSignal?.aborted, false);

  controller.destroy();
  assert.equal(capturedSignal?.aborted, true, 'destroy aborts pending retry-policy request');
  resolveFetch({ ok: true, status: 200, json: async () => ({ ok: true }) });
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(f.dispatched.length, 0, 'late success cannot dispatch after destroy');
  assert.equal(f.article.querySelector('.schedule-retry-policy-action'), null, 'released UI stays removed');

  const remounted = mount(f);
  assert.ok(remounted, 'late completion cannot steal ownership from clean remount');
  remounted.destroy();
}

{
  let resolveFetch;
  const f = fixture({
    fetchImpl: async () => await new Promise((resolve) => { resolveFetch = resolve; })
  });
  const controller = mount(f);
  const form = f.article.querySelector('.schedule-retry-policy-form');
  const select = f.article.querySelector('.schedule-retry-policy-select');
  select.value = '300000';
  f.list.emit('submit', { target: form, preventDefault() {} });
  await Promise.resolve();
  f.article.dataset.scheduleId = 'sched-reused';
  resolveFetch({ ok: true, status: 200, json: async () => ({ ok: true }) });
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(f.dispatched.length, 0, 'changed article identity makes late success stale');
  controller.destroy();
}

console.log('schedule retry policy installation ownership tests passed');
