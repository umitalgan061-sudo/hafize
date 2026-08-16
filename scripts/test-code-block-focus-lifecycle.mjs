import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../public/code-block-focus.js', import.meta.url), 'utf8');
const module = { exports: {} };
vm.runInNewContext(source, { module, exports: module.exports, globalThis: {}, self: {} });
const api = module.exports;

function attrsNode() {
  const attrs = new Map();
  const handlers = new Map();
  const children = [];
  return {
    dataset: {},
    hidden: false,
    className: '',
    id: '',
    type: '',
    textContent: '',
    target: null,
    setAttribute(key, value) { attrs.set(key, String(value)); },
    getAttribute(key) { return attrs.get(key); },
    addEventListener(key, value) { handlers.set(key, value); },
    append(...nodes) { children.push(...nodes); },
    remove() { this.removed = true; },
    focus() { this.focused = true; },
    click() { handlers.get('click')?.({ target: this, preventDefault() {} }); },
    fire(key, event) { handlers.get(key)?.(event); },
    get children() { return children; }
  };
}

const code = attrsNode();
code.textContent = 'console.log(1)';
code.dataset.language = 'js';
const pre = attrsNode();
pre.append(code);
const shell = attrsNode();
shell.querySelector = (selector) => {
  if (selector === 'pre > code') return code;
  if (selector === `.${api.BUTTON_CLASS}`) {
    return shell.children.find((node) => node.className === api.BUTTON_CLASS && !node.removed) || null;
  }
  return null;
};
const messages = {
  querySelectorAll(selector) { return selector === '.hafize-code-shell' ? [shell] : []; }
};
const body = attrsNode();
const head = attrsNode();
const listeners = new Map();
const documentRef = {
  body,
  head,
  activeElement: null,
  querySelector(selector) {
    if (selector === '#messages') return messages;
    if (selector === `#${api.STYLE_ID}`) return null;
    return null;
  },
  querySelectorAll(selector) { return selector === '.hafize-code-shell' ? [shell] : []; },
  createElement() { return attrsNode(); },
  addEventListener(key, value) { listeners.set(key, value); },
  removeEventListener(key) { listeners.delete(key); }
};

let observed = false;
let disconnected = false;
class Observer {
  constructor(callback) { this.callback = callback; }
  observe(target, options) { observed = target === messages && options.subtree === true; }
  disconnect() { disconnected = true; }
}

const controller = api.createController({ documentRef, MutationObserverImpl: Observer });
assert.equal(controller.mount(), true);
assert.equal(observed, true);
assert.equal(shell.dataset[api.MARKER], '1');
const button = shell.children.find((node) => node.className === api.BUTTON_CLASS);
assert.ok(button);
assert.equal(button.getAttribute('aria-haspopup'), 'dialog');
assert.equal(button.getAttribute('aria-controls'), api.DIALOG_ID);

button.click();
const backdrop = body.children.find((node) => node.className === 'hafize-code-focus-backdrop');
assert.ok(backdrop);
assert.equal(backdrop.hidden, false);
const dialog = backdrop.children[0];
assert.equal(dialog.getAttribute('role'), 'dialog');
assert.equal(dialog.getAttribute('aria-modal'), 'true');
const headNode = dialog.children[0];
const title = headNode.children[0];
const close = headNode.children[1];
const preNode = dialog.children[1];
const view = preNode.children[0];
assert.equal(title.textContent, 'js');
assert.equal(view.textContent, code.textContent);
assert.equal(close.focused, true);

listeners.get('keydown')?.({ key: 'Escape', preventDefault() { this.prevented = true; } });
assert.equal(backdrop.hidden, true);
assert.equal(view.textContent, '');

button.click();
backdrop.fire('click', { target: backdrop });
assert.equal(backdrop.hidden, true);

controller.destroy();
assert.equal(disconnected, true);
assert.equal(shell.dataset[api.MARKER], undefined);
assert.equal(button.removed, true);
assert.equal(backdrop.removed, true);
assert.equal(listeners.has('keydown'), false);

console.log('code block focus lifecycle ok');
