import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const nav = require('../public/message-keyboard-nav.js');

function makeArticle({ tabIndex = null, ariaLabel = null, marker = null, sender = '' } = {}) {
  const attrs = new Map();
  if (tabIndex !== null) attrs.set('tabindex', String(tabIndex));
  if (ariaLabel !== null) attrs.set('aria-label', ariaLabel);
  const article = {
    hidden: false,
    dataset: {},
    tabIndex: tabIndex === null ? -1 : Number(tabIndex),
    focusCalls: 0,
    scrollCalls: 0,
    getAttribute(name) { return attrs.has(name) ? attrs.get(name) : null; },
    setAttribute(name, value) {
      attrs.set(name, String(value));
      if (name === 'tabindex') this.tabIndex = Number(value);
    },
    removeAttribute(name) {
      attrs.delete(name);
      if (name === 'tabindex') this.tabIndex = -1;
    },
    querySelector(selector) {
      return selector === '.meta' ? { textContent: sender } : null;
    },
    closest(selector) {
      return selector === '.message[data-message-id]' ? this : null;
    },
    focus() { this.focusCalls += 1; },
    scrollIntoView() { this.scrollCalls += 1; }
  };
  if (marker !== null) article.dataset[nav.MARKER] = marker;
  return article;
}

function makeHarness(articles) {
  const listeners = new Map();
  const observers = [];
  const container = {
    querySelectorAll(selector) { return selector === '.message[data-message-id]' ? articles : []; },
    addEventListener(type, handler) {
      const set = listeners.get(type) || new Set();
      set.add(handler);
      listeners.set(type, set);
    },
    removeEventListener(type, handler) { listeners.get(type)?.delete(handler); },
    listenerCount(type) { return listeners.get(type)?.size || 0; }
  };
  const documentRef = {
    head: { append() {} },
    querySelector(selector) {
      if (selector === '#messages') return container;
      if (selector === `#${nav.STYLE_ID}`) return { id: nav.STYLE_ID };
      return null;
    },
    createElement() { return {}; }
  };
  class MutationObserverImpl {
    constructor(callback) { this.callback = callback; this.disconnectCalls = 0; observers.push(this); }
    observe(target, options) {
      assert.equal(target, container);
      assert.deepEqual(options, { childList: true, subtree: true });
    }
    disconnect() { this.disconnectCalls += 1; }
  }
  return { container, documentRef, MutationObserverImpl, observers };
}

{
  const first = makeArticle({ tabIndex: 7, ariaLabel: 'Özel etiket', marker: 'host', sender: 'Sen' });
  const second = makeArticle({ sender: 'Hafize' });
  const harness = makeHarness([first, second]);
  const controller = nav.createController(harness);

  assert.equal(controller.mount(), true);
  assert.equal(controller.isMounted(), true);
  assert.equal(controller.mount(), true, 'double mount remains idempotent');
  assert.equal(harness.observers.length, 1);
  assert.equal(harness.container.listenerCount('keydown'), 1);
  assert.equal(harness.container.listenerCount('focusin'), 1);

  assert.equal(first.dataset[nav.MARKER], '1');
  assert.equal(first.getAttribute('aria-label'), 'Özel etiket');
  assert.equal(second.getAttribute('aria-label'), 'Hafize mesajı');
  assert.equal(first.tabIndex, 0, 'roving tabindex may temporarily replace host tabindex');
  assert.equal(second.tabIndex, -1);

  assert.equal(controller.destroy(), true);
  assert.equal(controller.isMounted(), false);
  assert.equal(harness.observers[0].disconnectCalls, 1);
  assert.equal(harness.container.listenerCount('keydown'), 0);
  assert.equal(harness.container.listenerCount('focusin'), 0);
  assert.equal(first.getAttribute('tabindex'), '7', 'host tabindex must be restored exactly');
  assert.equal(first.getAttribute('aria-label'), 'Özel etiket');
  assert.equal(first.dataset[nav.MARKER], 'host', 'pre-existing marker must be restored');
  assert.equal(second.getAttribute('tabindex'), null, 'controller-created tabindex must be removed');
  assert.equal(second.getAttribute('aria-label'), null, 'controller-created aria-label must be removed');
  assert.equal(second.dataset[nav.MARKER], undefined);
  assert.equal(controller.destroy(), false);
}

{
  const retained = makeArticle({ tabIndex: 2, sender: 'Sen' });
  const removed = makeArticle({ tabIndex: 4, sender: 'Hafize' });
  const articles = [retained, removed];
  const harness = makeHarness(articles);
  const controller = nav.createController(harness);
  assert.equal(controller.mount(), true);

  articles.splice(1, 1);
  harness.observers[0].callback();
  assert.equal(controller.destroy(), true);
  assert.equal(retained.getAttribute('tabindex'), '2');
  assert.equal(retained.getAttribute('aria-label'), null);
}

{
  const harness = makeHarness([]);
  harness.documentRef.querySelector = () => null;
  const controller = nav.createController(harness);
  assert.equal(controller.mount(), false);
  assert.equal(controller.isMounted(), false);
  assert.equal(harness.observers.length, 0);
  assert.equal(controller.destroy(), false);
}

console.log('message keyboard navigation restore tests passed');
