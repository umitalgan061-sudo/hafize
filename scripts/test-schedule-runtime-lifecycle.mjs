import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../public/schedule-runtime-status.js');

const READY = Object.freeze({
  scheduleWorkerConfigured: true,
  scheduleApiConfigured: true,
  scheduleStorageDurable: true,
  scheduleLeaseConfigured: true
});
const OFF = Object.freeze({
  scheduleWorkerConfigured: false,
  scheduleApiConfigured: false,
  scheduleStorageDurable: false,
  scheduleLeaseConfigured: false
});

class Target {
  constructor(tag = '') {
    this.tag = tag;
    this.children = [];
    this.attrs = {};
    this.dataset = {};
    this.listeners = new Map();
    this.className = '';
    this.textContent = '';
    this.disabled = false;
    this.removed = false;
    this.parent = null;
  }
  setAttribute(key, value) { this.attrs[key] = String(value); }
  append(...nodes) {
    for (const node of nodes) { node.parent = this; this.children.push(node); }
  }
  addEventListener(type, fn) { this.listeners.set(type, fn); }
  removeEventListener(type, fn) {
    if (this.listeners.get(type) === fn) this.listeners.delete(type);
  }
  click() { return this.listeners.get('click')?.(); }
  remove() {
    this.removed = true;
    if (this.parent) this.parent.children = this.parent.children.filter((node) => node !== this);
  }
}

function find(node, predicate) {
  if (predicate(node)) return node;
  for (const child of node.children || []) {
    const found = find(child, predicate);
    if (found) return found;
  }
  return null;
}

function createDom({ throwOnRefreshListener = false, existingCard = null } = {}) {
  const rail = new Target('aside');
  rail.querySelector = () => null;
  rail.insertBefore = (node) => rail.append(node);
  const documentRef = {
    querySelector(selector) {
      if (selector === '.utility-rail') return rail;
      if (selector === `#${api.CARD_ID}`) return existingCard;
      return null;
    },
    createElement(tag) {
      const node = new Target(tag);
      if (throwOnRefreshListener && tag === 'button') {
        node.addEventListener = () => { throw new Error('listener install failed'); };
      }
      return node;
    }
  };
  return { documentRef, rail };
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

function healthResponse(health) {
  return { ok: true, async json() { return health; } };
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

{
  const { documentRef, rail } = createDom();
  const first = deferred();
  const second = deferred();
  let calls = 0;
  const controller = api.createController({
    documentRef,
    fetchImpl: async () => (++calls === 1 ? first.promise : second.promise)
  });
  assert.equal(controller.mount(), true);
  const card = rail.children[0];
  const status = find(card, (node) => node.id === api.STATUS_ID);
  const refresh = find(card, (node) => node.className.includes('schedule-runtime-refresh'));
  assert.ok(status && refresh);

  const secondLoad = refresh.click();
  assert.equal(calls, 2, 'manual refresh starts a newer request');
  second.resolve(healthResponse(READY));
  assert.deepEqual(await secondLoad, READY);
  assert.equal(status.dataset.state, 'ready');
  assert.equal(status.textContent, 'Bulut görev motoru hazır.');
  assert.equal(refresh.disabled, false);

  first.resolve(healthResponse(OFF));
  await flush();
  assert.equal(status.dataset.state, 'ready', 'older request cannot overwrite newer health');
  assert.equal(status.textContent, 'Bulut görev motoru hazır.', 'older response cannot replace summary');
  assert.equal(refresh.disabled, false, 'older finally cannot change newer refresh ownership');
  controller.destroy();
}

{
  const { documentRef, rail } = createDom();
  const first = deferred();
  const remount = deferred();
  let calls = 0;
  const controller = api.createController({
    documentRef,
    fetchImpl: async () => (++calls === 1 ? first.promise : remount.promise)
  });
  assert.equal(controller.mount(), true);
  const oldCard = rail.children[0];
  assert.equal(controller.destroy(), true);
  assert.equal(oldCard.removed, true, 'destroy removes controller-owned card');

  assert.equal(controller.mount(), true, 'same controller can mount a clean new generation');
  const newCard = rail.children[0];
  const newStatus = find(newCard, (node) => node.id === api.STATUS_ID);
  remount.resolve(healthResponse(READY));
  await flush();
  assert.equal(newStatus.dataset.state, 'ready');

  first.resolve(healthResponse(OFF));
  await flush();
  assert.equal(newStatus.dataset.state, 'ready', 'pre-destroy response is inert after remount');
  assert.equal(newStatus.textContent, 'Bulut görev motoru hazır.');
  controller.destroy();
}

{
  const { documentRef, rail } = createDom({ throwOnRefreshListener: true });
  let requests = 0;
  const controller = api.createController({
    documentRef,
    fetchImpl: async () => { requests += 1; return healthResponse(READY); }
  });
  assert.equal(controller.mount(), false, 'listener setup failure fails closed');
  assert.equal(requests, 0, 'failed installation does not start a health request');
  assert.equal(rail.children.length, 0, 'partial installation rolls back controller-owned card');
  assert.equal(controller.destroy(), false, 'failed installation is not treated as mounted');
}

{
  const hostCard = new Target('section');
  hostCard.id = api.CARD_ID;
  const { documentRef, rail } = createDom({ existingCard: hostCard });
  const controller = api.createController({ documentRef, fetchImpl: async () => healthResponse(READY) });
  assert.equal(controller.mount(), false, 'an existing host/runtime card is not taken over implicitly');
  assert.equal(hostCard.removed, false, 'failed mount never removes a host-owned card');
  assert.equal(rail.children.length, 0, 'duplicate surface does not append another card');
}

{
  const { documentRef, rail } = createDom();
  const pending = deferred();
  const controller = api.createController({ documentRef, fetchImpl: async () => pending.promise });
  assert.equal(controller.mount(), true);
  const card = rail.children[0];
  controller.destroy();
  pending.resolve(healthResponse(READY));
  await flush();
  assert.equal(card.removed, true);
  assert.equal(rail.children.length, 0, 'late completion cannot resurrect destroyed DOM');
  assert.equal(await controller.load(), null, 'manual load is inert while unmounted');
}

console.log('schedule runtime lifecycle tests passed');
