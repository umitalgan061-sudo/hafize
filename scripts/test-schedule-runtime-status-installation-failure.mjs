import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../public/schedule-runtime-status.js');

class Node {
  constructor() { this.children = []; this.parentNode = null; this.className = ''; this.id = ''; this.dataset = {}; this.attributes = new Map(); this.listeners = new Map(); this.textContent = ''; this.disabled = false; }
  append(...nodes) { for (const node of nodes) { node.parentNode = this; this.children.push(node); } }
  insertBefore(node, before) { const i = this.children.indexOf(before); node.parentNode = this; this.children.splice(i < 0 ? this.children.length : i, 0, node); }
  remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter((node) => node !== this); this.parentNode = null; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  removeAttribute(name) { this.attributes.delete(name); }
  addEventListener(name, fn) { if (!this.listeners.has(name)) this.listeners.set(name, []); this.listeners.get(name).push(fn); }
  removeEventListener(name, fn) { this.listeners.set(name, (this.listeners.get(name) || []).filter((item) => item !== fn)); }
  querySelector(selector) { if (selector === '.calendar-card') return this.children.find((node) => node.className === 'calendar-card') || null; return null; }
}

function fixture() {
  const rail = new Node();
  rail.className = 'utility-rail';
  const calendar = new Node();
  calendar.className = 'calendar-card';
  rail.append(calendar);
  return {
    rail,
    calendar,
    createElement: () => new Node(),
    querySelector(selector) {
      if (selector === '.utility-rail') return rail;
      if (selector === `#${api.CARD_ID}`) return rail.children.find((node) => node.id === api.CARD_ID) || null;
      return null;
    }
  };
}

const health = { scheduleWorkerConfigured: true, scheduleApiConfigured: true, scheduleStorageDurable: true, scheduleLeaseConfigured: true };

{
  const f = fixture();
  const realInsert = f.rail.insertBefore.bind(f.rail);
  f.rail.insertBefore = (node, before) => { realInsert(node, before); throw new Error('host insertion failed'); };
  const failed = api.createController({ documentRef: f, fetchImpl: async () => ({ ok: true, json: async () => health }) });
  assert.equal(failed.mount(), false, 'card insertion exception fails closed');
  assert.equal(f.querySelector(`#${api.CARD_ID}`), null, 'partially inserted owned card is removed');

  f.rail.insertBefore = realInsert;
  const retry = api.createController({ documentRef: f, fetchImpl: async () => ({ ok: true, json: async () => health }) });
  assert.equal(retry.mount(), true, 'failed construction does not retain ownership');
  retry.destroy();
}

{
  const f = fixture();
  const realCreate = f.createElement;
  let calls = 0;
  f.createElement = (tag) => {
    calls += 1;
    if (calls === 4) throw new Error('dom factory failed');
    return realCreate(tag);
  };
  const failed = api.createController({ documentRef: f, fetchImpl: async () => ({ ok: true, json: async () => health }) });
  assert.equal(failed.mount(), false, 'element creation exception fails closed');
  assert.equal(f.querySelector(`#${api.CARD_ID}`), null);
}

console.log('schedule runtime status installation failure tests passed');
