import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../public/conversation-outline.js');

class FakeClassList {
  constructor() { this.values = new Set(); }
  add(value) { this.values.add(value); }
  remove(value) { this.values.delete(value); }
  contains(value) { return this.values.has(value); }
}

class FakeElement {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.listeners = new Map();
    this.attributes = new Map();
    this.dataset = {};
    this.classList = new FakeClassList();
    this.className = '';
    this.textContent = '';
    this.hidden = false;
    this.disabled = false;
    this.id = '';
    this.style = { values: new Map(), setProperty: (key, value) => this.style.values.set(key, value) };
  }
  append(...nodes) { for (const node of nodes) { node.parentNode = this; this.children.push(node); } }
  insertBefore(node, before) {
    node.parentNode = this;
    const index = this.children.indexOf(before);
    if (index < 0) this.children.push(node); else this.children.splice(index, 0, node);
  }
  remove() {
    if (!this.parentNode) return;
    this.parentNode.children = this.parentNode.children.filter((node) => node !== this);
    this.parentNode = null;
  }
  replaceChildren(...nodes) { for (const child of this.children) child.parentNode = null; this.children = []; this.append(...nodes); }
  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    if (name === 'class') this.className = String(value);
    if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g, (_m, c) => c.toUpperCase())] = String(value);
  }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  hasAttribute(name) { return this.attributes.has(name); }
  removeAttribute(name) { this.attributes.delete(name); }
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }
  removeEventListener(type, listener) {
    this.listeners.set(type, (this.listeners.get(type) || []).filter((entry) => entry !== listener));
  }
  dispatch(type, event = {}) {
    for (const listener of [...(this.listeners.get(type) || [])]) listener({ target: this, ...event });
  }
  focus(options) { this.focused = true; this.focusOptions = options; }
  scrollIntoView(options) { this.scrolled = options; }
  getBoundingClientRect() { return { right: 600, bottom: 44 }; }
  contains(target) {
    if (target === this) return true;
    return this.children.some((child) => child.contains?.(target));
  }
  matches(selector) {
    if (selector.startsWith('#')) return this.id === selector.slice(1);
    if (selector === '.message.user[data-message-id]') return this.className.split(/\s+/).includes('message') && this.className.split(/\s+/).includes('user') && Boolean(this.dataset.messageId);
    if (selector.startsWith('.')) return this.className.split(/\s+/).includes(selector.slice(1));
    if (selector === '.content') return this.className.split(/\s+/).includes('content');
    if (selector === 'link[data-hafize-conversation-outline-style]') return this.tagName === 'LINK' && this.getAttribute('data-hafize-conversation-outline-style') !== null;
    return false;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  querySelectorAll(selector) {
    const result = [];
    for (const child of this.children) {
      if (child.matches(selector)) result.push(child);
      result.push(...child.querySelectorAll(selector));
    }
    return result;
  }
}

function userMessage(id, text, { tabindex } = {}) {
  const article = new FakeElement('article');
  article.className = 'message user';
  article.dataset.messageId = id;
  if (tabindex !== undefined) article.setAttribute('tabindex', tabindex);
  const content = new FakeElement('div');
  content.className = 'content';
  content.textContent = text;
  article.append(content);
  return article;
}

function fixture({ throwOnListenerClass = null, observerThrows = false, withHostStyle = false } = {}) {
  const body = new FakeElement('body');
  const head = new FakeElement('head');
  const messages = new FakeElement('main'); messages.id = 'messages';
  const topbar = new FakeElement('header'); topbar.className = 'topbar';
  const theme = new FakeElement('button'); theme.id = 'themeToggle'; topbar.append(theme);
  const first = userMessage('u1', 'İlk kullanıcı sorusu');
  const second = userMessage('u2', 'İkinci kullanıcı sorusu', { tabindex: '0' });
  messages.append(first, second);
  body.append(topbar, messages);
  if (withHostStyle) { const link = new FakeElement('link'); link.setAttribute('data-hafize-conversation-outline-style', 'host'); head.append(link); }

  const documentListeners = new Map();
  const documentRef = {
    body, head,
    createElement(tag) {
      const node = new FakeElement(tag);
      if (throwOnListenerClass) {
        const original = node.addEventListener.bind(node);
        node.addEventListener = function addEventListener(type, listener) {
          if (this.className.split(/\s+/).includes(throwOnListenerClass)) throw new Error('listener install failed');
          return original(type, listener);
        };
      }
      return node;
    },
    querySelector(selector) {
      if (selector === '#messages') return messages;
      if (selector === '.topbar') return topbar;
      if (selector === '#conversationOutlinePanel') return body.querySelector(selector);
      if (selector === 'link[data-hafize-conversation-outline-style]') return head.querySelector(selector);
      return body.querySelector(selector) || head.querySelector(selector);
    },
    addEventListener(type, listener) {
      if (!documentListeners.has(type)) documentListeners.set(type, []);
      documentListeners.get(type).push(listener);
    },
    removeEventListener(type, listener) {
      documentListeners.set(type, (documentListeners.get(type) || []).filter((entry) => entry !== listener));
    }
  };

  let rafId = 0;
  const rafs = new Map();
  let timerId = 0;
  const timers = new Map();
  const rootListeners = new Map();
  const observers = [];
  class MutationObserver {
    constructor(callback) { if (observerThrows) throw new Error('observer constructor failed'); this.callback = callback; observers.push(this); }
    observe() { if (observerThrows) throw new Error('observe failed'); this.observing = true; }
    disconnect() { this.disconnected = true; }
  }
  const root = {
    innerWidth: 1000,
    MutationObserver,
    requestAnimationFrame(callback) { const id = ++rafId; rafs.set(id, callback); return id; },
    cancelAnimationFrame(id) { rafs.delete(id); },
    setTimeout(callback, delay) { const id = ++timerId; timers.set(id, { callback, delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    matchMedia() { return { matches: false }; },
    addEventListener(type, listener) {
      if (!rootListeners.has(type)) rootListeners.set(type, []);
      rootListeners.get(type).push(listener);
    },
    removeEventListener(type, listener) {
      rootListeners.set(type, (rootListeners.get(type) || []).filter((entry) => entry !== listener));
    }
  };
  return { body, head, messages, topbar, first, second, documentRef, root, documentListeners, rootListeners, observers, rafs, timers };
}

function panelControls(f) {
  const panel = f.body.querySelector('#conversationOutlinePanel');
  return {
    panel,
    trigger: f.topbar.querySelector('.conversation-outline-trigger'),
    search: panel?.querySelector('.conversation-outline-search'),
    close: panel?.querySelector('.conversation-outline-close'),
    list: panel?.querySelector('.conversation-outline-list')
  };
}

{
  const f = fixture();
  const controller = api.install(f.documentRef, f.root);
  assert.ok(controller);
  assert.equal(controller.getItems().length, 2);
  const c = panelControls(f);
  assert.ok(c.panel);
  assert.equal(c.trigger.textContent, '☷ Taslak 2');
  assert.equal(c.trigger.disabled, false);
  assert.equal(controller.show(), true);
  assert.equal(controller.isOpen(), true);
  assert.equal(c.panel.hidden, false);

  const second = api.install(f.documentRef, f.root);
  assert.equal(second, null, 'duplicate controller fails closed');

  assert.equal(controller.destroy(), true);
  assert.equal(controller.destroy(), false, 'destroy is idempotent');
  assert.equal(f.body.querySelector('#conversationOutlinePanel'), null);
  assert.equal(f.topbar.querySelector('.conversation-outline-trigger'), null);
  assert.equal(f.head.querySelector('link[data-hafize-conversation-outline-style]'), null, 'owned style removed');
  assert.equal(controller.show(), false, 'destroyed public methods stay inert');
  assert.equal(controller.refresh(), false);

  const remount = api.install(f.documentRef, f.root);
  assert.ok(remount, 'ownership released for clean remount');
  remount.destroy();
}

{
  const f = fixture({ withHostStyle: true });
  const hostStyle = f.head.querySelector('link[data-hafize-conversation-outline-style]');
  const controller = api.install(f.documentRef, f.root);
  assert.ok(controller);
  controller.destroy();
  assert.equal(f.head.querySelector('link[data-hafize-conversation-outline-style]'), hostStyle, 'host style preserved');
  assert.equal(hostStyle.getAttribute('data-hafize-conversation-outline-style'), 'host');
}

{
  const f = fixture();
  const controller = api.install(f.documentRef, f.root);
  assert.ok(controller);
  const observer = f.observers[0];
  observer.callback();
  assert.equal(f.rafs.size, 1, 'mutation schedules one refresh');
  observer.callback();
  assert.equal(f.rafs.size, 1, 'refresh requests coalesce');
  const stale = [...f.rafs.values()][0];
  controller.destroy();
  assert.equal(f.rafs.size, 0, 'pending RAF cancelled on destroy');
  stale();
  assert.equal(f.body.querySelector('#conversationOutlinePanel'), null, 'stale refresh cannot recreate DOM');
}

{
  const f = fixture();
  const controller = api.install(f.documentRef, f.root);
  assert.ok(controller);
  assert.equal(controller.show(), true);
  assert.equal(controller.activateItem({ id: 'u1' }), true);
  assert.equal(f.first.getAttribute('tabindex'), '-1');
  assert.equal(f.first.classList.contains('conversation-outline-target'), true);
  assert.equal(f.first.focused, true);
  assert.equal(f.first.scrolled.behavior, 'smooth');
  controller.destroy();
  assert.equal(f.first.hasAttribute('tabindex'), false, 'controller-added tabindex restored');
  assert.equal(f.first.classList.contains('conversation-outline-target'), false);

  const again = api.install(f.documentRef, f.root);
  assert.ok(again);
  again.show();
  assert.equal(again.activateItem({ id: 'u2' }), true);
  assert.equal(f.second.getAttribute('tabindex'), '0');
  again.destroy();
  assert.equal(f.second.getAttribute('tabindex'), '0', 'host tabindex preserved exactly');
}

{
  const f = fixture({ throwOnListenerClass: 'conversation-outline-close' });
  const controller = api.install(f.documentRef, f.root);
  assert.equal(controller, null, 'partial listener installation fails closed');
  assert.equal(f.body.querySelector('#conversationOutlinePanel'), null);
  assert.equal(f.topbar.querySelector('.conversation-outline-trigger'), null);
  assert.equal(f.head.querySelector('link[data-hafize-conversation-outline-style]'), null);

  const retry = fixture();
  const clean = api.install(retry.documentRef, retry.root);
  assert.ok(clean, 'separate clean installation remains possible');
  clean.destroy();
}

{
  const f = fixture({ observerThrows: true });
  const controller = api.install(f.documentRef, f.root);
  assert.equal(controller, null, 'observer construction failure rolls back installation');
  assert.equal(f.body.querySelector('#conversationOutlinePanel'), null);
  assert.equal(f.topbar.querySelector('.conversation-outline-trigger'), null);
  assert.equal((f.documentListeners.get('keydown') || []).length, 0);
  assert.equal((f.rootListeners.get('resize') || []).length, 0);
}

{
  const f = fixture();
  const foreignPanel = new FakeElement('section'); foreignPanel.id = 'conversationOutlinePanel'; f.body.append(foreignPanel);
  assert.equal(api.install(f.documentRef, f.root), null, 'foreign panel is not adopted or deleted');
  assert.equal(f.body.querySelector('#conversationOutlinePanel'), foreignPanel);
}

assert.equal(api.HIGHLIGHT_MS, 1400);
console.log('conversation outline lifecycle tests passed');
