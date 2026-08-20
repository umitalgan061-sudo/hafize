import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../public/schedule-runtime-status.js');

class Node {
  constructor() {
    this.children = [];
    this.parentNode = null;
    this.className = '';
    this.id = '';
    this.dataset = {};
    this.attributes = new Map();
    this.listeners = new Map();
    this.disabled = false;
    this.textContent = '';
  }
  append(...nodes) { for (const node of nodes) { node.parentNode = this; this.children.push(node); } }
  insertBefore(node, before) { const i = this.children.indexOf(before); node.parentNode = this; if (i < 0) this.children.push(node); else this.children.splice(i, 0, node); }
  remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter((node) => node !== this); this.parentNode = null; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  removeAttribute(name) { this.attributes.delete(name); }
  addEventListener(name, fn) { if (!this.listeners.has(name)) this.listeners.set(name, []); this.listeners.get(name).push(fn); }
  removeEventListener(name, fn) { this.listeners.set(name, (this.listeners.get(name) || []).filter((item) => item !== fn)); }
  querySelector(selector) { return selector === '.calendar-card' ? this.children.find((node) => node.className === 'calendar-card') || null : null; }
}

function fixture() {
  const rail = new Node();
  rail.className = 'utility-rail';
  const calendar = new Node();
  calendar.className = 'calendar-card';
  rail.append(calendar);
  return {
    rail,
    createElement: () => new Node(),
    querySelector(selector) {
      if (selector === '.utility-rail') return rail;
      if (selector === `#${api.CARD_ID}`) return null;
      return null;
    }
  };
}

const healthy = {
  scheduleWorkerConfigured: true,
  scheduleApiConfigured: true,
  scheduleStorageDurable: true,
  scheduleLeaseConfigured: true
};

{
  const documentRef = fixture();
  let firstSignal = null;
  let calls = 0;
  let aborts = 0;
  const fetchImpl = async (_url, options) => {
    calls += 1;
    if (calls === 1) {
      firstSignal = options.signal;
      return await new Promise((resolve, reject) => {
        options.signal.addEventListener('abort', () => {
          aborts += 1;
          const error = new Error('aborted'); error.name = 'AbortError'; reject(error);
        }, { once: true });
      });
    }
    return { ok: true, json: async () => healthy };
  };
  const controller = api.createController({ documentRef, fetchImpl });
  assert.equal(controller.mount(), true);
  await Promise.resolve();
  assert.equal(calls, 1);
  const result = await controller.load();
  assert.deepEqual(result, healthy, 'new refresh completes normally');
  assert.equal(firstSignal.aborted, true, 'new refresh aborts previous fetch');
  assert.equal(aborts, 1);
  assert.equal(calls, 2);
  controller.destroy();
}

{
  const documentRef = fixture();
  let signal = null;
  let aborted = 0;
  const controller = api.createController({
    documentRef,
    fetchImpl: async (_url, options) => {
      signal = options.signal;
      return await new Promise((resolve, reject) => {
        options.signal.addEventListener('abort', () => {
          aborted += 1;
          const error = new Error('aborted'); error.name = 'AbortError'; reject(error);
        }, { once: true });
      });
    }
  });
  assert.equal(controller.mount(), true);
  await Promise.resolve();
  assert.equal(signal.aborted, false);
  assert.equal(controller.destroy(), true);
  await Promise.resolve();
  assert.equal(signal.aborted, true, 'destroy aborts actual fetch');
  assert.equal(aborted, 1);
  assert.equal(await controller.load(), null, 'destroyed controller is inert');
}

console.log('schedule runtime status controller lifecycle tests passed');
