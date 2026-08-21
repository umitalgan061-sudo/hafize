import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../public/canva-connection-status.js', import.meta.url), 'utf8');
const module = { exports: {} };
vm.runInNewContext(source, { module, exports: module.exports, globalThis: {}, self: {} });
const api = module.exports;

class Node {
  constructor() {
    this.id = '';
    this.className = '';
    this.textContent = '';
    this.dataset = {};
    this.disabled = false;
    this.children = [];
    this.attributes = new Map();
    this.listeners = new Map();
    this.removed = false;
  }
  append(...nodes) { this.children.push(...nodes); }
  appendChild(node) { this.append(node); return node; }
  insertBefore(node) { this.children.push(node); return node; }
  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    if (name === 'data-state') this.dataset.state = String(value);
  }
  getAttribute(name) {
    if (name === 'data-state' && Object.hasOwn(this.dataset, 'state')) return this.dataset.state;
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }
  hasAttribute(name) {
    if (name === 'data-state') return Object.hasOwn(this.dataset, 'state');
    return this.attributes.has(name);
  }
  removeAttribute(name) {
    this.attributes.delete(name);
    if (name === 'data-state') delete this.dataset.state;
  }
  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(handler);
  }
  removeEventListener(type, handler) { this.listeners.get(type)?.delete(handler); }
  querySelector(selector) {
    if (selector === `#${api.SUMMARY_ID}`) return this.children.find((node) => node.id === api.SUMMARY_ID) || null;
    if (selector === '.canva-connection-badge') return this.children.find((node) => node.className.includes('canva-connection-badge')) || null;
    if (selector === '.canva-connection-refresh') return this.children.find((node) => node.className.includes('canva-connection-refresh')) || null;
    return null;
  }
  remove() { this.removed = true; }
}

function response(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, async json() { return body; } };
}

function makeHost({ malformed = false } = {}) {
  const rail = new Node();
  const card = new Node();
  card.id = api.CARD_ID;
  card.setAttribute('aria-busy', 'host-busy');
  const summary = new Node();
  summary.id = api.SUMMARY_ID;
  summary.textContent = 'host summary';
  summary.dataset.state = 'host-summary';
  const badge = new Node();
  badge.className = 'canva-connection-badge';
  badge.textContent = 'host badge';
  badge.dataset.state = 'host-badge';
  const refresh = new Node();
  refresh.className = 'canva-connection-refresh';
  refresh.disabled = true;
  card.append(summary, badge, ...(malformed ? [] : [refresh]));
  const documentRef = {
    querySelector(selector) {
      if (selector === '.utility-rail') return rail;
      if (selector === `#${api.CARD_ID}`) return card;
      return null;
    },
    createElement() { return new Node(); }
  };
  return { rail, card, summary, badge, refresh, documentRef };
}

{
  const h = makeHost();
  const fetchImpl = async (path) => path === api.HEALTH_PATH
    ? response({ canvaReadConfigured: false })
    : response({ linked: false });
  const controller = api.createController({ documentRef: h.documentRef, fetchImpl });
  assert.equal(controller.mount(), true);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(h.card.removed, false);
  assert.equal(h.summary.textContent, 'Canva read-only connector sunucuda yapılandırılmamış.');
  assert.equal(h.refresh.listeners.get('click')?.size, 1);

  assert.equal(controller.destroy(), true);
  assert.equal(h.card.removed, false, 'host card must survive teardown');
  assert.equal(h.card.getAttribute('aria-busy'), 'host-busy');
  assert.equal(h.summary.textContent, 'host summary');
  assert.equal(h.summary.dataset.state, 'host-summary');
  assert.equal(h.badge.textContent, 'host badge');
  assert.equal(h.badge.dataset.state, 'host-badge');
  assert.equal(h.refresh.disabled, true);
  assert.equal(h.refresh.listeners.get('click')?.size, 0);
  assert.equal(controller.destroy(), false);
  assert.equal(await controller.load(), null, 'destroyed controller must not start another request');
}

{
  const h = makeHost({ malformed: true });
  let calls = 0;
  const controller = api.createController({ documentRef: h.documentRef, fetchImpl: async () => { calls += 1; return response({}); } });
  assert.equal(controller.mount(), false);
  assert.equal(calls, 0);
  assert.equal(h.card.removed, false);
  assert.equal(h.summary.textContent, 'host summary');
}

const normalizedHealth = api.normalizeHealth({ canvaReadConfigured: true });
assert.equal(normalizedHealth?.canvaReadConfigured, true);
assert.deepEqual(Object.keys(normalizedHealth || {}), ['canvaReadConfigured']);
assert.equal(api.normalizeHealth({ canvaReadConfigured: 'yes' }), null);
const normalizedStatus = api.normalizeStatus({ linked: false });
assert.equal(normalizedStatus?.linked, false);
assert.deepEqual(Object.keys(normalizedStatus || {}), ['linked']);
assert.equal(api.normalizeStatus({ linked: 1 }), null);

console.log('canva connection status ownership tests passed');
