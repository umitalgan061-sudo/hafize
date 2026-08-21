import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../public/conversation-search-navigation.js');

class FakeElement {
  constructor(tag = 'div') {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.attributes = new Map();
    this.listeners = new Map();
    this.dataset = {};
    this.id = '';
    this.className = '';
    this.textContent = '';
    this.value = '';
    this.hidden = false;
    this.disabled = false;
    this.focusCalls = [];
  }
  append(...nodes) {
    for (const node of nodes) {
      node.parentNode = this;
      this.children.push(node);
    }
  }
  remove() {
    if (!this.parentNode) return;
    this.parentNode.children = this.parentNode.children.filter((node) => node !== this);
    this.parentNode = null;
  }
  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    if (name.startsWith('data-')) {
      const key = name.slice(5).replace(/-([a-z])/g, (_m, c) => c.toUpperCase());
      this.dataset[key] = String(value);
    }
  }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }
  removeEventListener(type, listener) {
    const entries = this.listeners.get(type) || [];
    this.listeners.set(type, entries.filter((entry) => entry !== listener));
  }
  dispatch(type, event = {}) {
    for (const listener of [...(this.listeners.get(type) || [])]) {
      listener({ currentTarget: this, target: this, ...event });
    }
  }
  focus(options) { this.focusCalls.push(options); }
  contains(target) {
    if (target === this) return true;
    return this.children.some((child) => child.contains?.(target));
  }
  matches(selector) {
    if (selector.startsWith('#')) return this.id === selector.slice(1);
    if (selector.startsWith('.')) return this.className.split(/\s+/).includes(selector.slice(1));
    const direction = selector.match(/^\[data-direction="(-?\d+)"\]$/);
    if (direction) return this.dataset.direction === direction[1];
    return false;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  querySelectorAll(selector) {
    const found = [];
    for (const child of this.children) {
      if (child.matches?.(selector)) found.push(child);
      found.push(...(child.querySelectorAll?.(selector) || []));
    }
    return found;
  }
}

function makeRow(id, { hidden = false } = {}) {
  const row = new FakeElement('div');
  row.className = 'conversation-row';
  row.hidden = hidden;
  const button = new FakeElement('button');
  button.className = 'conversation-open';
  button.id = id;
  row.append(button);
  return { row, button };
}

function fixture({ observerClass } = {}) {
  const html = new FakeElement('html');
  const head = new FakeElement('head');
  const body = new FakeElement('body');
  html.append(head, body);

  const control = new FakeElement('div');
  control.id = api.CONTROL_ID;
  const input = new FakeElement('input');
  input.id = api.INPUT_ID;
  control.append(input);
  const list = new FakeElement('div');
  list.id = api.LIST_ID;
  const a = makeRow('a');
  const b = makeRow('b');
  const c = makeRow('c', { hidden: true });
  list.append(a.row, b.row, c.row);
  body.append(control, list);

  const documentListeners = new Map();
  const documentRef = {
    head,
    body,
    documentElement: html,
    createElement: (tag) => new FakeElement(tag),
    getElementById(id) {
      if (head.id === id) return head;
      if (body.id === id) return body;
      return html.querySelector(`#${id}`);
    },
    querySelector(selector) { return html.querySelector(selector); },
    addEventListener(type, listener) {
      if (!documentListeners.has(type)) documentListeners.set(type, []);
      documentListeners.get(type).push(listener);
    },
    removeEventListener(type, listener) {
      const entries = documentListeners.get(type) || [];
      documentListeners.set(type, entries.filter((entry) => entry !== listener));
    }
  };

  const observers = [];
  const Observer = observerClass || class {
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe(target, options) { this.target = target; this.options = options; }
    disconnect() { this.disconnected = true; }
    fire() { this.callback([{ type: 'attributes' }]); }
  };

  return { html, head, body, control, input, list, a, b, c, documentRef, documentListeners, observers, Observer };
}

function navControls(f) {
  const nav = f.documentRef.getElementById(api.NAV_ID);
  assert.ok(nav, 'navigation exists');
  return {
    nav,
    previous: nav.querySelector('[data-direction="-1"]'),
    next: nav.querySelector('[data-direction="1"]'),
    status: nav.querySelector(`#${api.STATUS_ID}`)
  };
}

{
  const f = fixture();
  f.input.value = 'aranan';
  const controller = api.createController({ documentRef: f.documentRef, MutationObserverImpl: f.Observer });
  assert.equal(controller.mount(), true);
  assert.equal(controller.isMounted(), true);
  assert.equal(controller.isDestroyed(), false);
  const c = navControls(f);

  assert.equal(c.status.textContent, '2 eşleşme');
  assert.equal(c.previous.disabled, false);
  assert.equal(c.next.disabled, false);

  c.next.dispatch('click', { preventDefault() {} });
  assert.equal(controller.currentIndex(), 0);
  assert.equal(f.a.button.focusCalls.length, 1);
  assert.deepEqual(f.a.button.focusCalls[0], { preventScroll: false });
  assert.equal(c.status.textContent, '1 / 2');

  c.next.dispatch('click', { preventDefault() {} });
  assert.equal(controller.currentIndex(), 1);
  assert.equal(f.b.button.focusCalls.length, 1);
  assert.equal(c.status.textContent, '2 / 2');

  c.next.dispatch('click', { preventDefault() {} });
  assert.equal(controller.currentIndex(), 0, 'navigation wraps');
  assert.equal(f.a.button.focusCalls.length, 2);

  c.previous.dispatch('click', { preventDefault() {} });
  assert.equal(controller.currentIndex(), 1);
  assert.equal(f.b.button.focusCalls.length, 2);

  f.input.value = '';
  f.input.dispatch('input');
  assert.equal(controller.currentIndex(), -1);
  assert.equal(c.previous.disabled, true);
  assert.equal(c.next.disabled, true);
  assert.equal(c.status.textContent, '');

  assert.equal(controller.destroy(), true);
  assert.equal(controller.destroy(), false, 'destroy is idempotent');
  assert.equal(controller.isMounted(), false);
  assert.equal(controller.isDestroyed(), true);
  assert.equal(f.documentRef.getElementById(api.NAV_ID), null);
  assert.equal(f.documentRef.getElementById(api.STYLE_ID), null);
  assert.equal(f.observers[0].disconnected, true);
}

{
  const f = fixture();
  f.input.value = 'query';
  const first = api.createController({ documentRef: f.documentRef, MutationObserverImpl: f.Observer });
  const second = api.createController({ documentRef: f.documentRef, MutationObserverImpl: f.Observer });
  assert.equal(first.mount(), true);
  assert.equal(second.mount(), false, 'same conversation list rejects duplicate controller');

  const ownedNav = f.documentRef.getElementById(api.NAV_ID);
  ownedNav.remove();
  assert.equal(second.mount(), false, 'weak ownership survives external DOM removal');

  assert.equal(first.destroy(), true);
  assert.equal(second.mount(), true, 'destroy releases list ownership for clean remount');
  assert.equal(second.destroy(), true);
}

{
  const f = fixture();
  f.input.value = 'query';
  const controller = api.createController({ documentRef: f.documentRef, MutationObserverImpl: f.Observer });
  assert.equal(controller.mount(), true);
  const c = navControls(f);
  const staleClick = c.next.listeners.get('click')[0];
  const staleInput = f.input.listeners.get('input')[0];
  const staleKeydown = f.documentListeners.get('keydown')[0];
  const staleObserver = f.observers[0];

  assert.equal(controller.destroy(), true);
  const aFocusBefore = f.a.button.focusCalls.length;
  staleClick({ currentTarget: c.next, preventDefault() {} });
  staleInput();
  staleKeydown({ altKey: true, key: 'ArrowDown', target: f.input, preventDefault() {} });
  staleObserver.fire();
  assert.equal(f.a.button.focusCalls.length, aFocusBefore, 'stale callbacks cannot focus rows after destroy');
  assert.equal(controller.move(1), false);
  assert.equal(controller.reset(), false);
  assert.deepEqual(controller.render(), []);
}

{
  const f = fixture();
  f.input.value = 'query';
  const controller = api.createController({ documentRef: f.documentRef, MutationObserverImpl: f.Observer });
  assert.equal(controller.mount(), true);
  const c = navControls(f);

  const keydown = f.documentListeners.get('keydown')[0];
  let prevented = 0;
  keydown({ altKey: true, key: 'ArrowDown', target: f.input, preventDefault() { prevented += 1; } });
  assert.equal(prevented, 1);
  assert.equal(f.a.button.focusCalls.length, 1);

  keydown({ altKey: true, key: 'ArrowUp', target: c.next, preventDefault() { prevented += 1; } });
  assert.equal(prevented, 2);
  assert.equal(f.b.button.focusCalls.length, 1);

  const outsider = new FakeElement('button');
  keydown({ altKey: true, key: 'ArrowDown', target: outsider, preventDefault() { prevented += 1; } });
  assert.equal(prevented, 2, 'unrelated focus target cannot drive search navigation');

  keydown({ altKey: true, ctrlKey: true, key: 'ArrowDown', target: f.input, preventDefault() { prevented += 1; } });
  keydown({ altKey: true, repeat: true, key: 'ArrowDown', target: f.input, preventDefault() { prevented += 1; } });
  assert.equal(prevented, 2, 'modified or repeated shortcuts are ignored');
  controller.destroy();
}

{
  const f = fixture();
  f.input.value = 'query';
  const controller = api.createController({ documentRef: f.documentRef, MutationObserverImpl: f.Observer });
  assert.equal(controller.mount(), true);
  const c = navControls(f);
  assert.equal(controller.move(1), true);
  assert.equal(controller.currentIndex(), 0);

  f.a.row.hidden = true;
  f.observers[0].fire();
  assert.equal(controller.currentIndex(), -1, 'visibility mutation resets navigation position');
  assert.equal(c.status.textContent, '1 eşleşme');
  assert.equal(controller.move(1), true);
  assert.equal(f.b.button.focusCalls.length, 1);
  controller.destroy();
}

{
  const f = fixture();
  f.input.value = 'query';
  f.a.button.focus = () => { throw new Error('focus failed'); };
  const controller = api.createController({ documentRef: f.documentRef, MutationObserverImpl: f.Observer });
  assert.equal(controller.mount(), true);
  assert.equal(controller.move(1), false, 'focus failure is contained');
  assert.equal(controller.currentIndex(), -1);
  const c = navControls(f);
  assert.equal(c.status.textContent, '2 eşleşme');
  controller.destroy();
}

console.log('conversation search navigation lifecycle tests passed');
