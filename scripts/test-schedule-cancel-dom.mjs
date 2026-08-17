import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const cancel = require('../public/schedule-cancel.js');

class FakeElement {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.dataset = {};
    this.attributes = new Map();
    this.listeners = new Map();
    this.className = '';
    this.hidden = false;
    this.disabled = false;
    this.textContent = '';
    this.isConnected = true;
  }
  append(...nodes) { for (const node of nodes) { node.parentNode = this; this.children.push(node); } }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  removeAttribute(name) { this.attributes.delete(name); }
  addEventListener(type, callback) { this.listeners.set(type, callback); }
  removeEventListener(type, callback) { if (this.listeners.get(type) === callback) this.listeners.delete(type); }
  remove() {
    this.isConnected = false;
    if (this.parentNode) this.parentNode.children = this.parentNode.children.filter((item) => item !== this);
  }
  contains(node) {
    for (let cursor = node; cursor; cursor = cursor.parentNode) if (cursor === this) return true;
    return false;
  }
  matches(selector) {
    if (selector === '.schedule-cancel-button') return this.className.split(/\s+/).includes('schedule-cancel-button');
    if (selector === '.schedule-cancel-action') return this.className.split(/\s+/).includes('schedule-cancel-action');
    if (selector === '.schedule-list-items') return this.className.split(/\s+/).includes('schedule-list-items');
    if (selector === '.schedule-list-item[data-schedule-id]') {
      return this.className.split(/\s+/).includes('schedule-list-item') && typeof this.dataset.scheduleId === 'string';
    }
    return false;
  }
  closest(selector) { for (let cursor = this; cursor; cursor = cursor.parentNode) if (cursor.matches?.(selector)) return cursor; return null; }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  querySelectorAll(selector) {
    const result = [];
    const walk = (node) => {
      for (const child of node.children || []) {
        if (child.matches?.(selector)) result.push(child);
        walk(child);
      }
    };
    walk(this);
    return result;
  }
}

function fixture() {
  const head = new FakeElement('head');
  const card = new FakeElement('section');
  card.id = 'scheduleListCard';
  const list = new FakeElement('div');
  list.className = 'schedule-list-items';
  card.append(list);
  const scheduled = new FakeElement('article');
  scheduled.className = 'schedule-list-item';
  scheduled.dataset.state = 'scheduled';
  scheduled.dataset.scheduleId = 'safe-123';
  const completed = new FakeElement('article');
  completed.className = 'schedule-list-item';
  completed.dataset.state = 'completed';
  completed.dataset.scheduleId = 'done-456';
  list.append(scheduled, completed);

  const documentRef = {
    head,
    createElement(tag) { return new FakeElement(tag); },
    querySelector(selector) {
      if (selector === '#scheduleListCard') return card;
      if (selector === '[data-hafize-schedule-cancel-mounted]') return card.attributes.has('data-hafize-schedule-cancel-mounted') ? card : null;
      if (selector === 'link[data-hafize-schedule-cancel-style]') return head.children.find((item) => item.attributes.has('data-hafize-schedule-cancel-style')) || null;
      return card.querySelector(selector) || head.querySelector(selector);
    }
  };
  return { documentRef, card, list, scheduled, completed };
}

function rootWith({ confirmed, calls }) {
  class FakeObserver { constructor(callback) { this.callback = callback; } observe() {} disconnect() {} }
  return {
    confirm: () => confirmed,
    fetch: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, status: 200, async json() { return { ok: true, schedule: { scheduleId: 'safe-123' } }; } };
    },
    MutationObserver: FakeObserver,
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {}
  };
}

{
  const fx = fixture();
  const calls = [];
  const controller = cancel.mount(fx.documentRef, rootWith({ confirmed: false, calls }));
  assert.ok(controller);
  assert.equal(fx.scheduled.querySelectorAll('.schedule-cancel-button').length, 1, 'scheduled row gets cancel action');
  assert.equal(fx.completed.querySelectorAll('.schedule-cancel-button').length, 0, 'completed row must not get cancel action');
  const button = fx.scheduled.querySelector('.schedule-cancel-button');
  fx.list.listeners.get('click')({ target: button, preventDefault() {} });
  await Promise.resolve();
  assert.equal(calls.length, 0, 'rejecting explicit confirmation must not call DELETE');
  assert.equal(controller.destroy(), true);
}

{
  const fx = fixture();
  const calls = [];
  const controller = cancel.mount(fx.documentRef, rootWith({ confirmed: true, calls }));
  const button = fx.scheduled.querySelector('.schedule-cancel-button');
  fx.list.listeners.get('click')({ target: button, preventDefault() {} });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/api/schedules/safe-123');
  assert.equal(calls[0].options.method, 'DELETE');
  assert.equal(calls[0].options.credentials, 'same-origin');
  assert.equal(calls[0].options.cache, 'no-store');
  assert.equal(Object.hasOwn(calls[0].options, 'body'), false);
  assert.equal(fx.scheduled.dataset.state, 'cancelled');
  assert.equal(fx.scheduled.querySelectorAll('.schedule-cancel-button').length, 0, 'successful cancellation removes repeat action');
  assert.equal(controller.getState().busy, 0);
  controller.destroy();
}

console.log('schedule cancel DOM intent tests passed');
