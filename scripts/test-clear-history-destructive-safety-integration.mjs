import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../public/conversation-delete-confirm.js');

function createFixture() {
  const attrs = new Map();
  const listeners = [];
  const button = {
    id: 'clearHistoryBtn',
    textContent: 'Temizle',
    getAttribute(name) { return attrs.has(name) ? attrs.get(name) : null; },
    setAttribute(name, value) { attrs.set(name, String(value)); },
    removeAttribute(name) { attrs.delete(name); },
    focus() {},
    closest(selector) { return selector === '#clearHistoryBtn' ? this : null; },
    click() { for (const listener of listeners) listener(); },
    addSynthetic(listener) { listeners.push(listener); }
  };
  const documentRef = {
    visibilityState: 'visible',
    addEventListener() {},
    removeEventListener() {},
    querySelector(selector) {
      if (selector === '#messageInput') return { value: '' };
      if (selector === '#clearHistoryBtn') return button;
      return null;
    }
  };
  const timers = {
    setTimeoutImpl() { return { unref() {} }; },
    clearTimeoutImpl() {}
  };
  return { button, documentRef, timers };
}

function eventFor(target) {
  return {
    target,
    defaultPrevented: false,
    stopped: false,
    preventDefault() { this.defaultPrevented = true; },
    stopImmediatePropagation() { this.stopped = true; }
  };
}

{
  const { button, documentRef, timers } = createFixture();
  let conversations = [{ id: 'a' }, { id: 'b' }];
  let saveCalls = 0;
  let renderCalls = 0;
  let nativeConfirmCalls = 0;
  let streaming = false;
  const rootRef = {
    confirm(message) {
      nativeConfirmCalls += 1;
      return message === api.CLEAR_HISTORY_PROMPT;
    }
  };
  const controller = api.createController({ documentRef, rootRef, ...timers });

  function appClearHandler() {
    if (streaming) return;
    if (!conversations.length) return;
    if (!rootRef.confirm(api.CLEAR_HISTORY_PROMPT)) return;
    conversations = [];
    saveCalls += 1;
    renderCalls += 1;
  }

  button.addSynthetic(() => {
    const synthetic = eventFor(button);
    if (controller.onCaptureClick(synthetic)) appClearHandler();
  });

  const first = eventFor(button);
  assert.equal(controller.onCaptureClick(first), false);
  assert.deepEqual(conversations, [{ id: 'a' }, { id: 'b' }]);
  assert.equal(saveCalls, 0);
  assert.equal(renderCalls, 0);
  assert.equal(nativeConfirmCalls, 0);

  const second = eventFor(button);
  assert.equal(controller.onCaptureClick(second), true);
  assert.deepEqual(conversations, []);
  assert.equal(saveCalls, 1);
  assert.equal(renderCalls, 1);
  assert.equal(nativeConfirmCalls, 0, 'exact app confirmation is satisfied only by the synchronous one-shot grant');

  assert.equal(rootRef.confirm('unrelated'), false);
  assert.equal(nativeConfirmCalls, 1, 'native confirm behavior is restored immediately after replay');
}

{
  const { button, documentRef, timers } = createFixture();
  let conversations = [{ id: 'still-here' }];
  let saveCalls = 0;
  let streaming = true;
  const rootRef = { confirm() { throw new Error('native confirm should not be reached'); } };
  const controller = api.createController({ documentRef, rootRef, ...timers });

  function appClearHandler() {
    if (streaming) return;
    if (!rootRef.confirm(api.CLEAR_HISTORY_PROMPT)) return;
    conversations = [];
    saveCalls += 1;
  }

  button.addSynthetic(() => {
    const synthetic = eventFor(button);
    if (controller.onCaptureClick(synthetic)) appClearHandler();
  });

  controller.onCaptureClick(eventFor(button));
  controller.onCaptureClick(eventFor(button));
  assert.deepEqual(conversations, [{ id: 'still-here' }], 'app streaming guard remains authoritative');
  assert.equal(saveCalls, 0);
}

{
  const { button, documentRef, timers } = createFixture();
  let appCalls = 0;
  const rootRef = { confirm() { return false; } };
  const controller = api.createController({ documentRef, rootRef, ...timers });
  button.addSynthetic(() => {
    const synthetic = eventFor(button);
    if (controller.onCaptureClick(synthetic)) appCalls += 1;
  });

  controller.onCaptureClick(eventFor(button));
  const outside = { id: 'elsewhere', closest() { return null; } };
  controller.onCaptureClick(eventFor(outside));
  assert.equal(controller.snapshot().pending, false);
  assert.equal(button.textContent, 'Temizle');
  assert.equal(appCalls, 0);
}

console.log('clear history destructive safety integration tests passed');