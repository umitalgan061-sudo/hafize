import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const reschedule = require('../public/schedule-reschedule.js');

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
    this.value = '';
    this.isConnected = true;
  }
  append(...nodes) { for (const node of nodes) { node.parentNode = this; this.children.push(node); } }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  removeAttribute(name) { this.attributes.delete(name); }
  addEventListener(type, callback) { this.listeners.set(type, callback); }
  removeEventListener(type, callback) { if (this.listeners.get(type) === callback) this.listeners.delete(type); }
  focus() { this.focused = true; }
  remove() {
    this.isConnected = false;
    if (this.parentNode) this.parentNode.children = this.parentNode.children.filter((item) => item !== this);
  }
  contains(node) {
    for (let cursor = node; cursor; cursor = cursor.parentNode) if (cursor === this) return true;
    return false;
  }
  matches(selector) {
    const classes = this.className.split(/\s+/);
    if (selector.startsWith('.schedule-reschedule-')) return classes.includes(selector.slice(1));
    if (selector === '.schedule-list-meta') return classes.includes('schedule-list-meta');
    if (selector === '.schedule-list-items') return classes.includes('schedule-list-items');
    if (selector === '.schedule-list-item[data-schedule-id]') {
      return classes.includes('schedule-list-item') && typeof this.dataset.scheduleId === 'string';
    }
    return false;
  }
  closest(selector) {
    for (let cursor = this; cursor; cursor = cursor.parentNode) if (cursor.matches?.(selector)) return cursor;
    return null;
  }
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
  const meta = new FakeElement('p');
  meta.className = 'schedule-list-meta';
  meta.dataset.runAt = '2032-06-01T09:45:00.000Z';
  scheduled.append(meta);

  const completed = new FakeElement('article');
  completed.className = 'schedule-list-item';
  completed.dataset.state = 'completed';
  completed.dataset.scheduleId = 'done-456';
  list.append(scheduled, completed);

  const documentListeners = new Map();
  const documentRef = {
    head,
    createElement(tag) { return new FakeElement(tag); },
    addEventListener(type, callback) { documentListeners.set(type, callback); },
    removeEventListener(type, callback) { if (documentListeners.get(type) === callback) documentListeners.delete(type); },
    querySelector(selector) {
      if (selector === '#scheduleListCard') return card;
      if (selector === '[data-hafize-schedule-reschedule-mounted]') {
        return card.attributes.has('data-hafize-schedule-reschedule-mounted') ? card : null;
      }
      if (selector === 'link[data-hafize-schedule-reschedule-style]') {
        return head.children.find((item) => item.attributes.has('data-hafize-schedule-reschedule-style')) || null;
      }
      return card.querySelector(selector) || head.querySelector(selector);
    }
  };
  return { documentRef, documentListeners, list, scheduled, completed };
}

function rootWith({ confirmed, calls, events }) {
  class FakeObserver { observe() {} disconnect() {} }
  return {
    confirm: () => confirmed,
    fetch: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, status: 200, async json() { return { ok: true, schedule: { scheduleId: 'safe-123' } }; } };
    },
    MutationObserver: FakeObserver,
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
    dispatchEvent(event) { events.push(event); },
    setTimeout,
    clearTimeout
  };
}

async function flush() { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); }

{
  const fx = fixture();
  const calls = [];
  const events = [];
  const controller = reschedule.mount(fx.documentRef, rootWith({ confirmed: false, calls, events }), {
    now: () => Date.parse('2030-01-01T00:00:00Z')
  });
  assert.ok(controller);
  assert.equal(fx.scheduled.querySelectorAll('.schedule-reschedule-toggle').length, 1);
  assert.equal(fx.completed.querySelectorAll('.schedule-reschedule-toggle').length, 0, 'completed row must not be mutable');
  const toggle = fx.scheduled.querySelector('.schedule-reschedule-toggle');
  fx.list.listeners.get('click')({ target: toggle, preventDefault() {} });
  const form = fx.scheduled.querySelector('.schedule-reschedule-form');
  assert.equal(form.hidden, false);
  const input = fx.scheduled.querySelector('.schedule-reschedule-input');
  input.value = '2032-07-01T10:30';
  fx.list.listeners.get('submit')({ target: form, preventDefault() {} });
  await flush();
  assert.equal(calls.length, 0, 'rejected confirmation must not send PATCH');
  assert.equal(events.length, 0);
  controller.destroy();
}

{
  const fx = fixture();
  const calls = [];
  const events = [];
  const controller = reschedule.mount(fx.documentRef, rootWith({ confirmed: true, calls, events }), {
    now: () => Date.parse('2030-01-01T00:00:00Z')
  });
  const toggle = fx.scheduled.querySelector('.schedule-reschedule-toggle');
  fx.list.listeners.get('click')({ target: toggle, preventDefault() {} });
  const form = fx.scheduled.querySelector('.schedule-reschedule-form');
  fx.scheduled.querySelector('.schedule-reschedule-input').value = '2032-07-01T10:30';
  fx.list.listeners.get('submit')({ target: form, preventDefault() {} });
  await flush();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/api/schedules/safe-123');
  assert.equal(calls[0].options.method, 'PATCH');
  assert.equal(calls[0].options.credentials, 'same-origin');
  assert.deepEqual(Object.keys(JSON.parse(calls[0].options.body)), ['runAt']);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'hafize:schedule-rescheduled');
  assert.equal(events[0].detail.scheduleId, 'safe-123');
  assert.equal(form.hidden, true);
  assert.equal(controller.getState().busy, 0);
  controller.destroy();
}

console.log('schedule reschedule DOM intent tests passed');
