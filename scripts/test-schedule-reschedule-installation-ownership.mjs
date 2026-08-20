import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const rescheduleUi = require('../public/schedule-reschedule.js');

class FakeElement {
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
    this.dataset = {};
    this.attributes = new Map();
    this.children = [];
    this.parentNode = null;
    this.className = '';
    this.textContent = '';
    this.hidden = false;
    this.disabled = false;
    this.value = '';
    this.isConnected = false;
    this.listeners = new Map();
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  removeAttribute(name) { this.attributes.delete(name); }
  append(...nodes) {
    for (const node of nodes) {
      node.parentNode = this;
      node.setConnected?.(this.isConnected);
      this.children.push(node);
    }
  }
  setConnected(value) {
    this.isConnected = Boolean(value);
    for (const child of this.children) child.setConnected?.(value);
  }
  remove() {
    if (!this.parentNode) return;
    this.parentNode.children = this.parentNode.children.filter((node) => node !== this);
    this.parentNode = null;
    this.setConnected(false);
  }
  addEventListener(name, listener) {
    if (!this.listeners.has(name)) this.listeners.set(name, []);
    this.listeners.get(name).push(listener);
  }
  removeEventListener(name, listener) {
    const entries = this.listeners.get(name) || [];
    this.listeners.set(name, entries.filter((candidate) => candidate !== listener));
  }
  listenerCount(name) { return (this.listeners.get(name) || []).length; }
  focus() {}
  matches(selector) {
    if (selector === '.schedule-list-items') return this.className === 'schedule-list-items';
    if (selector === '.schedule-reschedule-action') return this.className === 'schedule-reschedule-action';
    if (selector === '.schedule-reschedule-toggle') return this.className === 'schedule-reschedule-toggle';
    if (selector === '.schedule-reschedule-close') return this.className === 'schedule-reschedule-close';
    if (selector === '.schedule-reschedule-form') return this.className === 'schedule-reschedule-form';
    if (selector === '.schedule-list-meta') return this.className === 'schedule-list-meta';
    if (selector === '.schedule-list-item[data-schedule-id]') {
      return this.className === 'schedule-list-item' && typeof this.dataset.scheduleId === 'string';
    }
    return false;
  }
  findAll(selector) {
    const found = [];
    for (const child of this.children) {
      if (child.matches?.(selector)) found.push(child);
      found.push(...(child.findAll?.(selector) || []));
    }
    return found;
  }
  querySelector(selector) { return this.findAll(selector)[0] || null; }
  querySelectorAll(selector) { return this.findAll(selector); }
  closest(selector) {
    let node = this;
    while (node) {
      if (node.matches?.(selector)) return node;
      node = node.parentNode;
    }
    return null;
  }
  contains(candidate) {
    if (candidate === this) return true;
    return this.children.some((child) => child.contains?.(candidate));
  }
}

function fixture({ observerObserveError = false } = {}) {
  const head = new FakeElement('head');
  const body = new FakeElement('body');
  const card = new FakeElement('section');
  const list = new FakeElement('div');
  list.className = 'schedule-list-items';
  const article = new FakeElement('article');
  article.className = 'schedule-list-item';
  article.dataset.scheduleId = 'sched-1';
  article.dataset.state = 'scheduled';
  const meta = new FakeElement('span');
  meta.className = 'schedule-list-meta';
  meta.dataset.runAt = '2032-06-01T09:45:00.000Z';
  article.append(meta);
  list.append(article);
  card.append(list);
  body.append(card);
  head.setConnected(true);
  body.setConnected(true);

  const documentListeners = new Map();
  const documentRef = {
    head,
    body,
    createElement: (tagName) => new FakeElement(tagName),
    querySelector(selector) {
      if (selector === '#scheduleListCard') return card;
      if (selector === 'link[data-hafize-schedule-reschedule-style]' || selector === 'link[data-hafize-schedule-reschedule-style="1"]') {
        return head.children.find((node) => node.getAttribute('data-hafize-schedule-reschedule-style') === '1') || null;
      }
      if (selector === '[data-hafize-schedule-reschedule-mounted]') {
        return card.getAttribute('data-hafize-schedule-reschedule-mounted') !== null ? card : null;
      }
      return null;
    },
    addEventListener(name, listener) {
      if (!documentListeners.has(name)) documentListeners.set(name, []);
      documentListeners.get(name).push(listener);
    },
    removeEventListener(name, listener) {
      const entries = documentListeners.get(name) || [];
      documentListeners.set(name, entries.filter((candidate) => candidate !== listener));
    }
  };

  class FakeObserver {
    observe() {
      if (observerObserveError) throw new Error('observer installation failed');
    }
    disconnect() {}
  }
  const root = {
    fetch: async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) }),
    confirm: () => true,
    MutationObserver: FakeObserver
  };
  return { documentRef, documentListeners, root, head, card, list, article };
}

function mount(f) {
  return rescheduleUi.mount(f.documentRef, f.root, {
    fetchImpl: f.root.fetch,
    confirmImpl: f.root.confirm,
    now: () => Date.parse('2030-01-01T00:00:00Z')
  });
}

{
  const f = fixture();
  const hostAction = new FakeElement('div');
  hostAction.className = 'schedule-reschedule-action';
  const hostArticle = new FakeElement('article');
  hostArticle.className = 'schedule-list-item';
  hostArticle.dataset.scheduleId = 'host-2';
  hostArticle.dataset.state = 'scheduled';
  hostArticle.append(hostAction);
  f.list.append(hostArticle);

  const controller = mount(f);
  assert.ok(controller);
  assert.equal(f.card.getAttribute('data-hafize-schedule-reschedule-mounted'), '1');
  assert.equal(f.list.listenerCount('click'), 1);
  assert.equal(f.list.listenerCount('submit'), 1);
  assert.equal((f.documentListeners.get('keydown') || []).length, 1);
  assert.equal(f.head.children.length, 1);
  assert.equal(f.article.querySelectorAll('.schedule-reschedule-action').length, 1);
  assert.equal(hostArticle.querySelector('.schedule-reschedule-action'), hostAction);

  assert.equal(mount(f), null, 'same list cannot have two active owners');
  assert.equal(controller.destroy(), true);
  assert.equal(controller.destroy(), false);
  assert.equal(f.list.listenerCount('click'), 0);
  assert.equal(f.list.listenerCount('submit'), 0);
  assert.equal((f.documentListeners.get('keydown') || []).length, 0);
  assert.equal(f.card.getAttribute('data-hafize-schedule-reschedule-mounted'), null);
  assert.equal(f.head.children.length, 0);
  assert.equal(f.article.querySelector('.schedule-reschedule-action'), null);
  assert.equal(hostArticle.querySelector('.schedule-reschedule-action'), hostAction, 'host action survives teardown');

  const retry = mount(f);
  assert.ok(retry, 'destroy releases ownership for clean remount');
  retry.destroy();
}

{
  const f = fixture();
  let submitAdds = 0;
  const originalAdd = f.list.addEventListener.bind(f.list);
  f.list.addEventListener = (name, listener) => {
    if (name === 'submit') {
      submitAdds += 1;
      throw new Error('submit listener installation failed');
    }
    originalAdd(name, listener);
  };
  assert.equal(mount(f), null, 'second list listener failure fails closed');
  assert.equal(submitAdds, 1);
  assert.equal(f.list.listenerCount('click'), 0, 'earlier click listener rolled back');
  assert.equal(f.list.listenerCount('submit'), 0);
  assert.equal((f.documentListeners.get('keydown') || []).length, 0);
  assert.equal(f.card.getAttribute('data-hafize-schedule-reschedule-mounted'), null);
  assert.equal(f.head.children.length, 0);
  assert.equal(f.article.querySelector('.schedule-reschedule-action'), null);

  f.list.addEventListener = originalAdd;
  const retry = mount(f);
  assert.ok(retry, 'failed listener install releases ownership for retry');
  retry.destroy();
}

{
  const f = fixture();
  f.documentRef.addEventListener = () => { throw new Error('keydown listener installation failed'); };
  assert.equal(mount(f), null);
  assert.equal(f.list.listenerCount('click'), 0);
  assert.equal(f.list.listenerCount('submit'), 0);
  assert.equal(f.card.getAttribute('data-hafize-schedule-reschedule-mounted'), null);
  assert.equal(f.head.children.length, 0);
}

{
  const f = fixture({ observerObserveError: true });
  assert.equal(mount(f), null, 'observer installation failure rolls back all installed listeners');
  assert.equal(f.list.listenerCount('click'), 0);
  assert.equal(f.list.listenerCount('submit'), 0);
  assert.equal((f.documentListeners.get('keydown') || []).length, 0);
  assert.equal(f.card.getAttribute('data-hafize-schedule-reschedule-mounted'), null);
  assert.equal(f.head.children.length, 0);
  assert.equal(f.article.querySelector('.schedule-reschedule-action'), null);
}

{
  const f = fixture();
  const hostStyle = new FakeElement('link');
  hostStyle.setAttribute('data-hafize-schedule-reschedule-style', '1');
  f.head.append(hostStyle);
  const controller = mount(f);
  assert.ok(controller);
  controller.destroy();
  assert.equal(f.head.children.length, 1, 'host-owned stylesheet survives teardown');
  assert.equal(f.head.children[0], hostStyle);
}

console.log('schedule reschedule installation ownership tests passed');
