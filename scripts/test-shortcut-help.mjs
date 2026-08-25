import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../public/shortcut-help.js', import.meta.url), 'utf8');
const loaderSource = fs.readFileSync(new URL('../public/chat-run-controller.js', import.meta.url), 'utf8');
const swSource = fs.readFileSync(new URL('../public/sw-policy.js', import.meta.url), 'utf8');

const module = { exports: {} };
vm.runInNewContext(source, { module, exports: module.exports, globalThis: {} });
const api = module.exports;

assert.equal(api.isHelpShortcut({ key: '?', shiftKey: true }), true);
assert.equal(api.isHelpShortcut({ key: '?', shiftKey: false }), false);
assert.equal(api.isHelpShortcut({ key: '?', shiftKey: true, ctrlKey: true }), false);
assert.equal(api.isHelpShortcut({ key: '/', shiftKey: true }), false);
assert.equal(api.isEditableTarget({ tagName: 'TEXTAREA' }), true);
assert.equal(api.isEditableTarget({ tagName: 'DIV', isContentEditable: true }), true);
assert.equal(api.isEditableTarget({ tagName: 'DIV', isContentEditable: false, closest: () => null }), false);
assert.equal(api.isEditableTarget(null), false);
assert.ok(api.SHORTCUTS.length >= 6);

function makeNode(tag = 'div', documentRef = null) {
  const listeners = new Map();
  const children = [];
  const attrs = new Map();
  const node = {
    tagName: tag.toUpperCase(),
    children,
    dataset: {},
    hidden: false,
    disabled: false,
    textContent: '',
    id: '',
    className: '',
    type: '',
    parentNode: null,
    focusCount: 0,
    append(...items) {
      for (const item of items) { item.parentNode = node; children.push(item); }
    },
    prepend(item) { item.parentNode = node; children.unshift(item); },
    remove() {
      if (!node.parentNode) return;
      const index = node.parentNode.children.indexOf(node);
      if (index >= 0) node.parentNode.children.splice(index, 1);
      node.parentNode = null;
    },
    setAttribute(name, value) { attrs.set(name, String(value)); },
    getAttribute(name) { return attrs.has(name) ? attrs.get(name) : null; },
    removeAttribute(name) { attrs.delete(name); },
    addEventListener(type, handler) {
      const list = listeners.get(type) || [];
      list.push(handler);
      listeners.set(type, list);
    },
    removeEventListener(type, handler) {
      const list = listeners.get(type) || [];
      listeners.set(type, list.filter((item) => item !== handler));
    },
    emit(type, event = {}) {
      for (const handler of [...(listeners.get(type) || [])]) handler({ target: node, ...event });
    },
    listenerCount(type) { return (listeners.get(type) || []).length; },
    focus() {
      node.focusCount += 1;
      if (documentRef) documentRef.activeElement = node;
    },
    querySelector(selector) {
      const all = [];
      const walk = (current) => { for (const child of current.children || []) { all.push(child); walk(child); } };
      walk(node);
      if (selector === '.shortcut-help-dialog') return all.find((item) => item.className === 'shortcut-help-dialog') || null;
      if (selector === '.shortcut-help-close') return all.find((item) => item.className === 'shortcut-help-close') || null;
      return null;
    },
    querySelectorAll(selector) {
      if (!selector.includes('button')) return [];
      const found = [];
      const walk = (current) => {
        if (current.tagName === 'BUTTON') found.push(current);
        for (const child of current.children || []) walk(child);
      };
      walk(node);
      return found;
    }
  };
  return node;
}

function fixture({ hostTrigger = null, hostBackdrop = null } = {}) {
  const documentListeners = new Map();
  const documentRef = {
    head: null,
    body: null,
    activeElement: null,
    createElement: null,
    querySelector: null,
    addEventListener(type, handler) {
      const list = documentListeners.get(type) || [];
      list.push(handler);
      documentListeners.set(type, list);
    },
    removeEventListener(type, handler) {
      const list = documentListeners.get(type) || [];
      documentListeners.set(type, list.filter((item) => item !== handler));
    },
    listenerCount(type) { return (documentListeners.get(type) || []).length; }
  };
  const make = (tag) => makeNode(tag, documentRef);
  const head = make('head');
  const body = make('body');
  const footer = make('div');
  footer.className = 'sidebar-footer';
  body.append(footer);
  if (hostTrigger) footer.prepend(hostTrigger);
  if (hostBackdrop) body.append(hostBackdrop);
  documentRef.head = head;
  documentRef.body = body;
  documentRef.createElement = make;
  documentRef.querySelector = (selector) => {
    if (selector === '.sidebar-footer') return footer;
    const all = [];
    const walk = (current) => { all.push(current); for (const child of current.children || []) walk(child); };
    walk(body); walk(head);
    if (selector.startsWith('#')) return all.find((item) => item.id === selector.slice(1)) || null;
    return null;
  };
  return { documentRef, footer, body, make };
}

{
  const f = fixture();
  const controller = api.createController({ documentRef: f.documentRef });
  assert.equal(controller.mount(), true);
  assert.equal(controller.mount(), true, 'duplicate mount is idempotent');
  assert.deepEqual({ ...controller.snapshot() }, { mounted: true, ownsTrigger: true, ownsBackdrop: true });
  const trigger = f.documentRef.querySelector(`#${api.BUTTON_ID}`);
  const backdrop = f.documentRef.querySelector(`#${api.DIALOG_ID}`);
  const closeButton = backdrop.querySelector('.shortcut-help-close');
  assert.ok(trigger && backdrop && closeButton);
  assert.equal(trigger.listenerCount('click'), 1);
  assert.equal(closeButton.listenerCount('click'), 1);
  assert.equal(backdrop.listenerCount('click'), 1);
  assert.equal(f.documentRef.listenerCount('keydown'), 1);

  trigger.emit('click');
  assert.equal(backdrop.hidden, false);
  assert.equal(trigger.getAttribute('aria-expanded'), 'true');
  assert.equal(closeButton.focusCount, 1);
  closeButton.emit('click');
  assert.equal(backdrop.hidden, true);
  assert.equal(trigger.getAttribute('aria-expanded'), 'false');

  let prevented = 0;
  const target = f.make('div');
  assert.equal(controller.handleKeydown({ key: '?', shiftKey: true, target, preventDefault: () => { prevented += 1; } }), true);
  assert.equal(prevented, 1);
  let stopped = 0;
  assert.equal(controller.handleKeydown({ key: 'Escape', target, preventDefault() {}, stopPropagation: () => { stopped += 1; } }), true);
  assert.equal(stopped, 1);

  assert.equal(controller.destroy(), true);
  assert.equal(controller.destroy(), false);
  assert.equal(f.documentRef.querySelector(`#${api.DIALOG_ID}`), null);
  assert.equal(f.documentRef.querySelector(`#${api.BUTTON_ID}`), null);
  assert.equal(f.documentRef.listenerCount('keydown'), 0);
  assert.equal(trigger.listenerCount('click'), 0);
  assert.equal(closeButton.listenerCount('click'), 0);
  assert.equal(backdrop.listenerCount('click'), 0);
  assert.equal(controller.open(trigger), false, 'open is inert after destroy');
  assert.equal(controller.close(), false);
  assert.equal(controller.trapTab({}), false);
  assert.equal(controller.handleKeydown({ key: '?', shiftKey: true, target }), false);
}

{
  const seed = fixture();
  const hostTrigger = seed.make('button');
  hostTrigger.id = api.BUTTON_ID;
  hostTrigger.setAttribute('aria-expanded', 'mixed');
  const hostBackdrop = seed.make('div');
  hostBackdrop.id = api.DIALOG_ID;
  hostBackdrop.hidden = false;
  const dialog = seed.make('section');
  dialog.className = 'shortcut-help-dialog';
  const closeButton = seed.make('button');
  closeButton.className = 'shortcut-help-close';
  dialog.append(closeButton);
  hostBackdrop.append(dialog);

  const f = fixture({ hostTrigger, hostBackdrop });
  const controller = api.createController({ documentRef: f.documentRef });
  assert.equal(controller.mount(), true);
  assert.equal(controller.snapshot().ownsTrigger, false);
  assert.equal(controller.snapshot().ownsBackdrop, false);
  assert.equal(controller.close({ restoreFocus: false }), true, 'host-open dialog can be closed while mounted');
  assert.equal(hostBackdrop.hidden, true);
  assert.equal(hostTrigger.getAttribute('aria-expanded'), 'false');
  assert.equal(controller.destroy(), true);
  assert.equal(hostTrigger.parentNode, f.footer, 'host trigger survives teardown');
  assert.equal(hostBackdrop.parentNode, f.body, 'host backdrop survives teardown');
  assert.equal(hostBackdrop.hidden, false, 'host hidden state is restored');
  assert.equal(hostTrigger.getAttribute('aria-expanded'), 'mixed', 'host aria-expanded is restored');
  assert.equal(hostTrigger.listenerCount('click'), 0);
  assert.equal(closeButton.listenerCount('click'), 0);
  assert.equal(hostBackdrop.listenerCount('click'), 0);
}

{
  const seed = fixture();
  const malformed = seed.make('div');
  malformed.id = api.DIALOG_ID;
  const f = fixture({ hostBackdrop: malformed });
  const controller = api.createController({ documentRef: f.documentRef });
  assert.equal(controller.mount(), false, 'malformed host dialog fails closed');
  assert.equal(f.documentRef.querySelector(`#${api.BUTTON_ID}`), null, 'fail-closed mount does not create trigger');
  assert.equal(malformed.parentNode, f.body);
}

assert.match(loaderSource, /HafizeShortcutHelp/);
assert.match(loaderSource, /\/shortcut-help\.js/);
assert.match(swSource, /const CURRENT_CACHE = `\$\{CACHE_PREFIX\}v\d+`;/);
assert.match(swSource, /'\/shortcut-help\.js'/);
assert.match(swSource, /pathname\.startsWith\('\/api\/'\).*network-only/s);
for (const forbidden of ['fetch(', 'localStorage', 'sessionStorage', 'document.cookie', 'navigator.clipboard', 'eval(', 'innerHTML']) {
  assert.equal(source.includes(forbidden), false, `shortcut help must not use ${forbidden}`);
}
assert.match(source, /aria-modal/);
assert.match(source, /event\.key === 'Tab'/);
assert.match(source, /event\.key === 'Escape'/);

console.log('shortcut help tests passed');
