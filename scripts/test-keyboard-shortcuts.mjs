import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const api = require('../public/keyboard-shortcuts.js');

class FakeClassList {
  constructor(node) { this.node = node; }
  contains(name) { return this.node.className.split(/\s+/).includes(name); }
}

class FakeNode {
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
    this.className = '';
    this.disabled = false;
    this.value = '';
    this.isContentEditable = false;
    this.focusCount = 0;
    this.clickCount = 0;
    this.selection = null;
    this.classList = new FakeClassList(this);
  }
  focus() { this.focusCount += 1; }
  click() { this.clickCount += 1; }
  setSelectionRange(start, end) { this.selection = [start, end]; }
  closest(selector) { return selector === '[contenteditable="true"]' && this.parentEditable ? {} : null; }
}

class FakeDocument {
  constructor() {
    this.listeners = new Map();
    this.input = new FakeNode('textarea');
    this.input.value = 'taslak';
    this.send = new FakeNode('button');
  }
  querySelector(selector) {
    if (selector === '#messageInput') return this.input;
    if (selector === '#sendBtn') return this.send;
    return null;
  }
  addEventListener(name, handler) { this.listeners.set(name, handler); }
  removeEventListener(name, handler) {
    if (this.listeners.get(name) === handler) this.listeners.delete(name);
  }
}

function keyEvent(key, overrides = {}) {
  return {
    key,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    repeat: false,
    defaultPrevented: false,
    target: new FakeNode('div'),
    prevented: 0,
    stopped: 0,
    preventDefault() { this.prevented += 1; },
    stopPropagation() { this.stopped += 1; },
    ...overrides
  };
}

assert.deepEqual(api.SHORTCUTS, {
  focusComposer: 'mod+k',
  focusComposerSlash: '/',
  focusConversationSearch: 'mod+shift+f',
  stopResponse: 'escape'
});
assert.equal(api.isEditableTarget(new FakeNode('input')), true);
assert.equal(api.isEditableTarget(new FakeNode('textarea')), true);
assert.equal(api.isEditableTarget(new FakeNode('select')), true);
const editable = new FakeNode('div');
editable.isContentEditable = true;
assert.equal(api.isEditableTarget(editable), true);
const nestedEditable = new FakeNode('span');
nestedEditable.parentEditable = true;
assert.equal(api.isEditableTarget(nestedEditable), true);
assert.equal(api.isEditableTarget(new FakeNode('button')), false);
assert.equal(api.isEditableTarget(null), false);

assert.equal(api.isPlainSlash(keyEvent('/')), true);
assert.equal(api.isPlainSlash(keyEvent('/', { shiftKey: true })), false);
assert.equal(api.isPlainSlash(keyEvent('/', { ctrlKey: true })), false);
assert.equal(api.isModK(keyEvent('k', { ctrlKey: true })), true);
assert.equal(api.isModK(keyEvent('K', { metaKey: true })), true);
assert.equal(api.isModK(keyEvent('k', { ctrlKey: true, shiftKey: true })), false);
assert.equal(api.isEscape(keyEvent('Escape')), true);
assert.equal(api.isEscape(keyEvent('Escape', { altKey: true })), false);

const documentRef = new FakeDocument();
const controller = api.createController({ documentRef });
assert.equal(controller.mount(), true);
assert.equal(controller.mount(), true, 'mount must be idempotent');
assert.equal(documentRef.listeners.size, 1);
assert.equal(typeof documentRef.listeners.get('keydown'), 'function');

const modK = keyEvent('k', { ctrlKey: true });
assert.equal(controller.handleKeydown(modK), true);
assert.equal(modK.prevented, 1);
assert.equal(documentRef.input.focusCount, 1);
assert.deepEqual(documentRef.input.selection, [6, 6], 'focus shortcut should place caret at draft end');

const cmdK = keyEvent('K', { metaKey: true });
assert.equal(controller.handleKeydown(cmdK), true);
assert.equal(cmdK.prevented, 1);
assert.equal(documentRef.input.focusCount, 2);

const plainSlash = keyEvent('/');
assert.equal(controller.handleKeydown(plainSlash), true);
assert.equal(plainSlash.prevented, 1);
assert.equal(documentRef.input.focusCount, 3);

const slashInsideTextarea = keyEvent('/', { target: documentRef.input });
assert.equal(controller.handleKeydown(slashInsideTextarea), false);
assert.equal(slashInsideTextarea.prevented, 0, 'typing slash in composer must remain normal text input');
assert.equal(documentRef.input.focusCount, 3);

const slashInsideContentEditable = keyEvent('/', { target: editable });
assert.equal(controller.handleKeydown(slashInsideContentEditable), false);
assert.equal(slashInsideContentEditable.prevented, 0);

const repeated = keyEvent('k', { ctrlKey: true, repeat: true });
assert.equal(controller.handleKeydown(repeated), false);
assert.equal(repeated.prevented, 0, 'key repeat must not re-trigger actions');

const alreadyHandled = keyEvent('k', { ctrlKey: true, defaultPrevented: true });
assert.equal(controller.handleKeydown(alreadyHandled), false);
assert.equal(alreadyHandled.prevented, 0, 'another handler keeps priority after preventDefault');

const idleEscape = keyEvent('Escape');
assert.equal(controller.handleKeydown(idleEscape), false);
assert.equal(documentRef.send.clickCount, 0);
assert.equal(idleEscape.prevented, 0, 'Escape must remain untouched when no generation is active');

documentRef.send.className = 'send-btn streaming';
const activeEscape = keyEvent('Escape');
assert.equal(controller.handleKeydown(activeEscape), true);
assert.equal(activeEscape.prevented, 1);
assert.equal(activeEscape.stopped, 1);
assert.equal(documentRef.send.clickCount, 1, 'stop shortcut must reuse the visible stop button click path');

const activeEscapeFromTextarea = keyEvent('Escape', { target: documentRef.input });
assert.equal(controller.handleKeydown(activeEscapeFromTextarea), true,
  'Escape should still stop an active response while focus is in composer');
assert.equal(documentRef.send.clickCount, 2);

const unrelated = keyEvent('x');
assert.equal(controller.handleKeydown(unrelated), false);
assert.equal(unrelated.prevented, 0);

documentRef.input.disabled = true;
const disabledFocus = keyEvent('k', { ctrlKey: true });
assert.equal(controller.handleKeydown(disabledFocus), false);
assert.equal(disabledFocus.prevented, 0);
documentRef.input.disabled = false;

controller.destroy();
assert.equal(documentRef.listeners.has('keydown'), false);
controller.destroy();

assert.throws(() => api.createController({ documentRef: null }), /INVALID_KEYBOARD_SHORTCUT_DOCUMENT/);

const sourcePaths = [
  '../public/keyboard-shortcuts.js',
  '../public/chat-run-controller.js',
  '../public/sw-policy.js'
].map((relative) => fileURLToPath(new URL(relative, import.meta.url)));
const [shortcutSource, loaderSource, swSource] = await Promise.all(sourcePaths.map((path) => readFile(path, 'utf8')));

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
