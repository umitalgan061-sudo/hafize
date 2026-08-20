import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../public/github-branch-create.js');

class FakeElement {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase();
    this.attributes = new Map();
    this.children = [];
    this.parentNode = null;
    this.listeners = new Map();
    this.dataset = {};
    this.className = '';
    this.textContent = '';
    this.hidden = false;
    this.disabled = false;
    this.value = '';
    this.id = '';
    this.isConnected = false;
  }
  setAttribute(name, value) {
    const text = String(value);
    this.attributes.set(name, text);
    if (name.startsWith('data-')) {
      const key = name.slice(5).replace(/-([a-z])/g, (_m, c) => c.toUpperCase());
      this.dataset[key] = text;
    }
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
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }
  removeEventListener(type, listener) {
    const values = this.listeners.get(type) || [];
    this.listeners.set(type, values.filter((candidate) => candidate !== listener));
  }
  listenerCount(type) { return (this.listeners.get(type) || []).length; }
  dispatch(type, event = {}) {
    for (const listener of [...(this.listeners.get(type) || [])]) listener({ target: this, preventDefault() {}, ...event });
  }
  focus() { this.focused = true; }
  matches(selector) {
    if (selector.startsWith('.')) return this.className.split(/\s+/).includes(selector.slice(1));
    if (selector === '[data-github-branch-create]') return this.getAttribute('data-github-branch-create') !== null;
    if (selector.startsWith('#')) return this.id === selector.slice(1);
    return false;
  }
  findAll(selector) {
    const found = [];
    for (const child of this.children) {
      if (child.matches?.(selector)) found.push(child);
      found.push(...(child.findAll?.(selector) || []));
    }
    return found;
  }
  querySelector(selector) { return this.findAll(selector)[0] || null; }
}

function fixture({ documentKeydownThrows = false } = {}) {
  const body = new FakeElement('body');
  const card = new FakeElement('section');
  card.id = 'githubWriteReadinessCard';
  body.append(card);
  body.setConnected(true);
  const documentListeners = new Map();
  const documentRef = {
    body,
    createElement: (tag) => new FakeElement(tag),
    querySelector(selector) {
      if (selector === '#githubWriteReadinessCard') return card;
      return body.querySelector(selector);
    },
    addEventListener(type, listener) {
      if (documentKeydownThrows && type === 'keydown') throw new Error('listener failed');
      if (!documentListeners.has(type)) documentListeners.set(type, []);
      documentListeners.get(type).push(listener);
    },
    removeEventListener(type, listener) {
      const values = documentListeners.get(type) || [];
      documentListeners.set(type, values.filter((candidate) => candidate !== listener));
    }
  };
  class FakeObserver {
    constructor(callback) { this.callback = callback; this.disconnected = false; }
    observe() {}
    disconnect() { this.disconnected = true; }
  }
  const rootRef = {
    AbortController,
    MutationObserver: FakeObserver,
    setTimeout,
    clearTimeout
  };
  return { documentRef, documentListeners, rootRef, body, card };
}

function controls(f) {
  return {
    shell: f.card.querySelector('[data-github-branch-create]'),
    suffix: f.card.querySelector('.github-branch-create-input'),
    inputs: f.card.findAll('.github-branch-create-input'),
    approve: f.card.querySelector('.github-branch-create-approve'),
    status: f.card.querySelector('.github-branch-create-status')
  };
}

const NOW = Date.parse('2026-08-20T07:00:00.000Z');
const TOKEN = `gw1.a.${'b'.repeat(43)}`;
function preparedPayload(command) {
  return { command, approvalToken: TOKEN, expiresAt: new Date(NOW + 60_000).toISOString() };
}

{
  const f = fixture();
  const calls = [];
  const fetchImpl = async (path, options) => {
    const body = JSON.parse(options.body);
    calls.push({ path, body, signal: options.signal });
    if (path === api.PREPARE_PATH) {
      return { ok: true, status: 200, json: async () => preparedPayload(body.command) };
    }
    return { ok: true, status: 200, json: async () => ({ receipt: { ok: true } }) };
  };
  const controller = api.createController({ documentRef: f.documentRef, rootRef: f.rootRef, fetchImpl, now: () => NOW });
  assert.equal(controller.mount(), true);
  const c = controls(f);
  c.inputs[0].value = 'feature-one';
  c.inputs[1].value = 'main';
  assert.equal(await controller.prepare(), true);
  assert.equal(controller.getState().prepared, true);
  assert.equal(c.approve.hidden, false);
  assert.equal(await controller.execute(), true);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].path, api.PREPARE_PATH);
  assert.equal(calls[1].path, api.EXECUTE_PATH);
  assert.equal(c.status.dataset.state, 'success');
  assert.equal(c.inputs[0].value, '');
  assert.equal(controller.destroy(), true);
  assert.equal(controller.destroy(), false);
  assert.equal(f.card.querySelector('[data-github-branch-create]'), null);
  assert.equal((f.documentListeners.get('keydown') || []).length, 0);
}

{
  const f = fixture();
  const first = api.createController({ documentRef: f.documentRef, rootRef: f.rootRef, fetchImpl: async () => ({ ok: false, status: 500, json: async () => ({}) }) });
  assert.equal(first.mount(), true);
  const second = api.createController({ documentRef: f.documentRef, rootRef: f.rootRef, fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({}) }) });
  assert.equal(second.mount(), false, 'duplicate card ownership fails closed');
  assert.equal(second.getState().mounted, false);
  second.destroy();
  assert.ok(f.card.querySelector('[data-github-branch-create]'), 'second controller cannot remove first shell');
  first.destroy();
  const third = api.createController({ documentRef: f.documentRef, rootRef: f.rootRef, fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({}) }) });
  assert.equal(third.mount(), true, 'destroy releases ownership for remount');
  third.destroy();
}

{
  const f = fixture({ documentKeydownThrows: true });
  const controller = api.createController({ documentRef: f.documentRef, rootRef: f.rootRef, fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({}) }) });
  assert.equal(controller.mount(), false, 'partial listener install does not mount');
  assert.equal(f.card.querySelector('[data-github-branch-create]'), null, 'partial shell rolled back');
  assert.equal((f.documentListeners.get('keydown') || []).length, 0);
  controller.destroy();
}

{
  const f = fixture();
  let capturedSignal = null;
  const fetchImpl = async (_path, options) => {
    capturedSignal = options.signal;
    return await new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => {
        const error = new Error('aborted');
        error.name = 'AbortError';
        reject(error);
      }, { once: true });
    });
  };
  const controller = api.createController({ documentRef: f.documentRef, rootRef: f.rootRef, fetchImpl, now: () => NOW });
  controller.mount();
  const c = controls(f);
  c.inputs[0].value = 'pending';
  c.inputs[1].value = 'main';
  const pending = controller.prepare();
  await Promise.resolve();
  assert.equal(controller.getState().busy, true);
  assert.equal(capturedSignal.aborted, false);
  controller.destroy();
  assert.equal(capturedSignal.aborted, true, 'destroy aborts active prepare');
  assert.equal(await pending, false);
  assert.equal(f.card.querySelector('[data-github-branch-create]'), null);
  assert.equal(await controller.prepare(), false, 'destroyed controller stays inert');
  assert.equal(await controller.execute(), false);
  assert.equal(controller.currentCommand(), null);
}

{
  const f = fixture();
  const pending = [];
  const fetchImpl = async (_path, options) => await new Promise((resolve, reject) => {
    const entry = { resolve, reject, signal: options.signal };
    pending.push(entry);
    options.signal.addEventListener('abort', () => {
      const error = new Error('aborted');
      error.name = 'AbortError';
      reject(error);
    }, { once: true });
  });
  const controller = api.createController({ documentRef: f.documentRef, rootRef: f.rootRef, fetchImpl, now: () => NOW });
  controller.mount();
  const c = controls(f);
  c.inputs[0].value = 'first';
  c.inputs[1].value = 'main';
  const first = controller.prepare();
  await Promise.resolve();
  c.inputs[0].value = 'second';
  const second = controller.prepare();
  await Promise.resolve();
  assert.equal(pending.length, 2);
  assert.equal(pending[0].signal.aborted, true, 'new prepare supersedes old request');
  assert.equal(controller.getState().busy, true, 'old finally cannot unlock newer request');
  const command = controller.currentCommand();
  pending[1].resolve({ ok: true, status: 200, json: async () => preparedPayload(command) });
  assert.equal(await first, false);
  assert.equal(await second, true);
  assert.equal(controller.getState().busy, false);
  assert.equal(controller.getState().prepared, true);
  controller.destroy();
}

console.log('github branch create controller lifecycle tests passed');
