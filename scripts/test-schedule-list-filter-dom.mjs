import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const filters = require('../public/schedule-list-filter.js');

class Element {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.dataset = {};
    this.attributes = new Map();
    this.listeners = new Map();
    this.className = '';
    this.id = '';
    this.textContent = '';
    this.hidden = false;
    this.value = '';
  }
  append(...nodes) { for (const node of nodes) { node.parentNode = this; this.children.push(node); } }
  insertBefore(node, reference) {
    node.parentNode = this;
    const index = this.children.indexOf(reference);
    if (index < 0) this.children.push(node); else this.children.splice(index, 0, node);
  }
  insertAdjacentElement(position, node) {
    if (position !== 'afterend' || !this.parentNode) return null;
    const index = this.parentNode.children.indexOf(this);
    node.parentNode = this.parentNode;
    this.parentNode.children.splice(index + 1, 0, node);
    return node;
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  removeAttribute(name) { this.attributes.delete(name); }
  addEventListener(type, fn) { this.listeners.set(type, fn); }
  removeEventListener(type, fn) { if (this.listeners.get(type) === fn) this.listeners.delete(type); }
  contains(node) { for (let cursor = node; cursor; cursor = cursor.parentNode) if (cursor === this) return true; return false; }
  remove() {
    if (!this.parentNode) return;
    this.parentNode.children = this.parentNode.children.filter((child) => child !== this);
    this.parentNode = null;
  }
  matches(selector) {
    if (selector.startsWith('#')) return this.id === selector.slice(1);
    if (selector.startsWith('.')) return this.className.split(/\s+/).includes(selector.slice(1));
    if (selector === '[data-filter]') return typeof this.dataset.filter === 'string';
    return false;
  }
  closest(selector) { for (let cursor = this; cursor; cursor = cursor.parentNode) if (cursor.matches?.(selector)) return cursor; return null; }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  querySelectorAll(selector) {
    const output = [];
    const visit = (node) => {
      for (const child of node.children) {
        if (child.matches(selector)) output.push(child);
        visit(child);
      }
    };
    visit(this);
    return output;
  }
}

function makeSchedule(status, agent, task) {
  const article = new Element('article');
  article.className = 'schedule-list-item';
  article.dataset.state = status;
  const agentNode = new Element('span');
  agentNode.className = 'schedule-list-agent';
  agentNode.textContent = agent;
  const taskNode = new Element('p');
  taskNode.className = 'schedule-list-task';
  taskNode.textContent = task;
  article.append(agentNode, taskNode);
  return article;
}

const head = new Element('head');
const card = new Element('section');
card.id = filters.CARD_ID;
const status = new Element('p');
status.className = 'schedule-list-status';
const list = new Element('div');
list.className = 'schedule-list-items';
const scheduled = makeSchedule('scheduled', 'minimal-engineer', 'Ankara raporunu hazırla');
const running = makeSchedule('running', 'minimal-engineer', 'NVIDIA model kontrolü');
const completed = makeSchedule('completed', 'movie-coordinator', 'Film listesini tamamla');
const failed = makeSchedule('failed', 'minimal-engineer', 'Canva bağlantısını kontrol et');
const cancelled = makeSchedule('cancelled', 'handyman-advisor', 'Eski görevi iptal et');
list.append(scheduled, running, completed, failed, cancelled);
card.append(status, list);

const documentRef = {
  head,
  documentElement: card,
  activeElement: null,
  createElement(tag) { return new Element(tag); },
  getElementById(id) { return id === filters.CARD_ID ? card : null; },
  querySelector(selector) {
    if (selector === 'link[data-hafize-schedule-filter-style]') return null;
    return card.matches(selector) ? card : card.querySelector(selector);
  }
};

class FakeObserver {
  observe() {}
  disconnect() { this.disconnected = true; }
}
const root = {
  MutationObserver: FakeObserver,
  requestAnimationFrame(fn) { fn(); },
  setTimeout(fn) { return { fn }; },
  clearTimeout() {}
};

const controller = filters.mount(documentRef, root, card);
assert.ok(controller);
assert.ok(card.querySelector(`#${filters.CONTROLS_ID}`));
assert.equal(head.children.length, 1);
assert.equal(head.children[0].href, filters.STYLE_HREF);
assert.deepEqual(controller.getState(), { filter: 'all', query: '' });
assert.equal(list.children.filter((item) => !item.hidden).length, 5);

controller.setFilter('active');
assert.deepEqual(controller.getState(), { filter: 'active', query: '' });
assert.equal(scheduled.hidden, false);
assert.equal(running.hidden, false);
assert.equal(completed.hidden, true);
assert.equal(failed.hidden, true);
assert.equal(cancelled.hidden, true);
assert.equal(completed.getAttribute('aria-hidden'), 'true');

controller.setQuery('nvidia');
assert.equal(scheduled.hidden, true);
assert.equal(running.hidden, false);
assert.equal(list.children.filter((item) => !item.hidden).length, 1);

controller.setFilter('history');
controller.setQuery('minimal');
assert.equal(failed.hidden, false);
assert.equal(completed.hidden, true);
assert.equal(cancelled.hidden, true);

controller.setFilter('failed');
controller.setQuery('canva');
assert.equal(failed.hidden, false);
assert.equal(list.children.filter((item) => !item.hidden).length, 1);

controller.setQuery('x'.repeat(200));
assert.equal(controller.getState().query.length, 120);
controller.setFilter('not-real');
assert.equal(controller.getState().filter, 'all');

controller.destroy();
for (const item of [scheduled, running, completed, failed, cancelled]) {
  assert.equal(item.hidden, false);
  assert.equal(item.getAttribute('aria-hidden'), null);
}
assert.equal(card.querySelector(`#${filters.CONTROLS_ID}`), null);

console.log('schedule list filter DOM tests passed');