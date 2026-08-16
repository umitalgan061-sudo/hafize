import assert from 'node:assert/strict';
import { copyFile, unlink } from 'node:fs/promises';
import { createRequire } from 'node:module';

const source = new URL('../public/canva-connection-status.js', import.meta.url);
const copy = new URL('../public/canva-connection-status.test.cjs', import.meta.url);
await copyFile(source, copy);
const require = createRequire(import.meta.url);
const api = require(copy.pathname);
await unlink(copy);

assert.deepEqual(api.normalizeHealth({ canvaReadConfigured: true }), { canvaReadConfigured: true });
assert.deepEqual(api.normalizeHealth({ canvaReadConfigured: false, extra: 'ignored' }), { canvaReadConfigured: false });
assert.equal(api.normalizeHealth({ canvaReadConfigured: 'yes' }), null);
assert.equal(api.normalizeHealth([]), null);
assert.equal(api.normalizeHealth(null), null);
assert.deepEqual(api.normalizeStatus({ linked: true }), { linked: true });
assert.deepEqual(api.normalizeStatus({ linked: false, token: 'ignored' }), { linked: false });
assert.equal(api.normalizeStatus({ linked: 1 }), null);
assert.equal(api.normalizeStatus(null), null);

assert.equal(api.deriveView({ configured: false, authenticated: false, linked: false }).state, 'off');
assert.equal(api.deriveView({ configured: true, authenticated: false, linked: false }).state, 'auth');
assert.equal(api.deriveView({ configured: true, authenticated: true, linked: false }).badge, 'Bağlı değil');
assert.equal(api.deriveView({ configured: true, authenticated: true, linked: true }).state, 'linked');
assert.equal(api.deriveView({ configured: true, authenticated: true, linked: true, unavailable: true }).state, 'error');

class Target {
  constructor(tag = '') {
    this.tag = tag; this.children = []; this.attrs = {}; this.dataset = {}; this.listeners = new Map();
    this.className = ''; this.textContent = ''; this.disabled = false; this.parentNode = null;
  }
  setAttribute(key, value) { this.attrs[key] = String(value); }
  append(...nodes) { for (const node of nodes) { node.parentNode = this; this.children.push(node); } }
  addEventListener(type, fn) { this.listeners.set(type, fn); }
  removeEventListener(type) { this.listeners.delete(type); }
  click() { return this.listeners.get('click')?.(); }
  remove() { this.removed = true; }
}

function find(node, predicate) {
  if (predicate(node)) return node;
  for (const child of node.children || []) { const found = find(child, predicate); if (found) return found; }
  return null;
}

function createDom() {
  const rail = new Target('aside');
  rail.querySelector = () => null;
  rail.insertBefore = (node) => rail.append(node);
  return {
    rail,
    documentRef: {
      querySelector(selector) { return selector === '.utility-rail' ? rail : null; },
      createElement(tag) { return new Target(tag); }
    }
  };
}

function response(status, payload) {
  return { ok: status >= 200 && status < 300, status, async json() { return payload; } };
}

{
  const { documentRef, rail } = createDom();
  const requests = [];
  const controller = api.createController({
    documentRef,
    AbortControllerImpl: null,
    fetchImpl: async (path, init) => {
      requests.push({ path, init });
      if (path === api.HEALTH_PATH) return response(200, { canvaReadConfigured: true });
      if (path === api.STATUS_PATH) return response(200, { linked: true });
      throw new Error('unexpected path');
    }
  });
  assert.equal(controller.mount(), true);
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  assert.deepEqual(requests.map(({ path }) => path), [api.HEALTH_PATH, api.STATUS_PATH]);
  for (const { init } of requests) {
    assert.equal(init.method, 'GET');
    assert.equal(init.cache, 'no-store');
    assert.equal(init.credentials, 'same-origin');
  }
  const card = rail.children[0];
  assert.equal(card.id, api.CARD_ID);
  assert.equal(card.attrs['aria-busy'], 'false');
  const summary = find(card, (node) => node.id === api.SUMMARY_ID);
  assert.equal(summary.dataset.state, 'linked');
  const badge = find(card, (node) => node.className.includes('canva-connection-badge'));
  assert.equal(badge.textContent, 'Bağlı');
  const refresh = find(card, (node) => node.className.includes('canva-connection-refresh'));
  await refresh.click();
  assert.equal(requests.length, 4);
  assert.equal(controller.destroy(), true);
  assert.equal(card.removed, true);
}

{
  const { documentRef, rail } = createDom();
  const requests = [];
  const controller = api.createController({
    documentRef,
    AbortControllerImpl: null,
    fetchImpl: async (path) => { requests.push(path); return response(200, { canvaReadConfigured: false }); }
  });
  controller.mount();
  await Promise.resolve(); await Promise.resolve();
  assert.deepEqual(requests, [api.HEALTH_PATH]);
  const summary = find(rail.children[0], (node) => node.id === api.SUMMARY_ID);
  assert.equal(summary.dataset.state, 'off');
  controller.destroy();
}

{
  const { documentRef, rail } = createDom();
  const controller = api.createController({
    documentRef,
    AbortControllerImpl: null,
    fetchImpl: async (path) => path === api.HEALTH_PATH
      ? response(200, { canvaReadConfigured: true })
      : response(401, { error: 'AUTH_REQUIRED' })
  });
  controller.mount();
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  const summary = find(rail.children[0], (node) => node.id === api.SUMMARY_ID);
  assert.equal(summary.dataset.state, 'auth');
  assert.match(summary.textContent, /güvenli Hafize oturumu/);
  controller.destroy();
}

{
  const { documentRef, rail } = createDom();
  const controller = api.createController({ documentRef, AbortControllerImpl: null, fetchImpl: async () => response(503, {}) });
  controller.mount();
  await Promise.resolve(); await Promise.resolve();
  const summary = find(rail.children[0], (node) => node.id === api.SUMMARY_ID);
  assert.equal(summary.dataset.state, 'error');
  controller.destroy();
}

assert.throws(() => api.createController({ documentRef: null, fetchImpl: async () => ({}) }), /INVALID_CANVA_STATUS_DOCUMENT/);
assert.throws(() => api.createController({ documentRef: { querySelector() {}, createElement() {} }, fetchImpl: null }), /CANVA_STATUS_FETCH_UNAVAILABLE/);
console.log('Canva connection status UI tests passed');
