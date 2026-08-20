import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../public/schedule-runtime-status.js');

class FakeElement {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase();
    this.id = '';
    this.className = '';
    this.textContent = '';
    this.dataset = {};
    this.attributes = new Map();
    this.children = [];
    this.parentNode = null;
    this.disabled = false;
    this.listeners = new Map();
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  removeAttribute(name) { this.attributes.delete(name); }
  append(...nodes) { for (const node of nodes) { node.parentNode = this; this.children.push(node); } }
  insertBefore(node, before) {
    const index = this.children.indexOf(before);
    node.parentNode = this;
    if (index < 0) this.children.push(node); else this.children.splice(index, 0, node);
  }
  remove() {
    if (!this.parentNode) return;
    this.parentNode.children = this.parentNode.children.filter((child) => child !== this);
    this.parentNode = null;
  }
  addEventListener(name, fn) {
    if (!this.listeners.has(name)) this.listeners.set(name, []);
    this.listeners.get(name).push(fn);
  }
  removeEventListener(name, fn) {
    this.listeners.set(name, (this.listeners.get(name) || []).filter((item) => item !== fn));
  }
  listenerCount(name) { return (this.listeners.get(name) || []).length; }
  matches(selector) {
    if (selector.startsWith('#')) return this.id === selector.slice(1);
    if (selector.startsWith('.')) return this.className.split(/\s+/).includes(selector.slice(1));
    const key = selector.match(/^\[data-key="(.+)"\]$/)?.[1];
    if (key) return this.dataset.key === key;
    return false;
  }
  querySelector(selector) {
    for (const child of this.children) {
      if (child.matches(selector)) return child;
      const nested = child.querySelector(selector);
      if (nested) return nested;
    }
    return null;
  }
}

function makeDocument() {
  const body = new FakeElement('body');
  const rail = new FakeElement('aside');
  rail.className = 'utility-rail';
  const calendar = new FakeElement('section');
  calendar.className = 'calendar-card';
  rail.append(calendar);
  body.append(rail);
  return {
    body,
    rail,
    calendar,
    createElement: (tag) => new FakeElement(tag),
    querySelector(selector) {
      if (body.matches(selector)) return body;
      return body.querySelector(selector);
    }
  };
}

function addHostCard(f) {
  const card = new FakeElement('section');
  card.id = api.CARD_ID;
  card.setAttribute('aria-busy', 'host-busy');
  const status = new FakeElement('p');
  status.className = 'schedule-runtime-summary';
  status.textContent = 'Host summary';
  status.dataset.state = 'host-state';
  const refresh = new FakeElement('button');
  refresh.className = 'schedule-runtime-refresh';
  refresh.disabled = true;
  card.append(status, refresh);
  const rows = new Map();
  for (const [key] of api.FIELDS) {
    const row = new FakeElement('dd');
    row.dataset.key = key;
    row.dataset.state = `host-${key}`;
    row.textContent = `host:${key}`;
    rows.set(key, row);
    card.append(row);
  }
  f.rail.insertBefore(card, f.calendar);
  return { card, status, refresh, rows };
}

const healthy = {
  scheduleWorkerConfigured: true,
  scheduleApiConfigured: true,
  scheduleStorageDurable: true,
  scheduleLeaseConfigured: true
};

{
  const f = makeDocument();
  const host = addHostCard(f);
  let calls = 0;
  const controller = api.createController({
    documentRef: f,
    fetchImpl: async () => { calls += 1; return { ok: true, json: async () => healthy }; }
  });
  assert.equal(controller.mount(), true, 'valid host card mounts');
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(calls, 1);
  assert.equal(host.status.textContent, 'Bulut görev motoru hazır.');
  assert.equal(host.status.dataset.state, 'ready');
  assert.equal(host.card.getAttribute('aria-busy'), 'false');
  assert.equal(host.refresh.listenerCount('click'), 1);
  assert.equal(controller.destroy(), true);
  assert.equal(controller.destroy(), false);
  assert.equal(f.querySelector(`#${api.CARD_ID}`), host.card, 'host card survives');
  assert.equal(host.status.textContent, 'Host summary');
  assert.equal(host.status.dataset.state, 'host-state');
  assert.equal(host.card.getAttribute('aria-busy'), 'host-busy');
  assert.equal(host.refresh.disabled, true);
  assert.equal(host.refresh.listenerCount('click'), 0);
  for (const [key, row] of host.rows) {
    assert.equal(row.textContent, `host:${key}`);
    assert.equal(row.dataset.state, `host-${key}`);
  }
}

{
  const f = makeDocument();
  const host = addHostCard(f);
  host.rows.get('scheduleLeaseConfigured').remove();
  let calls = 0;
  const controller = api.createController({ documentRef: f, fetchImpl: async () => { calls += 1; } });
  assert.equal(controller.mount(), false, 'malformed host card fails closed');
  assert.equal(calls, 0);
  assert.equal(host.refresh.listenerCount('click'), 0);
  assert.equal(host.status.textContent, 'Host summary');
}

{
  const f = makeDocument();
  const fetchImpl = async (_url, options) => await new Promise((resolve, reject) => {
    options.signal.addEventListener('abort', () => {
      const error = new Error('aborted'); error.name = 'AbortError'; reject(error);
    }, { once: true });
  });
  const first = api.createController({ documentRef: f, fetchImpl });
  assert.equal(first.mount(), true);
  const second = api.createController({ documentRef: f, fetchImpl: async () => ({ ok: true, json: async () => healthy }) });
  assert.equal(second.mount(), false, 'duplicate controller fails closed');
  assert.equal(first.destroy(), true);
  assert.equal(f.querySelector(`#${api.CARD_ID}`), null, 'owned card removed');
  const third = api.createController({ documentRef: f, fetchImpl: async () => ({ ok: true, json: async () => healthy }) });
  assert.equal(third.mount(), true, 'ownership released for remount');
  third.destroy();
}

{
  const f = makeDocument();
  const host = addHostCard(f);
  host.refresh.addEventListener = () => { throw new Error('listener failed'); };
  const controller = api.createController({ documentRef: f, fetchImpl: async () => ({ ok: true, json: async () => healthy }) });
  assert.equal(controller.mount(), false, 'listener failure rolls back');
  assert.equal(host.status.textContent, 'Host summary');
  assert.equal(host.card.getAttribute('aria-busy'), 'host-busy');
  host.refresh.addEventListener = FakeElement.prototype.addEventListener;
  const retry = api.createController({ documentRef: f, fetchImpl: async () => ({ ok: true, json: async () => healthy }) });
  assert.equal(retry.mount(), true, 'failed install releases ownership');
  retry.destroy();
}

console.log('schedule runtime status ownership tests passed');
