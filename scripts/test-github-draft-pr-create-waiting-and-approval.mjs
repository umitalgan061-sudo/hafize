import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const api = require('../public/github-draft-pr-create.js');

class FakeElement {
  constructor(tag = 'div') { this.tagName = tag.toUpperCase(); this.attributes = new Map(); this.children = []; this.parentNode = null; this.listeners = new Map(); this.dataset = {}; this.className = ''; this.textContent = ''; this.hidden = false; this.disabled = false; this.value = ''; this.id = ''; this.isConnected = false; }
  setAttribute(name, value) { const text = String(value); this.attributes.set(name, text); if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g, (_m, c) => c.toUpperCase())] = text; }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  append(...nodes) { for (const node of nodes) { node.parentNode = this; node.setConnected?.(this.isConnected); this.children.push(node); } }
  setConnected(value) { this.isConnected = Boolean(value); for (const child of this.children) child.setConnected?.(value); }
  remove() { if (!this.parentNode) return; this.parentNode.children = this.parentNode.children.filter((node) => node !== this); this.parentNode = null; this.setConnected(false); }
  addEventListener(type, listener) { if (!this.listeners.has(type)) this.listeners.set(type, []); this.listeners.get(type).push(listener); }
  removeEventListener(type, listener) { const values = this.listeners.get(type) || []; this.listeners.set(type, values.filter((candidate) => candidate !== listener)); }
  dispatch(type, event = {}) { for (const listener of [...(this.listeners.get(type) || [])]) listener({ target: this, preventDefault() {}, ...event }); }
  focus() {}
  matches(selector) { if (selector.startsWith('.')) return this.className.split(/\s+/).includes(selector.slice(1)); if (selector === '[data-github-draft-pr-create]') return this.getAttribute('data-github-draft-pr-create') !== null; if (selector.startsWith('#')) return this.id === selector.slice(1); return false; }
  findAll(selector) { const found = []; for (const child of this.children) { if (child.matches?.(selector)) found.push(child); found.push(...(child.findAll?.(selector) || [])); } return found; }
  querySelector(selector) { return this.findAll(selector)[0] || null; }
}

function createDocument({ withCard = false } = {}) {
  const body = new FakeElement('body');
  let card = null;
  if (withCard) { card = new FakeElement('section'); card.id = 'githubWriteReadinessCard'; body.append(card); }
  body.setConnected(true);
  const listeners = new Map();
  return { body, card, listeners, createElement: (tag) => new FakeElement(tag), querySelector(selector) { if (selector === '#githubWriteReadinessCard') return card; return body.querySelector(selector); }, addEventListener(type, listener) { if (!listeners.has(type)) listeners.set(type, []); listeners.get(type).push(listener); }, removeEventListener(type, listener) { const values = listeners.get(type) || []; listeners.set(type, values.filter((candidate) => candidate !== listener)); } };
}

{
  const doc = createDocument();
  let observed = null, disconnected = false, timerCallback = null, timerDelay = null, cleared = null;
  class FakeObserver { constructor(callback) { this.callback = callback; } observe(target) { observed = target; } disconnect() { disconnected = true; } }
  const rootRef = { AbortController, MutationObserver: FakeObserver, setTimeout(callback, delay) { timerCallback = callback; timerDelay = delay; return 77; }, clearTimeout(id) { cleared = id; } };
  const controller = api.createController({ documentRef: doc, rootRef, fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({}) }) });
  assert.equal(controller.mount(), false);
  assert.equal(observed, doc.body);
  assert.equal(timerDelay, api.MOUNT_TIMEOUT_MS);
  assert.equal(typeof timerCallback, 'function');
  assert.equal(controller.destroy(), true);
  assert.equal(disconnected, true);
  assert.equal(cleared, 77);
  assert.equal(controller.destroy(), false);
}

{
  const doc = createDocument();
  let disconnected = false, timerScheduled = false;
  class ThrowingObserver { observe() { throw new Error('observe failed'); } disconnect() { disconnected = true; } }
  const rootRef = { AbortController, MutationObserver: ThrowingObserver, setTimeout() { timerScheduled = true; return 1; }, clearTimeout() {} };
  const controller = api.createController({ documentRef: doc, rootRef, fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({}) }) });
  assert.equal(controller.mount(), false);
  assert.equal(disconnected, true);
  assert.equal(timerScheduled, false);
  controller.destroy();
}

{
  const doc = createDocument({ withCard: true });
  const rootRef = { AbortController, setTimeout, clearTimeout };
  const now = Date.parse('2026-08-20T08:30:00.000Z');
  const token = `gw1.a.${'b'.repeat(43)}`;
  let calls = 0;
  const fetchImpl = async (path, options) => {
    calls += 1;
    assert.equal(path, api.PREPARE_PATH, 'input invalidation prevents execute call');
    const command = JSON.parse(options.body).command;
    return { ok: true, status: 200, json: async () => ({ command, approvalToken: token, expiresAt: new Date(now + 60_000).toISOString() }) };
  };
  const controller = api.createController({ documentRef: doc, rootRef, fetchImpl, now: () => now });
  assert.equal(controller.mount(), true);
  const inputs = doc.card.findAll('.github-draft-pr-input');
  inputs[0].value = 'approval-boundary'; inputs[1].value = 'main'; inputs[2].value = 'feat: approval boundary';
  assert.equal(await controller.prepare(), true);
  assert.equal(controller.getState().prepared, true);
  inputs[2].value = 'feat: changed after approval';
  inputs[2].dispatch('input');
  assert.equal(controller.getState().prepared, false);
  assert.equal(await controller.execute(), false);
  assert.equal(calls, 1);
  controller.destroy();
}

console.log('github draft PR create waiting and approval tests passed');
