import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../public/schedule-runtime-status.js');

class E {
  constructor() { this.id = ''; this.className = ''; this.textContent = ''; this.dataset = {}; this.attributes = new Map(); this.children = []; this.parentNode = null; this.disabled = false; this.listeners = new Map(); }
  append(...nodes) { for (const node of nodes) { node.parentNode = this; this.children.push(node); } }
  insertBefore(node, before) { const i = this.children.indexOf(before); node.parentNode = this; this.children.splice(i < 0 ? this.children.length : i, 0, node); }
  remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter((x) => x !== this); this.parentNode = null; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  removeAttribute(name) { this.attributes.delete(name); }
  addEventListener(name, fn) { if (!this.listeners.has(name)) this.listeners.set(name, []); this.listeners.get(name).push(fn); }
  removeEventListener(name, fn) { this.listeners.set(name, (this.listeners.get(name) || []).filter((x) => x !== fn)); }
  matches(selector) {
    if (selector.startsWith('#')) return this.id === selector.slice(1);
    if (selector.startsWith('.')) return this.className.split(/\s+/).includes(selector.slice(1));
    const key = selector.match(/^\[data-key="(.+)"\]$/)?.[1];
    return key ? this.dataset.key === key : false;
  }
  querySelector(selector) { for (const child of this.children) { if (child.matches(selector)) return child; const nested = child.querySelector(selector); if (nested) return nested; } return null; }
}

const rail = new E(); rail.className = 'utility-rail';
const card = new E(); card.id = api.CARD_ID;
const status = new E(); status.className = 'schedule-runtime-summary'; status.textContent = 'Host idle';
const refresh = new E(); refresh.className = 'schedule-runtime-refresh';
card.append(status, refresh);
const rows = [];
for (const [key] of api.FIELDS) { const row = new E(); row.dataset.key = key; row.textContent = 'host'; rows.push(row); card.append(row); }
rail.append(card);
const documentRef = {
  createElement: () => new E(),
  querySelector(selector) { if (selector === '.utility-rail') return rail; if (selector === `#${api.CARD_ID}`) return card; return rail.querySelector(selector); }
};
const health = { scheduleWorkerConfigured: true, scheduleApiConfigured: true, scheduleStorageDurable: true, scheduleLeaseConfigured: true };
const controller = api.createController({ documentRef, fetchImpl: async () => ({ ok: true, json: async () => health }) });
assert.equal(controller.mount(), true);
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(card.getAttribute('aria-busy'), 'false');
assert.equal(status.dataset.state, 'ready');
for (const row of rows) assert.equal(row.dataset.state, 'ready');
assert.equal(controller.destroy(), true);
assert.equal(card.getAttribute('aria-busy'), null, 'absent host aria-busy stays absent');
assert.equal(Object.hasOwn(status.dataset, 'state'), false, 'absent host status state stays absent');
for (const row of rows) assert.equal(Object.hasOwn(row.dataset, 'state'), false, 'absent host row state stays absent');
assert.equal(status.textContent, 'Host idle');
assert.equal(refresh.disabled, false);
console.log('schedule runtime status absent host state restore tests passed');
