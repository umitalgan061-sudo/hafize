import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../public/conversation-export.js', import.meta.url), 'utf8');
const module = { exports: {} };
vm.runInNewContext(source, { module, exports: module.exports, globalThis: {}, self: {} });
const api = module.exports;

class FakeNode {
  constructor(tagName = 'div') {
    this.tagName = String(tagName).toUpperCase();
    this.id = '';
    this.className = '';
    this.type = '';
    this.textContent = '';
    this.hidden = false;
    this.disabled = false;
    this.dataset = {};
    this.children = [];
    this.parentNode = null;
    this.listeners = new Map();
    this.attributes = new Map();
    this.removed = false;
    this.clicks = 0;
  }

  append(...nodes) {
    for (const node of nodes) {
      node.parentNode = this;
      this.children.push(node);
    }
  }

  appendChild(node) {
    this.append(node);
    return node;
  }

  insertBefore(node, before) {
    node.parentNode = this;
    const index = this.children.indexOf(before);
    if (index < 0) this.children.push(node);
    else this.children.splice(index, 0, node);
    return node;
  }

  remove() {
    this.removed = true;
    if (!this.parentNode) return;
    const index = this.parentNode.children.indexOf(this);
    if (index >= 0) this.parentNode.children.splice(index, 1);
    this.parentNode = null;
  }

  contains(target) {
    if (target === this) return true;
    return this.children.some((child) => child.contains?.(target));
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    if (name === 'id') this.id = String(value);
    if (name === 'class') this.className = String(value);
    if (name === 'data-state') this.dataset.state = String(value);
  }

  getAttribute(name) {
    if (name === 'id' && this.id) return this.id;
    if (name === 'class' && this.className) return this.className;
    if (name === 'data-state' && Object.hasOwn(this.dataset, 'state')) return this.dataset.state;
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  hasAttribute(name) {
    if (name === 'id') return Boolean(this.id);
    if (name === 'class') return Boolean(this.className);
    if (name === 'data-state') return Object.hasOwn(this.dataset, 'state');
    return this.attributes.has(name);
  }

  removeAttribute(name) {
    this.attributes.delete(name);
    if (name === 'data-state') delete this.dataset.state;
  }

  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(handler);
  }

  removeEventListener(type, handler) {
    this.listeners.get(type)?.delete(handler);
  }

  dispatch(type, event = {}) {
    for (const handler of [...(this.listeners.get(type) || [])]) handler({ target: this, ...event });
  }

  focus() {
    this.ownerDocument.activeElement = this;
  }

  click() {
    this.clicks += 1;
    this.dispatch('click');
  }

  matches(selector) {
    if (selector.startsWith('#')) return this.id === selector.slice(1);
    if (selector.startsWith('.')) return this.className.split(/\s+/).includes(selector.slice(1));
    if (selector === 'button:not([disabled])') return this.tagName === 'BUTTON' && !this.disabled;
    return false;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  querySelectorAll(selector) {
    const found = [];
    const visit = (node) => {
      for (const child of node.children) {
        if (child.matches?.(selector)) found.push(child);
        visit(child);
      }
    };
    visit(this);
    return found;
  }
}

function article(role, text) {
  return {
    classList: { contains(value) { return value === role || value === 'message'; } },
    querySelector(selector) { return selector === '.content' ? { textContent: text } : null; }
  };
}

class FakeDocument {
  constructor() {
    this.head = this.make('head');
    this.body = this.make('body');
    this.activeElement = null;
    this.listeners = new Map();
    this.topbar = this.make('div');
    this.topbar.className = 'topbar';
    this.theme = this.make('button');
    this.theme.id = 'themeToggle';
    this.topbar.append(this.theme);
    this.body.append(this.topbar);
    this.messages = this.make('div');
    this.messages.id = 'messages';
    this.messages.querySelectorAll = (selector) => selector === '.message'
      ? [article('user', 'Merhaba'), article('assistant', 'Selam')]
      : [];
    this.body.append(this.messages);
    this.activeTitleNode = { textContent: 'Lifecycle sohbeti' };
  }

  make(tag) {
    const node = new FakeNode(tag);
    node.ownerDocument = this;
    return node;
  }

  createElement(tag) {
    return this.make(tag);
  }

  querySelector(selector) {
    if (selector === '.conversation-row.active .conversation-open') return this.activeTitleNode;
    if (this.head.matches(selector)) return this.head;
    if (this.body.matches(selector)) return this.body;
    return this.head.querySelector(selector) || this.body.querySelector(selector);
  }

  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(handler);
  }

  removeEventListener(type, handler) {
    this.listeners.get(type)?.delete(handler);
  }
}

function fakeTimers() {
  let nextId = 1;
  const entries = new Map();
  return {
    set(callback, delay) {
      const id = nextId++;
      entries.set(id, { callback, delay, cleared: false });
      return id;
    },
    clear(id) {
      const entry = entries.get(id);
      if (entry) entry.cleared = true;
    },
    entries
  };
}

function buildHostDialog(doc) {
  const trigger = doc.make('button');
  trigger.id = api.BUTTON_ID;
  trigger.setAttribute('aria-expanded', 'host-expanded');
  doc.topbar.insertBefore(trigger, doc.theme);

  const backdrop = doc.make('div');
  backdrop.className = 'conversation-export-backdrop';
  backdrop.hidden = false;
  const panel = doc.make('section');
  panel.id = api.DIALOG_ID;
  const markdown = doc.make('button');
  markdown.className = 'conversation-export-option';
  const text = doc.make('button');
  text.className = 'conversation-export-option';
  const status = doc.make('span');
  status.className = 'conversation-export-status';
  status.textContent = 'host-status';
  status.dataset.state = 'host-state';
  const close = doc.make('button');
  close.className = 'conversation-export-cancel';
  panel.append(markdown, text, status, close);
  backdrop.append(panel);
  doc.body.append(backdrop);
  return { trigger, backdrop, panel, markdown, text, status, close };
}

function controllerFor(doc, timers, downloadLog = []) {
  class BlobStub {
    constructor(parts, options) {
      this.parts = parts;
      this.options = options;
    }
  }
  return api.createController({
    documentRef: doc,
    BlobImpl: BlobStub,
    urlApi: {
      createObjectURL(blob) {
        downloadLog.push(['create', blob]);
        return 'blob:hafize-test';
      },
      revokeObjectURL(url) {
        downloadLog.push(['revoke', url]);
      }
    },
    setTimeoutImpl: timers.set,
    clearTimeoutImpl: timers.clear
  });
}

{
  const doc = new FakeDocument();
  const timers = fakeTimers();
  const downloads = [];
  const controller = controllerFor(doc, timers, downloads);
  assert.equal(controller.mount(), true);
  assert.equal(controller.mount(), true, 'double mount stays idempotent');

  const trigger = doc.querySelector(`#${api.BUTTON_ID}`);
  const panel = doc.querySelector(`#${api.DIALOG_ID}`);
  const backdrop = panel.parentNode;
  const options = panel.querySelectorAll('.conversation-export-option');
  const close = panel.querySelector('.conversation-export-cancel');
  assert.ok(trigger && panel && backdrop && options.length === 2 && close);
  assert.equal(trigger.listeners.get('click').size, 1);
  assert.equal(doc.listeners.get('keydown').size, 1);
  assert.ok(doc.querySelector(`#${api.STYLE_ID}`));

  trigger.click();
  assert.equal(backdrop.hidden, false);
  assert.equal(trigger.getAttribute('aria-expanded'), 'true');
  options[0].click();
  assert.equal(downloads[0][0], 'create');
  assert.deepEqual(downloads.at(-1), ['revoke', 'blob:hafize-test']);

  controller.destroy();
  controller.destroy();
  assert.equal(doc.querySelector(`#${api.BUTTON_ID}`), null);
  assert.equal(doc.querySelector(`#${api.DIALOG_ID}`), null);
  assert.equal(doc.querySelector(`#${api.STYLE_ID}`), null);
  assert.equal(doc.listeners.get('keydown').size, 0);
  assert.equal(controller.open(), false);
  assert.equal(controller.close(), false);
  assert.equal(controller.download('text'), false);

  const priorDownloads = downloads.length;
  trigger.click();
  options[0].click();
  close.click();
  assert.equal(downloads.length, priorDownloads, 'detached old controls stay inert');

  assert.equal(controller.mount(), true, 'clean remount is supported');
  assert.notEqual(doc.querySelector(`#${api.BUTTON_ID}`), trigger);
  controller.destroy();
}

{
  const doc = new FakeDocument();
  const host = buildHostDialog(doc);
  const timers = fakeTimers();
  const controller = controllerFor(doc, timers);
  assert.equal(controller.mount(), true);
  assert.equal(host.trigger.listeners.get('click').size, 1);
  assert.equal(host.markdown.listeners.get('click').size, 1);
  assert.equal(host.close.listeners.get('click').size, 1);

  assert.equal(controller.close(), true);
  assert.equal(host.backdrop.hidden, true);
  assert.equal(host.trigger.getAttribute('aria-expanded'), 'false');
  assert.equal(controller.open(), true);
  assert.equal(host.backdrop.hidden, false);
  assert.equal(host.trigger.getAttribute('aria-expanded'), 'true');

  controller.destroy();
  assert.equal(host.trigger.removed, false);
  assert.equal(host.backdrop.removed, false);
  assert.equal(host.trigger.getAttribute('aria-expanded'), 'host-expanded');
  assert.equal(host.backdrop.hidden, false);
  assert.equal(host.status.textContent, 'host-status');
  assert.equal(host.status.dataset.state, 'host-state');
  assert.equal(host.trigger.listeners.get('click').size, 0);
  assert.equal(host.markdown.listeners.get('click').size, 0);
  assert.equal(host.text.listeners.get('click').size, 0);
  assert.equal(host.close.listeners.get('click').size, 0);
  assert.equal(doc.listeners.get('keydown').size, 0);
}

{
  const doc = new FakeDocument();
  const malformedBackdrop = doc.make('div');
  const malformedPanel = doc.make('section');
  malformedPanel.id = api.DIALOG_ID;
  malformedBackdrop.append(malformedPanel);
  doc.body.append(malformedBackdrop);
  const controller = controllerFor(doc, fakeTimers());
  assert.equal(controller.mount(), false, 'malformed host dialog fails closed');
  assert.equal(doc.querySelector(`#${api.BUTTON_ID}`), null, 'fail-closed preflight creates no trigger');
  assert.equal(doc.querySelector(`#${api.STYLE_ID}`), null, 'fail-closed preflight creates no style');
  assert.equal(malformedPanel.removed, false);
}

{
  const doc = new FakeDocument();
  const host = buildHostDialog(doc);
  const timers = fakeTimers();
  const controller = controllerFor(doc, timers);
  assert.equal(controller.mount(), true);
  assert.equal(controller.download('markdown'), true);
  const staleCallbacks = [...timers.entries.values()].map((entry) => entry.callback);
  controller.destroy();
  assert.equal(controller.mount(), true);
  host.status.textContent = 'new-generation';
  host.status.dataset.state = 'new-state';
  host.backdrop.hidden = false;
  for (const callback of staleCallbacks) callback();
  assert.equal(host.status.textContent, 'new-generation', 'stale status timer cannot mutate remount');
  assert.equal(host.status.dataset.state, 'new-state');
  assert.equal(host.backdrop.hidden, false, 'stale close timer cannot close remount');
  controller.destroy();
}

assert.doesNotMatch(source, /\b(?:fetch|localStorage|sessionStorage|indexedDB|document\.cookie|innerHTML|eval)\b/);
assert.match(source, /triggerOwned/);
assert.match(source, /backdropOwned/);
assert.match(source, /scheduledGeneration/);

console.log('conversation export lifecycle contract ok');
