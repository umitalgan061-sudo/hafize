import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../public/composer-limit-feedback.js', import.meta.url), 'utf8');
const swPolicy = fs.readFileSync(new URL('../public/sw-policy.js', import.meta.url), 'utf8');
const loader = fs.readFileSync(new URL('../public/chat-run-controller.js', import.meta.url), 'utf8');

const module = { exports: {} };
vm.runInNewContext(source, { module, exports: module.exports, globalThis: {} });
const api = module.exports;

assert.equal(api.DEFAULT_LIMIT, 12_000);
assert.equal(api.normalizeLimit(12_000), 12_000);
assert.equal(api.normalizeLimit(5000), 5000);
assert.equal(api.normalizeLimit(0), 12_000);
assert.equal(api.normalizeLimit(50_000), 12_000);
assert.equal(api.normalizeLimit('abc'), 12_000);

assert.deepEqual({ ...api.snapshot('', 12_000) }, {
  used: 0,
  remaining: 12_000,
  limit: 12_000,
  ratio: 0,
  state: 'normal'
});
assert.equal(api.snapshot('x'.repeat(10_199), 12_000).state, 'normal');
assert.equal(api.snapshot('x'.repeat(10_200), 12_000).state, 'warning');
assert.equal(api.snapshot('x'.repeat(11_639), 12_000).state, 'warning');
assert.equal(api.snapshot('x'.repeat(11_640), 12_000).state, 'danger');
assert.equal(api.snapshot('x'.repeat(12_000), 12_000).remaining, 0);
assert.equal(api.snapshot('x'.repeat(13_000), 12_000).used, 12_000);

function node(tag = 'div') {
  const listeners = new Map();
  return {
    tagName: tag.toUpperCase(),
    id: '',
    className: '',
    dataset: {},
    textContent: '',
    value: '',
    maxLength: 12_000,
    children: [],
    parent: null,
    attributes: new Map(),
    append(...items) { for (const item of items) { item.parent = this; this.children.push(item); } },
    insertBefore(item, before) {
      item.parent = this;
      const index = this.children.indexOf(before);
      if (index < 0) this.children.push(item); else this.children.splice(index, 0, item);
    },
    remove() {
      if (!this.parent) return;
      this.parent.children = this.parent.children.filter((item) => item !== this);
      this.parent = null;
    },
    setAttribute(name, value) { this.attributes.set(name, String(value)); },
    addEventListener(type, handler) { listeners.set(type, handler); },
    removeEventListener(type, handler) { if (listeners.get(type) === handler) listeners.delete(type); },
    emit(type) { listeners.get(type)?.({ type }); },
    querySelector(selector) {
      if (selector === '.composer-limit-meter') return this.children.find((item) => item.className === 'composer-limit-meter') || null;
      if (selector === '.composer-limit-label') return this.children.find((item) => item.className === 'composer-limit-label') || null;
      if (selector === '.composer-row') return this.children.find((item) => item.className === 'composer-row') || null;
      return null;
    }
  };
}

const input = node('textarea');
input.id = 'messageInput';
const composer = node('form');
composer.id = 'composer';
const row = node('div');
row.className = 'composer-row';
composer.append(row);
const head = node('head');
let control = null;
let style = null;
const documentRef = {
  head,
  createElement(tag) {
    const created = node(tag);
    if (tag === 'progress') {
      created.max = 0;
      created.value = 0;
    }
    return created;
  },
  querySelector(selector) {
    if (selector === '#messageInput') return input;
    if (selector === '#composer') return composer;
    if (selector === '#composerLimitFeedback') return control;
    if (selector === '#hafize-composer-limit-feedback-style') return style;
    return null;
  }
};
const originalAppend = head.append.bind(head);
head.append = (...items) => {
  originalAppend(...items);
  style = items.find((item) => item.id === api.STYLE_ID) || style;
};
const originalInsert = composer.insertBefore.bind(composer);
composer.insertBefore = (item, before) => {
  originalInsert(item, before);
  if (item.id === api.CONTROL_ID) control = item;
};

const controller = api.createController({ documentRef });
assert.equal(controller.mount(), true);
assert.equal(composer.children[0].id, api.CONTROL_ID);
assert.equal(control.dataset.state, 'normal');
assert.match(control.children[1].textContent, /12\.000 karakter kullanılabilir/);

input.value = 'x'.repeat(10_200);
input.emit('input');
assert.equal(control.dataset.state, 'warning');
assert.equal(control.children[0].value, 10_200);
assert.match(control.children[1].textContent, /10\.200 \/ 12\.000/);

input.value = 'x'.repeat(11_900);
input.emit('input');
assert.equal(control.dataset.state, 'danger');
assert.equal(control.children[1].textContent, '100 karakter kaldı');

assert.equal(controller.mount(), true, 'mount is idempotent');
assert.equal(composer.children.filter((item) => item.id === api.CONTROL_ID).length, 1);
assert.equal(controller.destroy(), true);
assert.equal(controller.destroy(), false);
assert.equal(composer.children.some((item) => item.id === api.CONTROL_ID), false);

const missing = api.createController({ documentRef: { querySelector: () => null } });
assert.equal(missing.mount(), false);

assert.match(loader, /HafizeComposerLimitFeedback/);
assert.match(loader, /\/composer-limit-feedback\.js/);
assert.match(swPolicy, /hafize-shell-v24/);
assert.match(swPolicy, /'\/composer-limit-feedback\.js'/);
assert.match(swPolicy, /pathname\.startsWith\('\/api\/'\).*network-only/s);

for (const forbidden of ['fetch(', 'localStorage', 'sessionStorage', 'document.cookie', 'navigator.clipboard', 'Authorization', 'Bearer ', 'innerHTML']) {
  assert.equal(source.includes(forbidden), false, `forbidden surface: ${forbidden}`);
}

console.log('composer limit feedback tests passed');