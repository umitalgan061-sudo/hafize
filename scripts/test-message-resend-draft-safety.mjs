import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const api = require('../public/message-copy.js');

class ClassList {
  constructor(node) { this.node = node; }
  contains(name) { return this.node.className.split(/\s+/).includes(name); }
}

class Node {
  constructor() {
    this.className = '';
    this.value = '';
    this.textContent = '';
    this.dataset = {};
    this.disabled = false;
    this.focusCount = 0;
    this.submitCount = 0;
    this.classList = new ClassList(this);
  }
  focus() { this.focusCount += 1; }
  requestSubmit() { this.submitCount += 1; }
  dispatchEvent() { return true; }
}

function documentHarness() {
  const input = new Node();
  const composer = new Node();
  const sendButton = new Node();
  const messages = new Node();
  const head = { append() {} };
  return {
    input,
    composer,
    sendButton,
    documentRef: {
      head,
      querySelector(selector) {
        if (selector === '#messageInput') return input;
        if (selector === '#composer') return composer;
        if (selector === '#sendBtn') return sendButton;
        if (selector === '#messages') return messages;
        return null;
      },
      createElement() { return new Node(); }
    }
  };
}

const timers = new Map();
let timerId = 0;
const setTimeoutImpl = (callback) => {
  timerId += 1;
  timers.set(timerId, callback);
  return timerId;
};
const clearTimeoutImpl = (id) => timers.delete(id);

function content(text) {
  const node = new Node();
  node.textContent = text;
  return node;
}

function button(label = 'Tekrar gönder') {
  const node = new Node();
  node.dataset.idleLabel = label;
  return node;
}

const harness = documentHarness();
const controller = api.createController({
  documentRef: harness.documentRef,
  clipboard: null,
  secureContext: false,
  MutationObserverImpl: null,
  setTimeoutImpl,
  clearTimeoutImpl
});

harness.input.value = 'Gönderilmeyi bekleyen farklı taslak';
const protectedButton = button();
assert.equal(controller.resendMessage(protectedButton, content('Eski kullanıcı mesajı')), false);
assert.equal(harness.input.value, 'Gönderilmeyi bekleyen farklı taslak');
assert.equal(harness.input.focusCount, 1, 'blocked resend should return focus to preserved draft');
assert.equal(harness.composer.submitCount, 0, 'blocked resend must not submit');
assert.equal(protectedButton.dataset.state, 'error');
assert.equal(protectedButton.textContent, 'Taslak korunuyor');

// Re-sending an exact draft is safe: no user-authored text is discarded.
harness.input.value = 'Eski kullanıcı mesajı';
const exactButton = button();
assert.equal(controller.resendMessage(exactButton, content('Eski kullanıcı mesajı')), true);
assert.equal(harness.input.value, 'Eski kullanıcı mesajı');
assert.equal(harness.composer.submitCount, 1);
assert.equal(exactButton.dataset.state, 'success');

// Whitespace-only composer content is not treated as valuable draft state.
harness.input.value = '   ';
const whitespaceButton = button();
assert.equal(controller.resendMessage(whitespaceButton, content('Yeni mesaj')), true);
assert.equal(harness.input.value, 'Yeni mesaj');
assert.equal(harness.composer.submitCount, 2);

const source = await readFile(fileURLToPath(new URL('../public/message-copy.js', import.meta.url)), 'utf8');
assert.equal(source.includes("draft.trim() && draft !== text"), true);
assert.equal(source.includes("showState(button, 'error', 'Taslak korunuyor')"), true);
assert.equal(source.includes('input.focus?.()'), true);
assert.equal(source.includes('localStorage'), false);
assert.equal(source.includes('sessionStorage'), false);
assert.equal(source.includes('fetch('), false, 'draft protection must not create a parallel network path');

console.log('message resend draft safety tests passed');
