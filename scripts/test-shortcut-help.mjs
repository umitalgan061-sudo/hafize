import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../public/shortcut-help.js', import.meta.url), 'utf8');
const loaderSource = fs.readFileSync(new URL('../public/chat-run-controller.js', import.meta.url), 'utf8');
const swSource = fs.readFileSync(new URL('../public/sw-policy.js', import.meta.url), 'utf8');

function loadApi() {
  const module = { exports: {} };
  vm.runInNewContext(source, { module, exports: module.exports, globalThis: {} });
  return module.exports;
}

const api = loadApi();

assert.equal(api.isHelpShortcut({ key: '?', shiftKey: true }), true);
assert.equal(api.isHelpShortcut({ key: '?', shiftKey: false }), false);
assert.equal(api.isHelpShortcut({ key: '?', shiftKey: true, ctrlKey: true }), false);
assert.equal(api.isHelpShortcut({ key: '/', shiftKey: true }), false);

assert.equal(api.isEditableTarget({ tagName: 'TEXTAREA' }), true);
assert.equal(api.isEditableTarget({ tagName: 'input' }), true);
assert.equal(api.isEditableTarget({ tagName: 'SELECT' }), true);
assert.equal(api.isEditableTarget({ tagName: 'DIV', isContentEditable: true }), true);
assert.equal(api.isEditableTarget({ tagName: 'DIV', isContentEditable: false, closest: () => null }), false);
assert.equal(api.isEditableTarget(null), false);

assert.ok(Array.isArray(api.SHORTCUTS));
assert.ok(api.SHORTCUTS.length >= 6);
assert.ok(api.SHORTCUTS.some(([keys, label]) => keys.includes('Ctrl') && label.includes('Mesaj')));
assert.ok(api.SHORTCUTS.some(([keys]) => keys === '?'));
assert.ok(api.SHORTCUTS.some(([keys]) => keys.includes('Home')));

function makeClassList() {
  const values = new Set();
  return {
    add: (...items) => items.forEach((item) => values.add(item)),
    contains: (item) => values.has(item)
  };
}

function makeNode(tag = 'div') {
  const listeners = new Map();
  const children = [];
  const attrs = new Map();
  const node = {
    tagName: tag.toUpperCase(),
    children,
    classList: makeClassList(),
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
      for (const item of items) {
        item.parentNode = node;
        children.push(item);
      }
    },
    prepend(item) {
      item.parentNode = node;
      children.unshift(item);
    },
    remove() {
      if (!node.parentNode) return;
      const index = node.parentNode.children.indexOf(node);
      if (index >= 0) node.parentNode.children.splice(index, 1);
      node.parentNode = null;
    },
    setAttribute(name, value) { attrs.set(name, String(value)); },
    getAttribute(name) { return attrs.get(name); },
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
      for (const handler of listeners.get(type) || []) handler({ target: node, ...event });
    },
    focus() { node.focusCount += 1; documentRef.activeElement = node; },
    querySelector(selector) {
      if (selector === '.shortcut-help-dialog') return children.find((item) => item.className === 'shortcut-help-dialog') || null;
      if (selector === '.shortcut-help-close') {
        const dialog = children.find((item) => item.className === 'shortcut-help-dialog');
        return dialog?.children?.[0]?.children?.find((item) => item.className === 'shortcut-help-close') || null;
      }
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

const head = makeNode('head');
const body = makeNode('body');
const footer = makeNode('div');
footer.className = 'sidebar-footer';
body.append(footer);
const documentListeners = new Map();
const documentRef = {
  head,
  body,
  activeElement: null,
  createElement: makeNode,
  querySelector(selector) {
    if (selector === '.sidebar-footer') return footer;
    const all = [];
    const walk = (current) => {
      all.push(current);
      for (const child of current.children || []) walk(child);
    };
    walk(body);
    walk(head);
    if (selector.startsWith('#')) return all.find((item) => item.id === selector.slice(1)) || null;
    return null;
  },
  addEventListener(type, handler) {
    const list = documentListeners.get(type) || [];
    list.push(handler);
    documentListeners.set(type, list);
  },
  removeEventListener(type, handler) {
    const list = documentListeners.get(type) || [];
    documentListeners.set(type, list.filter((item) => item !== handler));
  }
};

const controller = api.createController({ documentRef });
assert.equal(controller.mount(), true);
assert.equal(controller.mount(), true, 'duplicate mount must be idempotent');
const trigger = documentRef.querySelector(`#${api.BUTTON_ID}`);
const backdrop = documentRef.querySelector(`#${api.DIALOG_ID}`);
assert.ok(trigger);
assert.ok(backdrop);
assert.equal(backdrop.hidden, true);

assert.equal(controller.open(trigger), true);
assert.equal(backdrop.hidden, false);
assert.equal(trigger.getAttribute('aria-expanded'), 'true');
assert.equal(controller.open(trigger), false, 'already-open dialog must not reopen');
assert.equal(controller.close(), true);
assert.equal(backdrop.hidden, true);
assert.equal(trigger.getAttribute('aria-expanded'), 'false');
assert.ok(trigger.focusCount >= 1, 'close restores focus');

let prevented = 0;
const target = makeNode('div');
assert.equal(controller.handleKeydown({ key: '?', shiftKey: true, target, preventDefault: () => { prevented += 1; } }), true);
assert.equal(prevented, 1);
assert.equal(backdrop.hidden, false);
let stopped = 0;
assert.equal(controller.handleKeydown({ key: 'Escape', target, preventDefault: () => { prevented += 1; }, stopPropagation: () => { stopped += 1; } }), true);
assert.equal(backdrop.hidden, true);
assert.equal(stopped, 1);

const editable = makeNode('textarea');
assert.equal(controller.handleKeydown({ key: '?', shiftKey: true, target: editable }), false);
assert.equal(controller.handleKeydown({ key: '?', shiftKey: true, target, repeat: true }), false);
assert.equal(controller.handleKeydown({ key: '?', shiftKey: true, target, defaultPrevented: true }), false);

controller.destroy();
controller.destroy();
assert.equal(documentRef.querySelector(`#${api.DIALOG_ID}`), null);
assert.equal(documentRef.querySelector(`#${api.BUTTON_ID}`), null);

assert.match(loaderSource, /HafizeShortcutHelp/);
assert.match(loaderSource, /\/shortcut-help\.js/);
assert.match(swSource, /hafize-shell-v30/);
assert.match(swSource, /'\/shortcut-help\.js'/);
assert.match(swSource, /pathname\.startsWith\('\/api\/'\).*network-only/s);

for (const forbidden of ['fetch(', 'localStorage', 'sessionStorage', 'document.cookie', 'navigator.clipboard', 'eval(', 'innerHTML']) {
  assert.equal(source.includes(forbidden), false, `shortcut help must not use ${forbidden}`);
}

assert.match(source, /aria-modal/);
assert.match(source, /role', 'dialog/);
assert.match(source, /event\.key === 'Tab'/);
assert.match(source, /event\.key === 'Escape'/);

console.log('shortcut help tests passed');
