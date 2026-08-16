import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { copyFile, unlink } from 'node:fs/promises';

const source = new URL('../public/schedule-runtime-status.js', import.meta.url);
const copy = new URL('../public/schedule-runtime-status.test.cjs', import.meta.url);
await copyFile(source, copy);
const require = createRequire(import.meta.url);
const api = require(copy.pathname);
await unlink(copy);

const ready = { scheduleWorkerConfigured: true, scheduleApiConfigured: true, scheduleStorageDurable: true, scheduleLeaseConfigured: true };
assert.deepEqual(api.normalizeHealth(ready), ready);
assert.equal(api.normalizeHealth({ ...ready, scheduleWorkerConfigured: 'yes' }), null);
assert.equal(api.normalizeHealth(null), null);
assert.deepEqual(api.deriveSummary(ready), { state: 'ready', text: 'Bulut görev motoru hazır.' });
assert.equal(api.deriveSummary({ ...ready, scheduleWorkerConfigured: false }).state, 'off');
assert.match(api.deriveSummary({ ...ready, scheduleStorageDurable: false }).text, /depolama geçici/);
assert.match(api.deriveSummary({ ...ready, scheduleApiConfigured: false }).text, /yönetim API’si kapalı/);
assert.match(api.deriveSummary({ ...ready, scheduleLeaseConfigured: false }).text, /dağıtık lease kapalı/);

class Target {
  constructor(tag = '') { this.tag = tag; this.children = []; this.attrs = {}; this.dataset = {}; this.listeners = new Map(); this.className = ''; this.textContent = ''; this.disabled = false; }
  setAttribute(key, value) { this.attrs[key] = String(value); }
  append(...nodes) { this.children.push(...nodes); }
  addEventListener(type, fn) { this.listeners.set(type, fn); }
  removeEventListener(type) { this.listeners.delete(type); }
  click() { return this.listeners.get('click')?.(); }
  remove() { this.removed = true; }
}
function createDom() {
  const rail = new Target('aside');
  rail.querySelector = () => null;
  rail.insertBefore = (node) => rail.children.push(node);
  const documentRef = { querySelector(selector) { return selector === '.utility-rail' ? rail : null; }, createElement(tag) { return new Target(tag); } };
  return { documentRef, rail };
}
function find(node, predicate) {
  if (predicate(node)) return node;
  for (const child of node.children || []) { const found = find(child, predicate); if (found) return found; }
  return null;
}

{
  const { documentRef, rail } = createDom();
  let requests = 0;
  const controller = api.createController({ documentRef, fetchImpl: async (path, init) => {
    requests += 1;
    assert.equal(path, '/api/health');
    assert.equal(init.method, 'GET');
    assert.equal(init.cache, 'no-store');
    assert.equal(init.credentials, 'same-origin');
    return { ok: true, async json() { return ready; } };
  } });
  assert.equal(controller.mount(), true);
  await Promise.resolve(); await Promise.resolve();
  assert.equal(requests, 1);
  const card = rail.children[0];
  assert.equal(card.id, api.CARD_ID);
  assert.equal(card.attrs['aria-busy'], 'false');
  const status = find(card, (node) => node.id === api.STATUS_ID);
  assert.equal(status.textContent, 'Bulut görev motoru hazır.');
  assert.equal(status.dataset.state, 'ready');
  const refresh = find(card, (node) => node.className.includes('schedule-runtime-refresh'));
  await refresh.click();
  assert.equal(requests, 2);
  assert.equal(controller.destroy(), true);
  assert.equal(card.removed, true);
}

{
  const { documentRef, rail } = createDom();
  const controller = api.createController({ documentRef, fetchImpl: async () => ({ ok: false, async json() { return {}; } }) });
  controller.mount(); await Promise.resolve(); await Promise.resolve();
  const status = find(rail.children[0], (node) => node.id === api.STATUS_ID);
  assert.equal(status.dataset.state, 'error');
  assert.match(status.textContent, /alınamadı/);
  controller.destroy();
}

{
  const { documentRef, rail } = createDom();
  const controller = api.createController({ documentRef, fetchImpl: async () => ({ ok: true, async json() { return { scheduleWorkerConfigured: true }; } }) });
  controller.mount(); await Promise.resolve(); await Promise.resolve();
  const status = find(rail.children[0], (node) => node.id === api.STATUS_ID);
  assert.equal(status.dataset.state, 'error');
  controller.destroy();
}

assert.throws(() => api.createController({ documentRef: null, fetchImpl: async () => ({}) }), /INVALID_SCHEDULE_STATUS_DOCUMENT/);
assert.throws(() => api.createController({ documentRef: { querySelector() {}, createElement() {} }, fetchImpl: null }), /SCHEDULE_STATUS_FETCH_UNAVAILABLE/);
console.log('schedule runtime status tests passed');
