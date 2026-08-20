import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const scheduleFilter = require('../public/schedule-list-filter.js');

class FakeElement {
  constructor(tagName = 'div', classes = []) {
    this.tagName = String(tagName).toUpperCase();
    this.id = '';
    this.type = '';
    this.value = '';
    this.textContent = '';
    this.hidden = false;
    this.dataset = {};
    this.className = classes.join(' ');
    this.attributes = new Map();
    this.children = [];
    this.parentNode = null;
    this.listeners = new Map();
  }

  hasClass(name) {
    return String(this.className || '').split(/\s+/).filter(Boolean).includes(name);
  }

  descendants() {
    return this.children.flatMap((child) => [child, ...child.descendants()]);
  }

  append(...nodes) {
    for (const node of nodes) {
      node.parentNode = this;
      this.children.push(node);
    }
  }

  insertBefore(node, before) {
    node.parentNode = this;
    const index = this.children.indexOf(before);
    if (index < 0) this.children.push(node);
    else this.children.splice(index, 0, node);
    return node;
  }

  insertAdjacentElement(position, node) {
    if (position !== 'afterend' || !this.parentNode) return null;
    const siblings = this.parentNode.children;
    const index = siblings.indexOf(this);
    node.parentNode = this.parentNode;
    siblings.splice(index + 1, 0, node);
    return node;
  }

  remove() {
    if (!this.parentNode) return;
    this.parentNode.children = this.parentNode.children.filter((node) => node !== this);
    this.parentNode = null;
  }

  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  removeAttribute(name) { this.attributes.delete(name); }

  addEventListener(name, listener) {
    if (!this.listeners.has(name)) this.listeners.set(name, []);
    this.listeners.get(name).push(listener);
  }

  removeEventListener(name, listener) {
    const listeners = this.listeners.get(name) || [];
    this.listeners.set(name, listeners.filter((candidate) => candidate !== listener));
  }

  contains(node) { return node === this || this.descendants().includes(node); }

  querySelectorAll(selector) {
    const all = this.descendants();
    if (selector.startsWith('.')) {
      const className = selector.slice(1);
      return all.filter((node) => node.hasClass(className));
    }
    return [];
  }

  querySelector(selector) {
    if (selector.startsWith('#')) {
      const id = selector.slice(1);
      return this.descendants().find((node) => node.id === id) || null;
    }
    if (selector.startsWith('.')) {
      const className = selector.slice(1);
      return this.descendants().find((node) => node.hasClass(className)) || null;
    }
    return null;
  }
}

class FakeObserver {
  static instances = [];

  constructor(callback) {
    this.callback = callback;
    this.targets = [];
    this.disconnected = false;
    FakeObserver.instances.push(this);
  }

  observe(target, options) { this.targets.push({ target, options }); }
  disconnect() { this.disconnected = true; }
  flush() { this.callback([]); }
}

function makeItem({ state = 'scheduled', agent = 'Hafize', task = 'Görev', hidden = false, ariaHidden } = {}) {
  const article = new FakeElement('article', ['schedule-list-item']);
  article.dataset.state = state;
  article.hidden = hidden;
  if (ariaHidden !== undefined) article.setAttribute('aria-hidden', ariaHidden);

  const agentNode = new FakeElement('span', ['schedule-list-agent']);
  agentNode.textContent = agent;
  const taskNode = new FakeElement('span', ['schedule-list-task']);
  taskNode.textContent = task;
  article.append(agentNode, taskNode);
  return article;
}

function fixture(items) {
  FakeObserver.instances = [];
  const head = new FakeElement('head');
  const card = new FakeElement('section');
  card.id = scheduleFilter.CARD_ID;
  card.dataset.scope = 'all';
  const status = new FakeElement('p', ['schedule-list-status']);
  const list = new FakeElement('div', ['schedule-list-items']);
  list.append(...items);
  card.append(status, list);

  const documentRef = {
    head,
    activeElement: null,
    createElement: (tagName) => new FakeElement(tagName),
    getElementById: (id) => id === scheduleFilter.CARD_ID ? card : null,
    querySelector(selector) {
      if (selector === 'link[data-hafize-schedule-filter-style]') {
        return head.descendants().find((node) => node.getAttribute('data-hafize-schedule-filter-style') === '1') || null;
      }
      return card.querySelector(selector);
    }
  };

  const root = {
    MutationObserver: FakeObserver,
    requestAnimationFrame(callback) { callback(); return 1; },
    dispatchEvent() { return true; },
    CustomEvent: class {
      constructor(type, options) { this.type = type; this.detail = options?.detail; }
    }
  };

  return { documentRef, root, card, list, status };
}

{
  const hostHidden = makeItem({ hidden: true, ariaHidden: 'true', task: 'Host gizli görevi' });
  const hostVisible = makeItem({ hidden: false, ariaHidden: 'false', task: 'Host görünür görevi' });
  const hostWithoutAria = makeItem({ hidden: false, task: 'ARIA atanmamış görev' });
  const f = fixture([hostHidden, hostVisible, hostWithoutAria]);

  const controller = scheduleFilter.mount(f.documentRef, f.root, f.card);
  assert.ok(controller, 'filter controller mounts');
  assert.equal(hostHidden.hidden, false, 'all filter may temporarily reveal a host-hidden row');
  assert.equal(hostHidden.getAttribute('aria-hidden'), 'false');
  assert.equal(hostVisible.hidden, false);
  assert.equal(hostWithoutAria.getAttribute('aria-hidden'), 'false', 'filter owns temporary aria-hidden while mounted');

  controller.setFilter('failed');
  assert.equal(hostHidden.hidden, true);
  assert.equal(hostVisible.hidden, true);
  assert.equal(hostWithoutAria.hidden, true);

  controller.destroy();
  assert.equal(hostHidden.hidden, true, 'destroy restores host hidden=true exactly');
  assert.equal(hostHidden.getAttribute('aria-hidden'), 'true', 'destroy restores exact host aria-hidden value');
  assert.equal(hostVisible.hidden, false, 'destroy restores host visible state');
  assert.equal(hostVisible.getAttribute('aria-hidden'), 'false', 'host aria-hidden=false remains explicit');
  assert.equal(hostWithoutAria.hidden, false);
  assert.equal(hostWithoutAria.getAttribute('aria-hidden'), null, 'destroy removes controller-owned aria-hidden when host had none');
  assert.equal(FakeObserver.instances.every((observer) => observer.disconnected), true, 'all observers disconnect');
}

{
  const initial = makeItem({ task: 'İlk görev' });
  const f = fixture([initial]);
  const controller = scheduleFilter.mount(f.documentRef, f.root, f.card);
  assert.ok(controller);

  const dynamic = makeItem({ state: 'failed', hidden: true, ariaHidden: 'mixed', task: 'Sonradan gelen görev' });
  f.list.append(dynamic);
  controller.refresh();
  assert.equal(dynamic.hidden, false, 'dynamic row participates in the active all filter');
  assert.equal(dynamic.getAttribute('aria-hidden'), 'false');

  dynamic.remove();
  controller.destroy();
  assert.equal(dynamic.hidden, true, 'detached touched rows are still restored from the ownership ledger');
  assert.equal(dynamic.getAttribute('aria-hidden'), 'mixed', 'detached row exact ARIA state is restored');
}

{
  const failed = makeItem({ state: 'failed', task: 'Bağlantı hatası' });
  const active = makeItem({ state: 'running', task: 'Canlı görev' });
  const f = fixture([failed, active]);
  const controller = scheduleFilter.mount(f.documentRef, f.root, f.card);
  assert.ok(controller);

  assert.equal(controller.setFilter('failed'), true);
  assert.equal(failed.hidden, false, 'matching task remains visible');
  assert.equal(active.hidden, true, 'non-matching task is hidden');
  assert.equal(controller.setFilter('failed'), false, 'stable filter does not report a semantic change');
  controller.setQuery('bağlantı');
  assert.equal(failed.hidden, false, 'query filtering remains operational');
  controller.setQuery('eşleşmeyen');
  assert.equal(failed.hidden, true, 'query can hide a status-matching task');
  controller.destroy();
}

console.log('schedule list filter ownership tests passed');