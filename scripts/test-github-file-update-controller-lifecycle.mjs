import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../public/github-file-update.js');

class FakeElement {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.attributes = new Map();
    this.listeners = new Map();
    this.dataset = {};
    this.className = '';
    this.textContent = '';
    this.value = '';
    this.hidden = false;
    this.disabled = false;
    this.id = '';
  }
  append(...nodes) {
    for (const node of nodes) {
      node.parentNode = this;
      this.children.push(node);
    }
  }
  remove() {
    if (!this.parentNode) return;
    this.parentNode.children = this.parentNode.children.filter((node) => node !== this);
    this.parentNode = null;
  }
  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    if (name.startsWith('data-')) {
      const key = name.slice(5).replace(/-([a-z])/g, (_m, c) => c.toUpperCase());
      this.dataset[key] = String(value);
    }
  }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  removeAttribute(name) { this.attributes.delete(name); }
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }
  removeEventListener(type, listener) {
    const entries = this.listeners.get(type) || [];
    this.listeners.set(type, entries.filter((entry) => entry !== listener));
  }
  focus() { this.focused = true; }
  matches(selector) {
    if (selector.startsWith('.')) return this.className.split(/\s+/).includes(selector.slice(1));
    if (selector === '[data-github-file-update]') return this.getAttribute('data-github-file-update') !== null;
    if (selector.startsWith('#')) return this.id === selector.slice(1);
    return false;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  querySelectorAll(selector) {
    const found = [];
    for (const child of this.children) {
      if (child.matches(selector)) found.push(child);
      found.push(...child.querySelectorAll(selector));
    }
    return found;
  }
}

function fixture({ fetchImpl, throwOnListenerClass = null } = {}) {
  const body = new FakeElement('body');
  const card = new FakeElement('section');
  card.id = 'githubWriteReadinessCard';
  body.append(card);
  const documentListeners = new Map();
  const documentRef = {
    body,
    createElement: (tag) => {
      const node = new FakeElement(tag);
      if (throwOnListenerClass) {
        const original = node.addEventListener.bind(node);
        node.addEventListener = function addEventListener(type, listener) {
          if (this.className.split(/\s+/).includes(throwOnListenerClass)) throw new Error('listener install failed');
          return original(type, listener);
        };
      }
      return node;
    },
    querySelector(selector) {
      if (selector === '#githubWriteReadinessCard') return card;
      return body.querySelector(selector);
    },
    addEventListener(type, listener) {
      if (!documentListeners.has(type)) documentListeners.set(type, []);
      documentListeners.get(type).push(listener);
    },
    removeEventListener(type, listener) {
      const entries = documentListeners.get(type) || [];
      documentListeners.set(type, entries.filter((entry) => entry !== listener));
    }
  };
  const events = [];
  class FakeCustomEvent {
    constructor(type, options) { this.type = type; this.detail = options?.detail; }
  }
  const rootRef = {
    AbortController,
    CustomEvent: FakeCustomEvent,
    dispatchEvent(event) { events.push(event); },
    setTimeout,
    clearTimeout,
    MutationObserver: class {
      observe() {}
      disconnect() { this.disconnected = true; }
    }
  };
  return {
    body, card, documentRef, documentListeners, rootRef, events,
    fetchImpl: fetchImpl || (async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) }))
  };
}

function controls(f) {
  const shell = f.card.querySelector('[data-github-file-update]');
  const form = shell.querySelector('.github-file-update-form');
  return {
    shell,
    form,
    toggle: shell.querySelector('.github-file-update-toggle'),
    branch: form.querySelectorAll('.github-file-update-input')[0],
    path: form.querySelectorAll('.github-file-update-input')[1],
    sha: form.querySelector('.github-file-update-sha'),
    message: form.querySelectorAll('.github-file-update-input')[3],
    content: form.querySelector('.github-file-update-content'),
    prepare: form.querySelector('.github-file-update-primary'),
    approve: form.querySelector('.github-file-update-approve'),
    close: form.querySelector('.github-file-update-close'),
    status: form.querySelector('.github-file-update-status'),
    summary: form.querySelector('.github-file-update-summary')
  };
}

function fill(c, content = 'export const ok = true;\n') {
  c.branch.value = 'hafize/file-lifecycle';
  c.path.value = 'public/example.js';
  c.sha.value = 'a'.repeat(40);
  c.message.value = 'update example';
  c.content.value = content;
}

function firstListener(node, type) {
  const listener = node.listeners.get(type)?.[0];
  assert.equal(typeof listener, 'function', `${type} listener exists`);
  return listener;
}

{
  const now = 1_800_000_000_000;
  const token = `gw1.${'a'.repeat(8)}.${'b'.repeat(43)}`;
  const calls = [];
  const f = fixture({
    fetchImpl: async (path, options) => {
      const body = JSON.parse(options.body);
      calls.push({ path, body, signal: options.signal });
      if (path === api.PREPARE_PATH) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ command: body.command, approvalToken: token, expiresAt: new Date(now + 60_000).toISOString() })
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ receipt: {
          operation: 'file.update', repository: api.REPOSITORY,
          branch: body.command.branch, path: body.command.path,
          commitSha: 'c'.repeat(40), blobSha: 'd'.repeat(40)
        } })
      };
    }
  });
  const controller = api.createController({ documentRef: f.documentRef, rootRef: f.rootRef, fetchImpl: f.fetchImpl, now: () => now });
  assert.equal(controller.mount(), true);
  const c = controls(f);
  fill(c);

  await firstListener(c.form, 'submit')({ preventDefault() {} });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].path, api.PREPARE_PATH);
  assert.equal(c.approve.hidden, false, 'explicit second-step approval becomes available');
  assert.ok(controller.getPrepared());
  assert.match(c.summary.textContent, /hafize\/file-lifecycle:public\/example\.js/);

  await firstListener(c.approve, 'click')();
  assert.equal(calls.length, 2);
  assert.equal(calls[1].path, api.EXECUTE_PATH);
  assert.equal(calls[1].body.command.operation, 'file.update');
  assert.equal(calls[1].body.approvalToken, token);
  assert.equal(c.sha.value, 'd'.repeat(40));
  assert.equal(f.events.length, 1);
  assert.equal(f.events[0].type, 'hafize:github-file-updated');
  assert.deepEqual(f.events[0].detail, { path: 'public/example.js', branch: 'hafize/file-lifecycle' });
  assert.equal(controller.destroy(), true);
  assert.equal(controller.destroy(), false, 'destroy is idempotent');
  assert.equal(f.card.querySelector('[data-github-file-update]'), null);
}

{
  const f = fixture();
  const first = api.createController({ documentRef: f.documentRef, rootRef: f.rootRef, fetchImpl: f.fetchImpl });
  const second = api.createController({ documentRef: f.documentRef, rootRef: f.rootRef, fetchImpl: f.fetchImpl });
  assert.equal(first.mount(), true);
  const ownedShell = f.card.querySelector('[data-github-file-update]');
  ownedShell.remove();
  assert.equal(second.mount(), false, 'weak ownership blocks duplicate mount even if shell is externally removed');
  first.destroy();
  assert.equal(second.mount(), true, 'destroy releases card ownership for clean remount');
  second.destroy();
}

{
  const f = fixture({ throwOnListenerClass: 'github-file-update-approve' });
  const controller = api.createController({ documentRef: f.documentRef, rootRef: f.rootRef, fetchImpl: f.fetchImpl });
  assert.equal(controller.mount(), false, 'partial listener install fails closed');
  assert.equal(f.card.querySelector('[data-github-file-update]'), null, 'partial shell rolled back');

  const retryFixture = fixture();
  const retry = api.createController({ documentRef: retryFixture.documentRef, rootRef: retryFixture.rootRef, fetchImpl: retryFixture.fetchImpl });
  assert.equal(retry.mount(), true);
  retry.destroy();
}

{
  const now = 1_800_000_000_000;
  const token = `gw1.${'q'.repeat(8)}.${'z'.repeat(43)}`;
  const f = fixture({
    fetchImpl: async (_path, options) => {
      const body = JSON.parse(options.body);
      return { ok: true, status: 200, json: async () => ({ command: body.command, approvalToken: token, expiresAt: new Date(now + 60_000).toISOString() }) };
    }
  });
  const controller = api.createController({ documentRef: f.documentRef, rootRef: f.rootRef, fetchImpl: f.fetchImpl, now: () => now });
  controller.mount();
  const c = controls(f);
  fill(c);
  await firstListener(c.form, 'submit')({ preventDefault() {} });
  assert.ok(controller.getPrepared());
  c.content.value = 'changed after approval';
  firstListener(c.content, 'input')();
  assert.equal(controller.getPrepared(), null, 'editing exact command invalidates prepared approval immediately');
  assert.equal(c.approve.hidden, true);
  assert.match(c.status.textContent, /önce yeni onay/i);
  controller.destroy();
}

{
  const requests = [];
  const f = fixture({
    fetchImpl: async (path, options) => await new Promise((resolve, reject) => {
      const request = { path, options, resolve, reject };
      requests.push(request);
      options.signal.addEventListener('abort', () => {
        const error = new Error('aborted');
        error.name = 'AbortError';
        reject(error);
      }, { once: true });
    })
  });
  const controller = api.createController({ documentRef: f.documentRef, rootRef: f.rootRef, fetchImpl: f.fetchImpl });
  controller.mount();
  const c = controls(f);
  fill(c, 'first');
  const submit = firstListener(c.form, 'submit');
  const firstPending = submit({ preventDefault() {} });
  await Promise.resolve();
  assert.equal(f.card.getAttribute('aria-busy'), 'true');

  c.content.value = 'second';
  const secondPending = submit({ preventDefault() {} });
  await Promise.resolve();
  await firstPending;
  assert.equal(requests[0].options.signal.aborted, true, 'new prepare aborts superseded request');
  assert.equal(f.card.getAttribute('aria-busy'), 'true', 'old finally cannot unlock newer request');

  controller.destroy();
  await secondPending;
  assert.equal(requests[1].options.signal.aborted, true, 'destroy aborts current request');
  assert.equal(controller.getState().destroyed, true);
  assert.equal(controller.buildCommand(), null, 'destroyed controller stays inert');
}

console.log('github file update controller lifecycle tests passed');
