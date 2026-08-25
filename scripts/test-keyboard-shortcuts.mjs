import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { SHORTCUTS, createKeyboardShortcutController } = require('../public/keyboard-shortcuts.js');
const shortcutPath = fileURLToPath(new URL('../public/keyboard-shortcuts.js', import.meta.url));
const loaderPath = fileURLToPath(new URL('../public/app.js', import.meta.url));
const swPath = fileURLToPath(new URL('../public/sw-policy.js', import.meta.url));
const [shortcutSource, loaderSource, swSource] = await Promise.all([
  readFile(shortcutPath, 'utf8'),
  readFile(loaderPath, 'utf8'),
  readFile(swPath, 'utf8')
]);

assert.deepEqual(SHORTCUTS, {
  newConversation: 'mod+shift+o',
  focusComposer: 'mod+k',
  focusConversationSearch: 'mod+shift+f',
  stopGeneration: 'escape'
});
assert.equal(Object.isFrozen(SHORTCUTS), true);

function createClassList(initial = []) {
  const values = new Set(initial);
  return {
    contains: (value) => values.has(value),
    add: (value) => values.add(value),
    delete: (value) => values.delete(value)
  };
}

function createDocument() {
  const listeners = new Map();
  const input = {
    disabled: false,
    focusCalls: 0,
    focus() { this.focusCalls += 1; }
  };
  const sendButton = {
    disabled: false,
    classList: createClassList(),
    clickCalls: 0,
    click() { this.clickCalls += 1; }
  };
  const newConversation = {
    disabled: false,
    clickCalls: 0,
    click() { this.clickCalls += 1; }
  };
  const search = {
    disabled: false,
    clickCalls: 0,
    click() { this.clickCalls += 1; }
  };
  const nodes = {
    '#messageInput': input,
    '#sendButton': sendButton,
    '#newConversationBtn': newConversation,
    '#conversationSearch': search
  };
  const documentRef = {
    activeElement: null,
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
    removeEventListener(type, handler) {
      if (listeners.get(type) === handler) listeners.delete(type);
    },
    querySelector(selector) {
      return nodes[selector] || null;
    }
  };
  return { documentRef, listeners, input, sendButton, newConversation, search };
}

function keyEvent(overrides = {}) {
  return {
    key: '',
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    defaultPrevented: false,
    prevented: false,
    target: { tagName: 'BODY', isContentEditable: false },
    preventDefault() {
      this.defaultPrevented = true;
      this.prevented = true;
    },
    ...overrides
  };
}

{
  const host = createDocument();
  const controller = createKeyboardShortcutController({ documentRef: host.documentRef });
  assert.equal(controller.install(), true);
  assert.equal(controller.install(), false, 'install must be idempotent');
  const handler = host.listeners.get('keydown');
  assert.equal(typeof handler, 'function');

  const focus = keyEvent({ key: 'k', ctrlKey: true });
  handler(focus);
  assert.equal(focus.prevented, true);
  assert.equal(host.input.focusCalls, 1);

  const macFocus = keyEvent({ key: 'K', metaKey: true });
  handler(macFocus);
  assert.equal(macFocus.prevented, true);
  assert.equal(host.input.focusCalls, 2);

  const newConversation = keyEvent({ key: 'O', ctrlKey: true, shiftKey: true });
  handler(newConversation);
  assert.equal(newConversation.prevented, true);
  assert.equal(host.newConversation.clickCalls, 1);

  const search = keyEvent({ key: 'F', ctrlKey: true, shiftKey: true });
  handler(search);
  assert.equal(search.prevented, true);
  assert.equal(host.search.clickCalls, 1);

  const idleEscape = keyEvent({ key: 'Escape' });
  handler(idleEscape);
  assert.equal(idleEscape.prevented, false);
  assert.equal(host.sendButton.clickCalls, 0);

  host.sendButton.classList.add('streaming');
  const streamingEscape = keyEvent({ key: 'Escape' });
  handler(streamingEscape);
  assert.equal(streamingEscape.prevented, true);
  assert.equal(host.sendButton.clickCalls, 1);

  const repeatEscape = keyEvent({ key: 'Escape', repeat: true });
  handler(repeatEscape);
  assert.equal(repeatEscape.prevented, false);
  assert.equal(host.sendButton.clickCalls, 1);

  controller.destroy();
  assert.equal(host.listeners.has('keydown'), false);
}

for (const event of [
  keyEvent({ key: 'k', ctrlKey: true, shiftKey: true }),
  keyEvent({ key: 'k', ctrlKey: true, altKey: true }),
  keyEvent({ key: 'o', ctrlKey: true }),
  keyEvent({ key: 'f', ctrlKey: true, shiftKey: false }),
  keyEvent({ key: 'x', ctrlKey: true }),
  keyEvent({ key: 'Escape', altKey: true }),
  keyEvent({ key: 'Escape', ctrlKey: true })
]) {
  const host = createDocument();
  host.sendButton.classList.add('streaming');
  const controller = createKeyboardShortcutController({ documentRef: host.documentRef });
  controller.install();
  host.listeners.get('keydown')(event);
  assert.equal(event.prevented, false, `unregistered shortcut must not be consumed: ${event.key}`);
  assert.equal(host.input.focusCalls, 0);
  assert.equal(host.newConversation.clickCalls, 0);
  assert.equal(host.search.clickCalls, 0);
  assert.equal(host.sendButton.clickCalls, 0);
}

{
  const host = createDocument();
  host.documentRef.activeElement = host.input;
  const controller = createKeyboardShortcutController({ documentRef: host.documentRef });
  controller.install();
  const event = keyEvent({ key: 'o', ctrlKey: true, shiftKey: true, target: { tagName: 'TEXTAREA', isContentEditable: false } });
  host.listeners.get('keydown')(event);
  assert.equal(event.prevented, false, 'new-conversation shortcut must not hijack editable input');
  assert.equal(host.newConversation.clickCalls, 0);
}

{
  const host = createDocument();
  const controller = createKeyboardShortcutController({ documentRef: host.documentRef });
  controller.install();
  host.newConversation.disabled = true;
  const event = keyEvent({ key: 'o', metaKey: true, shiftKey: true });
  host.listeners.get('keydown')(event);
  assert.equal(event.prevented, false, 'disabled action must remain fail-closed');
  assert.equal(host.newConversation.clickCalls, 0);
}

for (const forbidden of [
  'fetch(', 'XMLHttpRequest', 'WebSocket', 'localStorage', 'sessionStorage',
  'Authorization', 'Bearer ', 'clipboard', 'innerHTML', 'eval(', 'Function('
]) {
  assert.equal(shortcutSource.includes(forbidden), false, `shortcut source must not contain ${forbidden}`);
}
assert.equal(shortcutSource.includes("documentRef.addEventListener('keydown'"), true);
assert.equal(shortcutSource.includes("classList?.contains?.('streaming')"), true,
  'Escape must only act when visible send control is in streaming state');
assert.equal(shortcutSource.includes('sendButton.click()'), true,
  'stop shortcut must reuse canonical visible stop control instead of aborting through a parallel runtime');
assert.equal(shortcutSource.includes("documentRef.querySelector('#messageInput')"), true);
assert.equal(loaderSource.includes("'/keyboard-shortcuts.js'"), true);
assert.equal(loaderSource.includes('data-hafize-keyboard-shortcuts'), true);
assert.equal(loaderSource.includes("'/message-copy.js'"), true, 'existing message actions loader must remain present');
assert.match(swSource, /const CURRENT_CACHE = `\$\{CACHE_PREFIX\}v\d+`;/);
assert.equal(swSource.includes("'/keyboard-shortcuts.js'"), true);
assert.equal(swSource.includes("pathname.startsWith('/api/')"), true, 'API requests must remain network-only');

console.log('keyboard shortcut safety tests passed');
