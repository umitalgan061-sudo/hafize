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
    parentNode: null,
    setAttribute(key, value) { attrs.set(key, String(value)); },
    getAttribute(key) { return attrs.get(key); },
    addEventListener(key, value) {
      if (!handlers.has(key)) handlers.set(key, new Set());
      handlers.get(key).add(value);
    },
    removeEventListener(key, value) { handlers.get(key)?.delete(value); },
    append(...nodes) {
      for (const node of nodes) {
        children.push(node);
        node.parentNode = this;
      }
    },
    remove() {
      this.removed = true;
      if (this.parentNode?.children) {
        const index = this.parentNode.children.indexOf(this);
        if (index >= 0) this.parentNode.children.splice(index, 1);
      }
      this.parentNode = null;
    },
    focus() { this.focused = true; },
    click() {
      for (const handler of [...(handlers.get('click') || [])]) handler({ target: this, preventDefault() {} });
    },
    fire(key, event) {
      for (const handler of [...(handlers.get(key) || [])]) handler(event);
    },
    handlerCount(key) { return handlers.get(key)?.size || 0; },
    get children() { return children; }
  };
}

function createShell(text = 'console.log(1)', language = 'js') {
  const code = attrsNode();
  code.textContent = text;
  code.dataset.language = language;
  const pre = attrsNode();
  pre.append(code);
  const shell = attrsNode();
  shell.className = 'hafize-code-shell';
  shell.append(pre);
  shell.querySelector = (selector) => {
    if (selector === 'pre > code') return code;
    if (selector === `.${api.BUTTON_CLASS}`) {
      return shell.children.find((node) => node.className === api.BUTTON_CLASS && !node.removed) || null;
    }
    return null;
  };
  return { shell, code };
}

const owned = createShell();
const foreign = createShell('foreign()', 'ts');
foreign.shell.dataset[api.MARKER] = '1';
const foreignButton = attrsNode();
foreignButton.className = api.BUTTON_CLASS;
foreign.shell.append(foreignButton);

const messages = {
  querySelectorAll(selector) { return selector === '.hafize-code-shell' ? [owned.shell, foreign.shell] : []; }
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
    if (selector === `#${api.DIALOG_ID}`) {
      for (const node of body.children) {
        const dialog = node.children?.find?.((child) => child.id === api.DIALOG_ID);
        if (dialog) return dialog;
      }
    }
    return null;
  },
  querySelectorAll(selector) { return messages.querySelectorAll(selector); },
  createElement() { return attrsNode(); },
  addEventListener(key, value) {
    if (!listeners.has(key)) listeners.set(key, new Set());
    listeners.get(key).add(value);
  },
  removeEventListener(key, value) { listeners.get(key)?.delete(value); }
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
assert.equal(controller.mount(), false);
assert.equal(observed, true);
assert.equal(owned.shell.dataset[api.MARKER], '1');
assert.equal(foreign.shell.dataset[api.MARKER], '1');
const button = owned.shell.querySelector(`.${api.BUTTON_CLASS}`);
assert.ok(button);
assert.equal(button.getAttribute('aria-haspopup'), 'dialog');
assert.equal(button.getAttribute('aria-controls'), api.DIALOG_ID);
assert.equal(foreign.shell.querySelector(`.${api.BUTTON_CLASS}`), foreignButton);

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
assert.equal(view.textContent, owned.code.textContent);
assert.equal(close.focused, true);
assert.equal(listeners.get('keydown')?.size || 0, 1);

for (const handler of [...(listeners.get('keydown') || [])]) handler({ key: 'Escape', preventDefault() {} });
assert.equal(backdrop.hidden, true);
assert.equal(view.textContent, '');

button.click();
backdrop.fire('click', { target: backdrop });
assert.equal(backdrop.hidden, true);

controller.destroy();
assert.equal(disconnected, true);
assert.equal(owned.shell.dataset[api.MARKER], undefined);
assert.equal(button.removed, true);
assert.equal(button.handlerCount('click'), 0);
assert.equal(backdrop.removed, true);
assert.equal(backdrop.handlerCount('click'), 0);
assert.equal(close.handlerCount('click'), 0);
assert.equal(listeners.get('keydown')?.size || 0, 0);
assert.equal(foreign.shell.dataset[api.MARKER], '1');
assert.equal(foreign.shell.querySelector(`.${api.BUTTON_CLASS}`), foreignButton);
assert.equal(foreignButton.removed, undefined);

button.click();
assert.equal(body.children.length, 0);
assert.equal(controller.open(button, owned.code), false);
assert.equal(controller.close(), false);
assert.equal(controller.decorate(owned.shell), false);
assert.equal(controller.decorateAll(messages), 0);
controller.destroy();

const remounted = api.createController({ documentRef, MutationObserverImpl: Observer });
assert.equal(remounted.mount(), true);
const freshButton = owned.shell.querySelector(`.${api.BUTTON_CLASS}`);
assert.ok(freshButton);
assert.notEqual(freshButton, button);
remounted.destroy();

const blockedBody = attrsNode();
const existingDialog = attrsNode();
existingDialog.id = api.DIALOG_ID;
blockedBody.append(existingDialog);
const blockedDocument = {
  body: blockedBody,
  head: attrsNode(),
  querySelector(selector) {
    if (selector === `#${api.DIALOG_ID}`) return existingDialog;
    return null;
  },
  createElement() { return attrsNode(); }
};
const blocked = api.createController({ documentRef: blockedDocument });
assert.equal(blocked.open(null, owned.code), false);
assert.equal(blockedBody.children.length, 1);

assert.ok(!source.includes('fetch('));
assert.ok(!source.includes('XMLHttpRequest'));
assert.ok(!source.includes('WebSocket'));
assert.ok(!source.includes('localStorage'));
assert.ok(!source.includes('sessionStorage'));
assert.ok(!source.includes('innerHTML'));

console.log('code block focus lifecycle ok');