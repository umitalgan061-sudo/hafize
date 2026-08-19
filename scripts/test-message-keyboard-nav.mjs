import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../public/message-keyboard-nav.js', import.meta.url), 'utf8');
const module = { exports: {} };
vm.runInNewContext(source, { module, exports: module.exports, globalThis: {}, self: {}, Array, Object, String, Boolean, Set, Map });
const api = module.exports;

assert.deepEqual(Array.from(api.SUPPORTED_KEYS), ['ArrowUp', 'ArrowDown', 'Home', 'End']);
assert.equal(api.nextIndex(1, 'ArrowUp', 3), 0);
assert.equal(api.nextIndex(1, 'ArrowDown', 3), 2);
assert.equal(api.nextIndex(1, 'Home', 3), 0);
assert.equal(api.nextIndex(1, 'End', 3), 2);
assert.equal(api.nextIndex(0, 'ArrowUp', 3), 0);
assert.equal(api.nextIndex(2, 'ArrowDown', 3), 2);
assert.equal(api.nextIndex(-1, 'ArrowDown', 3), -1);
assert.equal(api.nextIndex(0, 'x', 1), 0);

assert.equal(api.isInteractiveTarget({ tagName: 'BUTTON' }), true);
assert.equal(api.isInteractiveTarget({ tagName: 'div', isContentEditable: true }), true);
assert.equal(api.isInteractiveTarget({ tagName: 'div', closest() { return null; } }), false);

const visible = { hidden: false, getAttribute() { return null; } };
const hidden = { hidden: true, getAttribute() { return null; } };
const ariaHidden = { hidden: false, getAttribute(name) { return name === 'aria-hidden' ? 'true' : null; } };
assert.equal(api.visibleMessages({ querySelectorAll() { return [visible, hidden, ariaHidden]; } }).length, 1);

function message({ id, sender = '', tabIndex = null, ariaLabel = null, marker = null, hidden = false } = {}) {
  const attrs = new Map();
  const dataset = {};
  const listeners = new Map();
  let tabIndexValue = -1;
  if (id) attrs.set('data-message-id', id);
  if (tabIndex !== null) { attrs.set('tabindex', String(tabIndex)); tabIndexValue = Number(tabIndex); }
  if (ariaLabel !== null) attrs.set('aria-label', ariaLabel);
  if (marker !== null) dataset[api.MARKER] = marker;
  const node = {
    hidden,
    attrs,
    dataset,
    focused: false,
    scrolled: false,
    tagName: 'ARTICLE',
    isContentEditable: false,
    getAttribute(name) { return attrs.has(name) ? attrs.get(name) : null; },
    hasAttribute(name) { return attrs.has(name); },
    setAttribute(name, value) {
      attrs.set(name, String(value));
      if (name === 'tabindex') tabIndexValue = Number(value);
    },
    removeAttribute(name) {
      attrs.delete(name);
      if (name === 'tabindex') tabIndexValue = -1;
    },
    querySelector(selector) { return selector === '.meta' && sender ? { textContent: sender } : null; },
    closest(selector) { return selector === '.message[data-message-id]' ? this : null; },
    focus(options) { this.focused = true; this.focusOptions = options; },
    scrollIntoView(options) { this.scrolled = true; this.scrollOptions = options; },
    addEventListener(type, fn) { listeners.set(type, fn); },
    removeEventListener(type, fn) { if (listeners.get(type) === fn) listeners.delete(type); }
  };
  Object.defineProperty(node, 'tabIndex', {
    get() { return tabIndexValue; },
    set(value) { tabIndexValue = Number(value); attrs.set('tabindex', String(value)); }
  });
  return node;
}

function container(initial = []) {
  const listeners = new Map();
  return {
    articles: [...initial],
    querySelectorAll(selector) {
      assert.equal(selector, '.message[data-message-id]');
      return this.articles;
    },
    addEventListener(type, fn) { listeners.set(type, fn); },
    removeEventListener(type, fn) { if (listeners.get(type) === fn) listeners.delete(type); },
    emit(type, event) { return listeners.get(type)?.(event); },
    listener(type) { return listeners.get(type) || null; }
  };
}

function styleNode() {
  return {
    id: '', textContent: '', parent: null,
    remove() {
      if (this.parent) this.parent.children = this.parent.children.filter((child) => child !== this);
      this.parent = null;
    }
  };
}

function harness({ articles, hostStyle = null, observerThrows = false } = {}) {
  const messages = container(articles || []);
  const head = {
    children: [],
    append(node) { node.parent = this; this.children.push(node); }
  };
  let style = hostStyle;
  if (style) { style.id = api.STYLE_ID; head.append(style); }
  const documentRef = {
    head,
    querySelector(selector) {
      if (selector === '#messages') return messages;
      if (selector === `#${api.STYLE_ID}`) return style;
      return null;
    },
    createElement(tag) {
      assert.equal(tag, 'style');
      const created = styleNode();
      const append = head.append.bind(head);
      head.append = (node) => { append(node); if (node.id === api.STYLE_ID) style = node; };
      return created;
    }
  };
  class Observer {
    constructor(callback) {
      if (observerThrows) throw new Error('observer unavailable');
      this.callback = callback;
      this.disconnected = false;
      harness.lastObserver = this;
    }
    observe(target, options) { this.target = target; this.options = options; }
    disconnect() { this.disconnected = true; }
    trigger() { this.callback([]); }
  }
  return { messages, head, documentRef, Observer, style: () => style };
}

{
  const first = message({ id: 'm1', sender: 'Ümit', tabIndex: 7, ariaLabel: 'Host etiketi', marker: 'host' });
  const second = message({ id: 'm2', sender: 'Hafize' });
  const h = harness({ articles: [first, second] });
  const controller = api.createController({ documentRef: h.documentRef, MutationObserverImpl: h.Observer });

  assert.equal(controller.mount(), true);
  assert.equal(controller.mount(), true);
  assert.equal(controller.snapshot().mounted, true);
  assert.equal(controller.snapshot().decoratedCount, 2);
  assert.equal(controller.snapshot().ownsStyle, true);
  assert.equal(h.head.children.filter((node) => node.id === api.STYLE_ID).length, 1);
  assert.equal(first.dataset[api.MARKER], '1');
  assert.equal(first.tabIndex, 0);
  assert.equal(first.getAttribute('aria-label'), 'Host etiketi');
  assert.equal(second.tabIndex, -1);
  assert.equal(second.getAttribute('aria-label'), 'Hafize mesajı');

  let prevented = false;
  const down = {
    key: 'ArrowDown', target: first, defaultPrevented: false,
    altKey: false, ctrlKey: false, metaKey: false, shiftKey: false,
    preventDefault() { prevented = true; }
  };
  assert.equal(h.messages.emit('keydown', down), true);
  assert.equal(prevented, true);
  assert.equal(first.tabIndex, -1);
  assert.equal(second.tabIndex, 0);
  assert.equal(second.focused, true);
  assert.equal(second.scrolled, true);

  second.hidden = true;
  harness.lastObserver.trigger();
  assert.equal(controller.snapshot().decoratedCount, 1);
  assert.equal(second.dataset[api.MARKER], undefined);
  assert.equal(second.hasAttribute('tabindex'), false);
  assert.equal(second.hasAttribute('aria-label'), false);

  second.hidden = false;
  const third = message({ id: 'm3', sender: 'Araç' });
  h.messages.articles.push(third);
  harness.lastObserver.trigger();
  assert.equal(controller.snapshot().decoratedCount, 3);
  assert.equal(third.dataset[api.MARKER], '1');
  assert.equal(third.getAttribute('aria-label'), 'Araç mesajı');

  const ownedStyle = h.style();
  assert.equal(controller.destroy(), true);
  assert.equal(controller.destroy(), false);
  assert.equal(controller.snapshot().mounted, false);
  assert.equal(controller.snapshot().decoratedCount, 0);
  assert.equal(h.messages.listener('keydown'), null);
  assert.equal(h.messages.listener('focusin'), null);
  assert.equal(harness.lastObserver.disconnected, true);
  assert.equal(ownedStyle.parent, null);

  assert.equal(first.dataset[api.MARKER], 'host');
  assert.equal(first.getAttribute('tabindex'), '7');
  assert.equal(first.getAttribute('aria-label'), 'Host etiketi');
  assert.equal(second.dataset[api.MARKER], undefined);
  assert.equal(second.hasAttribute('tabindex'), false);
  assert.equal(second.hasAttribute('aria-label'), false);
  assert.equal(third.dataset[api.MARKER], undefined);
  assert.equal(third.hasAttribute('tabindex'), false);
  assert.equal(third.hasAttribute('aria-label'), false);
  assert.equal(controller.decorate(), 0);
  assert.equal(controller.focusMessage(first), false);
  assert.equal(controller.onFocusIn({ target: first }), false);
  assert.equal(controller.onKeyDown(down), false);

  assert.equal(controller.mount(), true);
  assert.equal(controller.snapshot().decoratedCount, 3);
  assert.equal(h.head.children.filter((node) => node.id === api.STYLE_ID).length, 1);
  assert.equal(controller.destroy(), true);
}

{
  const hostStyle = styleNode();
  hostStyle.textContent = '/* host */';
  const only = message({ id: 'host-message', tabIndex: 3, ariaLabel: '', marker: 'shell' });
  const h = harness({ articles: [only], hostStyle });
  const controller = api.createController({ documentRef: h.documentRef, MutationObserverImpl: null });
  assert.equal(controller.mount(), true);
  assert.equal(controller.snapshot().ownsStyle, false);
  assert.equal(only.dataset[api.MARKER], '1');
  assert.equal(only.tabIndex, 0);
  assert.equal(only.getAttribute('aria-label'), 'Sohbet mesajı');
  assert.equal(controller.destroy(), true);
  assert.equal(hostStyle.parent, h.head);
  assert.equal(hostStyle.textContent, '/* host */');
  assert.equal(only.dataset[api.MARKER], 'shell');
  assert.equal(only.getAttribute('tabindex'), '3');
  assert.equal(only.getAttribute('aria-label'), '');
}

{
  const only = message({ id: 'rollback' });
  const h = harness({ articles: [only], observerThrows: true });
  const controller = api.createController({ documentRef: h.documentRef, MutationObserverImpl: h.Observer });
  assert.equal(controller.mount(), false);
  assert.equal(controller.snapshot().mounted, false);
  assert.equal(controller.snapshot().decoratedCount, 0);
  assert.equal(only.dataset[api.MARKER], undefined);
  assert.equal(only.hasAttribute('tabindex'), false);
  assert.equal(only.hasAttribute('aria-label'), false);
  assert.equal(h.style()?.parent ?? null, null);
}

assert.equal(api.createController({ documentRef: { querySelector: () => null, createElement() {} } }).mount(), false);
for (const forbidden of ['fetch(', 'XMLHttpRequest', 'WebSocket', 'localStorage', 'sessionStorage', 'clipboard', 'requestSubmit(', '.submit(', 'eval(']) {
  assert.equal(source.includes(forbidden), false, `forbidden API found: ${forbidden}`);
}

console.log('message keyboard navigation lifecycle tests passed');
