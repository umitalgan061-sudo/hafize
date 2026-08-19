import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const shortcuts = require('../public/keyboard-shortcuts.js');

function keyEvent(overrides = {}) {
  return {
    key: 'f',
    ctrlKey: true,
    metaKey: false,
    altKey: false,
    shiftKey: true,
    repeat: false,
    defaultPrevented: false,
    preventDefaultCalls: 0,
    preventDefault() {
      this.defaultPrevented = true;
      this.preventDefaultCalls += 1;
    },
    ...overrides
  };
}

function createDocument({ searchInput, composer, sendButton } = {}) {
  const listeners = new Map();
  return {
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    removeEventListener(type, listener) {
      if (listeners.get(type) === listener) listeners.delete(type);
    },
    querySelector(selector) {
      if (selector === '#conversationSearchInput') return searchInput || null;
      if (selector === '#messageInput') return composer || null;
      if (selector === '#sendBtn') return sendButton || null;
      return null;
    },
    dispatch(event) {
      return listeners.get('keydown')?.(event);
    },
    listeners
  };
}

assert.equal(shortcuts.SHORTCUTS.focusConversationSearch, 'mod+shift+f');
assert.equal(shortcuts.isConversationSearchShortcut(keyEvent()), true);
assert.equal(shortcuts.isConversationSearchShortcut(keyEvent({ ctrlKey: false, metaKey: true })), true);
assert.equal(shortcuts.isConversationSearchShortcut(keyEvent({ shiftKey: false })), false);
assert.equal(shortcuts.isConversationSearchShortcut(keyEvent({ altKey: true })), false);
assert.equal(shortcuts.isConversationSearchShortcut(keyEvent({ key: 'F' })), true);

let focused = 0;
let selected = 0;
const searchInput = {
  disabled: false,
  focus() { focused += 1; },
  select() { selected += 1; }
};
const documentRef = createDocument({ searchInput });
const controller = shortcuts.createController({ documentRef });
assert.equal(controller.mount(), true);

const event = keyEvent();
assert.equal(documentRef.dispatch(event), true);
assert.equal(event.preventDefaultCalls, 1);
assert.equal(focused, 1);
assert.equal(selected, 1);

const repeat = keyEvent({ repeat: true });
assert.equal(documentRef.dispatch(repeat), false);
assert.equal(focused, 1);

searchInput.disabled = true;
const disabled = keyEvent();
assert.equal(documentRef.dispatch(disabled), false);
assert.equal(disabled.preventDefaultCalls, 0);
assert.equal(focused, 1);
searchInput.disabled = false;

const missingDocument = createDocument();
const missingController = shortcuts.createController({ documentRef: missingDocument });
missingController.mount();
const missing = keyEvent();
assert.equal(missingDocument.dispatch(missing), false);
assert.equal(missing.preventDefaultCalls, 0);

let composerFocused = 0;
const composer = {
  disabled: false,
  value: 'taslak',
  focus() { composerFocused += 1; },
  setSelectionRange(start, end) {
    assert.equal(start, 6);
    assert.equal(end, 6);
  }
};
const coexistDocument = createDocument({ searchInput, composer });
const coexistController = shortcuts.createController({ documentRef: coexistDocument });
coexistController.mount();
assert.equal(coexistDocument.dispatch(keyEvent({ key: 'k', shiftKey: false })), true);
assert.equal(composerFocused, 1);
assert.equal(focused, 1);
assert.equal(coexistDocument.dispatch(keyEvent()), true);
assert.equal(focused, 2);

controller.destroy();
assert.equal(documentRef.listeners.has('keydown'), false);

console.log('conversation search shortcut tests passed');
