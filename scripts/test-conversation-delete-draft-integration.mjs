import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function load(path) {
  const source = fs.readFileSync(new URL(path, import.meta.url), 'utf8');
  const module = { exports: {} };
  vm.runInNewContext(source, { module, exports: module.exports, globalThis: {} });
  return module.exports;
}

const draftApi = load('../public/draft-navigation-guard.js');
const deleteApi = load('../public/conversation-delete-confirm.js');

function runScenario(order, draftValue, approved) {
  const capture = [];
  const inputListeners = new Map();
  const input = {
    value: draftValue,
    focused: false,
    addEventListener(type, fn) { inputListeners.set(type, fn); },
    removeEventListener() {},
    focus() { this.focused = true; }
  };
  const status = { hidden: true, textContent: '', setAttribute() {}, remove() {} };
  const composer = { append() {} };
  const row = {
    hidden: false,
    classList: { contains: (name) => name === 'active' },
    querySelector: (selector) => selector === '.conversation-open' ? { textContent: 'Aktif sohbet' } : null
  };
  const button = {
    classList: { contains: () => false },
    closest(selector) {
      if (selector === '.conversation-delete') return this;
      if (selector === '.conversation-row') return row;
      return null;
    },
    focus() {}
  };
  const target = { closest: (selector) => selector === '.conversation-delete' ? button : null };
  const documentRef = {
    querySelector(selector) {
      if (selector === '#messageInput') return input;
      if (selector === '#composer') return composer;
      if (selector === `#${draftApi.STATUS_ID}`) return null;
      return null;
    },
    createElement() { return status; },
    addEventListener(type, fn, useCapture) { if (type === 'click' && useCapture) capture.push(fn); },
    removeEventListener() {}
  };
  let confirms = 0;
  const controllers = {
    draft: draftApi.createController({ documentRef }),
    deletion: deleteApi.createController({ documentRef, confirmImpl: () => { confirms += 1; return approved; } })
  };
  for (const name of order) controllers[name].mount();

  const event = {
    target,
    defaultPrevented: false,
    prevented: false,
    stopped: false,
    preventDefault() { this.prevented = true; this.defaultPrevented = true; },
    stopImmediatePropagation() { this.stopped = true; }
  };
  for (const listener of capture) {
    if (event.stopped) break;
    listener(event);
  }
  return { confirms, event, input, status };
}

for (const order of [['draft', 'deletion'], ['deletion', 'draft']]) {
  const protectedDraft = runScenario(order, 'gönderilmemiş taslak', false);
  assert.equal(protectedDraft.confirms, 0, `no delete prompt before draft resolution: ${order.join('>')}`);
  assert.equal(protectedDraft.event.prevented, true);
  assert.equal(protectedDraft.event.stopped, true);
  assert.equal(protectedDraft.input.focused, true);
  assert.match(protectedDraft.status.textContent, /Gönderilmemiş taslak/);

  const emptyDraft = runScenario(order, '', false);
  assert.equal(emptyDraft.confirms, 1, `delete prompt required with no draft: ${order.join('>')}`);
  assert.equal(emptyDraft.event.prevented, true);
  assert.equal(emptyDraft.event.stopped, true);

  const approved = runScenario(order, '', true);
  assert.equal(approved.confirms, 1);
  assert.equal(approved.event.prevented, false);
  assert.equal(approved.event.stopped, false);
}

console.log('conversation delete + draft guard integration tests passed');
