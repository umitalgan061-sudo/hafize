import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../public/conversation-delete-confirm.js');

function createButton({ id = 'clearHistoryBtn', text = 'Temizle' } = {}) {
  const attrs = new Map();
  const listeners = [];
  return {
    id,
    textContent: text,
    clickCount: 0,
    focused: false,
    getAttribute(name) { return attrs.has(name) ? attrs.get(name) : null; },
    setAttribute(name, value) { attrs.set(name, String(value)); },
    removeAttribute(name) { attrs.delete(name); },
    focus() { this.focused = true; },
    closest(selector) {
      if (selector === '#clearHistoryBtn' && id === 'clearHistoryBtn') return this;
      return null;
    },
    click() {
      this.clickCount += 1;
      for (const listener of listeners) listener();
    },
    onSyntheticClick(listener) { listeners.push(listener); },
    snapshotAttrs() { return Object.fromEntries(attrs); }
  };
}

function createDocument(button) {
  const handlers = new Map();
  return {
    visibilityState: 'visible',
    addEventListener(type, handler, capture) { handlers.set(`${type}:${Boolean(capture)}`, handler); },
    removeEventListener(type, handler, capture) {
      const key = `${type}:${Boolean(capture)}`;
      if (handlers.get(key) === handler) handlers.delete(key);
    },
    querySelector(selector) {
      if (selector === '#messageInput') return { value: '' };
      if (selector === '#clearHistoryBtn') return button;
      return null;
    },
    handler(type, capture = false) { return handlers.get(`${type}:${Boolean(capture)}`); }
  };
}

function clickEvent(target) {
  return {
    target,
    defaultPrevented: false,
    propagationStopped: false,
    preventDefault() { this.defaultPrevented = true; },
    stopImmediatePropagation() { this.propagationStopped = true; }
  };
}

function createTimers() {
  let callback = null;
  let cleared = 0;
  return {
    setTimeoutImpl(next, delay) {
      assert.equal(delay, api.CONFIRM_WINDOW_MS);
      callback = next;
      return { unref() {} };
    },
    clearTimeoutImpl() { cleared += 1; callback = null; },
    fire() { const next = callback; callback = null; next?.(); },
    get cleared() { return cleared; }
  };
}

assert.equal(api.CLEAR_HISTORY_PROMPT, 'Tüm yerel sohbet geçmişi silinsin mi?');
assert.equal(api.CLEAR_PENDING_TEXT, 'Temizle?');
assert.equal(api.CONFIRM_WINDOW_MS, 8_000);

{
  const button = createButton();
  const documentRef = createDocument(button);
  const timers = createTimers();
  const confirmCalls = [];
  const rootRef = {
    confirm(message) { confirmCalls.push(message); return false; }
  };
  const controller = api.createController({ documentRef, rootRef, ...timers });
  assert.equal(controller.mount(), true);

  let appClearCalls = 0;
  button.onSyntheticClick(() => {
    const synthetic = clickEvent(button);
    const captured = controller.onCaptureClick(synthetic);
    if (captured) {
      const approved = rootRef.confirm(api.CLEAR_HISTORY_PROMPT);
      if (approved) appClearCalls += 1;
    }
  });

  const first = clickEvent(button);
  assert.equal(controller.onCaptureClick(first), false);
  assert.equal(first.defaultPrevented, true);
  assert.equal(first.propagationStopped, true);
  assert.equal(appClearCalls, 0, 'first action must not clear history');
  assert.equal(button.textContent, 'Temizle?');
  assert.equal(button.getAttribute('data-clear-history-pending'), 'true');
  assert.equal(button.getAttribute('aria-pressed'), 'true');
  assert.equal(controller.snapshot().pendingKind, 'clear-history');

  const second = clickEvent(button);
  assert.equal(controller.onCaptureClick(second), true);
  assert.equal(second.defaultPrevented, true);
  assert.equal(second.propagationStopped, true);
  assert.equal(button.clickCount, 1, 'second action replays one synchronous app click');
  assert.equal(appClearCalls, 1, 'exact app clear prompt is approved exactly once');
  assert.equal(confirmCalls.length, 0, 'exact clear prompt must not reach native confirm');
  assert.equal(button.textContent, 'Temizle');
  assert.equal(button.getAttribute('data-clear-history-pending'), null);
  assert.equal(button.getAttribute('aria-pressed'), 'false');
  assert.equal(controller.snapshot().pending, false);

  assert.equal(rootRef.confirm('Başka bir işlem?'), false);
  assert.deepEqual(confirmCalls, ['Başka bir işlem?'], 'unrelated confirms keep native behavior');
  controller.destroy();
}

{
  const button = createButton();
  const documentRef = createDocument(button);
  const timers = createTimers();
  const rootRef = { confirm() { return false; } };
  const controller = api.createController({ documentRef, rootRef, ...timers });
  controller.mount();
  controller.onCaptureClick(clickEvent(button));
  assert.equal(controller.snapshot().pending, true);
  timers.fire();
  assert.equal(controller.snapshot().pending, false);
  assert.equal(button.textContent, 'Temizle');
  assert.equal(button.getAttribute('aria-pressed'), 'false');
}

{
  const button = createButton();
  const documentRef = createDocument(button);
  const timers = createTimers();
  const rootRef = { confirm() { return false; } };
  const controller = api.createController({ documentRef, rootRef, ...timers });
  controller.mount();
  controller.onCaptureClick(clickEvent(button));
  const escape = { key: 'Escape', prevented: false, preventDefault() { this.prevented = true; } };
  assert.equal(controller.onKeydown(escape), true);
  assert.equal(escape.prevented, true);
  assert.equal(controller.snapshot().pending, false);
  assert.equal(button.focused, true);
}

{
  const button = createButton();
  const documentRef = createDocument(button);
  const timers = createTimers();
  const rootRef = { confirm() { return false; } };
  const controller = api.createController({ documentRef, rootRef, ...timers });
  controller.mount();
  controller.onCaptureClick(clickEvent(button));
  documentRef.visibilityState = 'hidden';
  controller.onVisibilityChange();
  assert.equal(controller.snapshot().pending, false);
}

{
  const button = createButton();
  const documentRef = createDocument(button);
  const timers = createTimers();
  const originalConfirm = () => false;
  const rootRef = {};
  Object.defineProperty(rootRef, 'confirm', { value: originalConfirm, writable: false, configurable: false });
  const controller = api.createController({ documentRef, rootRef, ...timers });
  controller.mount();
  controller.onCaptureClick(clickEvent(button));
  const second = clickEvent(button);
  assert.equal(controller.onCaptureClick(second), false, 'host that forbids confirm reassignment must fail closed');
  assert.equal(button.clickCount, 0);
  assert.equal(rootRef.confirm, originalConfirm);
}

console.log('clear history intent lifecycle tests passed');