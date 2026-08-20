import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../public/github-pr-merge.js');

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
    if (selector === '[data-github-pr-merge]') return this.getAttribute('data-github-pr-merge') !== null;
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

function fixture({ fetchImpl, throwOnListenerClass = null, hostBusy } = {}) {
  const body = new FakeElement('body');
  const card = new FakeElement('section');
  card.id = 'githubWriteReadinessCard';
  if (hostBusy !== undefined) card.setAttribute('aria-busy', hostBusy);
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
      constructor(callback) { this.callback = callback; }
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
  const shell = f.card.querySelector('[data-github-pr-merge]');
  const form = shell.querySelector('.github-pr-merge-form');
  const inputs = form.querySelectorAll('.github-pr-merge-input');
  return {
    shell,
    form,
    toggle: shell.querySelector('.github-pr-merge-toggle'),
    pr: inputs[0],
    sha: form.querySelector('.github-pr-merge-sha'),
    prepare: form.querySelector('.github-pr-merge-primary'),
    approve: form.querySelector('.github-pr-merge-danger'),
    close: form.querySelector('.github-pr-merge-cancel'),
    status: form.querySelector('.github-pr-merge-status'),
    summary: form.querySelector('.github-pr-merge-summary')
  };
}

function fill(c, prNumber = '398', sha = 'a'.repeat(40)) {
  c.pr.value = prNumber;
  c.sha.value = sha;
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
    hostBusy: 'false',
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
          operation: 'pr.merge', repository: api.REPOSITORY,
          prNumber: body.command.prNumber, merged: true, sha: 'c'.repeat(40)
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
  assert.match(c.summary.textContent, /PR #398/);
  assert.equal(f.card.getAttribute('aria-busy'), 'false', 'host busy state restored after prepare');

  await firstListener(c.approve, 'click')();
  assert.equal(calls.length, 2);
  assert.equal(calls[1].path, api.EXECUTE_PATH);
  assert.equal(calls[1].body.command.operation, 'pr.merge');
  assert.equal(calls[1].body.approvalToken, token);
  assert.equal(f.events.length, 1);
  assert.equal(f.events[0].type, 'hafize:github-pr-merged');
  assert.deepEqual(f.events[0].detail, { operation: 'pr.merge', repository: api.REPOSITORY, prNumber: 398 });
  assert.equal(f.card.getAttribute('aria-busy'), 'false');
  assert.equal(controller.destroy(), true);
  assert.equal(controller.destroy(), false, 'destroy is idempotent');
  assert.equal(f.card.querySelector('[data-github-pr-merge]'), null);
  assert.equal(f.card.getAttribute('aria-busy'), 'false', 'host busy state survives teardown exactly');
}

{
  const f = fixture();
  const first = api.createController({ documentRef: f.documentRef, rootRef: f.rootRef, fetchImpl: f.fetchImpl });
  const second = api.createController({ documentRef: f.documentRef, rootRef: f.rootRef, fetchImpl: f.fetchImpl });
  assert.equal(first.mount(), true);
  const ownedShell = f.card.querySelector('[data-github-pr-merge]');
  ownedShell.remove();
  assert.equal(second.mount(), false, 'weak ownership blocks duplicate mount even if shell is externally removed');
  first.destroy();
  assert.equal(second.mount(), true, 'destroy releases card ownership for clean remount');
  second.destroy();
}

{
  const f = fixture({ throwOnListenerClass: 'github-pr-merge-danger' });
  const controller = api.createController({ documentRef: f.documentRef, rootRef: f.rootRef, fetchImpl: f.fetchImpl });
  assert.equal(controller.mount(), false, 'partial listener install fails closed');
  assert.equal(f.card.querySelector('[data-github-pr-merge]'), null, 'partial shell rolled back');
  assert.equal((f.documentListeners.get('keydown') || []).length, 0, 'no document listener leaks');

  const retry = api.createController({ documentRef: f.documentRef, rootRef: f.rootRef, fetchImpl: f.fetchImpl });
  assert.equal(retry.mount(), false, 'same broken listener environment still fails closed without leaked ownership');
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
  c.sha.value = 'b'.repeat(40);
  firstListener(c.sha, 'input')();
  assert.equal(controller.getPrepared(), null, 'editing exact command invalidates prepared approval immediately');
  assert.equal(c.approve.hidden, true);
  assert.match(c.status.textContent, /yeniden hazırlanmalı/i);
  assert.equal(await controller.execute(), false, 'execute refuses missing approval after edit');
  controller.destroy();
}

{
  const requests = [];
  const f = fixture({
    hostBusy: 'false',
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
  fill(c, '398', 'a'.repeat(40));
  const submit = firstListener(c.form, 'submit');
  const firstPending = submit({ preventDefault() {} });
  await Promise.resolve();
  assert.equal(f.card.getAttribute('aria-busy'), 'true');

  c.sha.value = 'b'.repeat(40);
  const secondPending = submit({ preventDefault() {} });
  await Promise.resolve();
  await firstPending;
  assert.equal(requests[0].options.signal.aborted, true, 'new prepare aborts superseded request');
  assert.equal(f.card.getAttribute('aria-busy'), 'true', 'old finally cannot unlock newer request');

  controller.destroy();
  await secondPending;
  assert.equal(requests[1].options.signal.aborted, true, 'destroy aborts current request');
  assert.equal(controller.getState().destroyed, true);
  assert.equal(controller.currentCommand(), null, 'destroyed controller stays inert');
  assert.equal(f.card.getAttribute('aria-busy'), 'false', 'destroy restores host busy snapshot');
}

{
  const f = fixture();
  const controller = api.createController({ documentRef: f.documentRef, rootRef: f.rootRef, fetchImpl: f.fetchImpl });
  controller.mount();
  assert.equal(f.card.getAttribute('aria-busy'), null);
  controller.destroy();
  assert.equal(f.card.getAttribute('aria-busy'), null, 'absent host aria-busy remains absent');
}

console.log('github PR merge controller lifecycle tests passed');
