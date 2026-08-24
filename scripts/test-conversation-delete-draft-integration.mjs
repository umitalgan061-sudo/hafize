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

function runScenario(order, draftValue, attempts = 1) {
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
    textContent: '×',
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
  const controllers = {
    draft: draftApi.createController({ documentRef }),
    deletion: deleteApi.createController({
      documentRef,
      setTimeoutImpl: () => 1,
      clearTimeoutImpl() {}
    })
  };
  for (const name of order) controllers[name].mount();

  const events = [];
  for (let attempt = 0; attempt < attempts; attempt += 1) {
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
    events.push(event);
  }
  return { events, input, status, button };
}

for (const order of [['draft', 'deletion'], ['deletion', 'draft']]) {
  const protectedDraft = runScenario(order, 'gönderilmemiş taslak');
  assert.equal(protectedDraft.events[0].prevented, true);
  assert.equal(protectedDraft.events[0].stopped, true);
  assert.equal(protectedDraft.input.focused, true);
  assert.match(protectedDraft.status.textContent, /Gönderilmemiş taslak/);

  const emptyDraft = runScenario(order, '');
  assert.equal(emptyDraft.events[0].prevented, true, `first delete click requires confirmation: ${order.join('>')}`);
  assert.equal(emptyDraft.events[0].stopped, true);
  assert.equal(emptyDraft.button.textContent, 'Sil?');

  const approved = runScenario(order, '', 2);
  assert.equal(approved.events[0].prevented, true);
  assert.equal(approved.events[0].stopped, true);
  assert.equal(approved.events[1].prevented, false, `second delete click is approved: ${order.join('>')}`);
  assert.equal(approved.events[1].stopped, false);
}

console.log('conversation delete + draft guard integration tests passed');
