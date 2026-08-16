import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../public/conversation-export.js', import.meta.url), 'utf8');
const module = { exports: {} };
vm.runInNewContext(source, { module, exports: module.exports, globalThis: {}, self: {} });
const api = module.exports;

class NodeStub {
  constructor(tag, documentRef) {
    this.tagName = tag.toUpperCase();
    this.ownerDocument = documentRef;
    this.children = [];
    this.attributes = new Map();
    this.listeners = new Map();
    this.dataset = {};
    this.hidden = false;
    this.parentNode = null;
    this.textContent = '';
    this.className = '';
    this.id = '';
    this.disabled = false;
    this.removed = false;
  }
  append(...nodes) { for (const node of nodes) { node.parentNode = this; this.children.push(node); } }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name); }
  addEventListener(type, handler) { this.listeners.set(type, handler); }
  removeEventListener(type) { this.listeners.delete(type); }
  click() { this.listeners.get('click')?.({ target: this }); }
  focus() { this.ownerDocument.activeElement = this; }
  remove() { this.removed = true; this.parentNode = null; }
  querySelectorAll(selector) {
    if (selector !== 'button:not([disabled])') return [];
    const found = [];
    const visit = (node) => {
      for (const child of node.children) {
        if (child.tagName === 'BUTTON' && !child.disabled) found.push(child);
        visit(child);
      }
    };
    visit(this);
    return found;
  }
}

const documentRef = {
  activeElement: null,
  listeners: new Map(),
  nodesById: new Map(),
  createElement(tag) { return new NodeStub(tag, this); },
  addEventListener(type, handler) { this.listeners.set(type, handler); },
  removeEventListener(type) { this.listeners.delete(type); },
  querySelector(selector) {
    if (selector === '#messages') return this.messages;
    if (selector === '.topbar') return this.topbar;
    if (selector === '#themeToggle') return this.theme;
    if (selector === `#${api.BUTTON_ID}`) return this.trigger || null;
    if (selector === `#${api.DIALOG_ID}`) return this.dialog || null;
    if (selector === `#${api.STYLE_ID}`) return this.style || null;
    if (selector === '.conversation-row.active .conversation-open') return { textContent: 'Aktif sohbet' };
    return null;
  }
};
documentRef.body = new NodeStub('body', documentRef);
documentRef.head = new NodeStub('head', documentRef);
documentRef.topbar = new NodeStub('header', documentRef);
documentRef.theme = new NodeStub('button', documentRef);
documentRef.messages = { querySelectorAll() { return []; } };
documentRef.head.append = function append(node) { documentRef.style = node; NodeStub.prototype.append.call(this, node); };
documentRef.topbar.insertBefore = function insertBefore(node) { documentRef.trigger = node; NodeStub.prototype.append.call(this, node); };
documentRef.body.append = function append(node) {
  if (node.className === 'conversation-export-backdrop') {
    documentRef.backdrop = node;
    documentRef.dialog = node.children[0];
  }
  NodeStub.prototype.append.call(this, node);
};

const prior = new NodeStub('button', documentRef);
documentRef.activeElement = prior;
const timers = [];
const controller = api.createController({
  documentRef,
  setTimeoutImpl(fn, delay) { timers.push({ fn, delay }); return timers.length; },
  clearTimeoutImpl() {},
  BlobImpl: class {},
  urlApi: { createObjectURL() { return 'blob:x'; }, revokeObjectURL() {} }
});

assert.equal(controller.mount(), true);
assert.equal(documentRef.trigger.id, api.BUTTON_ID);
assert.equal(documentRef.trigger.getAttribute('aria-haspopup'), 'dialog');
assert.equal(documentRef.trigger.getAttribute('aria-controls'), api.DIALOG_ID);
assert.equal(documentRef.dialog.getAttribute('role'), 'dialog');
assert.equal(documentRef.dialog.getAttribute('aria-modal'), 'true');
assert.equal(documentRef.backdrop.hidden, true);

assert.equal(controller.open(), true);
assert.equal(documentRef.backdrop.hidden, false);
const buttons = documentRef.dialog.querySelectorAll('button:not([disabled])');
assert.equal(buttons.length, 3);
assert.equal(documentRef.activeElement, buttons[0]);

let prevented = 0;
documentRef.activeElement = buttons[buttons.length - 1];
controller.onKeydown({ key: 'Tab', shiftKey: false, preventDefault() { prevented += 1; } });
assert.equal(documentRef.activeElement, buttons[0]);
assert.equal(prevented, 1);

documentRef.activeElement = buttons[0];
controller.onKeydown({ key: 'Tab', shiftKey: true, preventDefault() { prevented += 1; } });
assert.equal(documentRef.activeElement, buttons[buttons.length - 1]);
assert.equal(prevented, 2);

controller.onKeydown({ key: 'Escape', preventDefault() { prevented += 1; } });
assert.equal(documentRef.backdrop.hidden, true);
assert.equal(documentRef.activeElement, prior);
assert.equal(prevented, 3);

controller.open();
documentRef.backdrop.listeners.get('click')?.({ target: documentRef.backdrop });
assert.equal(documentRef.backdrop.hidden, true);
assert.equal(documentRef.activeElement, prior);

assert.equal(controller.mount(), true);
controller.destroy();
assert.equal(documentRef.trigger.removed, true);
assert.equal(documentRef.backdrop.removed, true);
assert.equal(documentRef.listeners.has('keydown'), false);

console.log('conversation export dialog accessibility ok');
