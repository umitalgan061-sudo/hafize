import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../public/conversation-copy.js');

function article(role, text, extras = {}) {
  return {
    classList: { contains: (name) => name === 'message' || name === role },
    querySelector(selector) {
      if (selector === '.content') return { textContent: text };
      return extras[selector] || null;
    }
  };
}

function createButton(seed = {}) {
  const listeners = new Map();
  return {
    dataset: { ...(seed.dataset || {}) },
    hidden: Boolean(seed.hidden),
    disabled: Boolean(seed.disabled),
    textContent: seed.textContent ?? '',
    removed: false,
    attributes: new Map(),
    setAttribute(name, value) { this.attributes.set(name, String(value)); },
    addEventListener(type, fn) { listeners.set(type, fn); },
    removeEventListener(type, fn) { if (listeners.get(type) === fn) listeners.delete(type); },
    remove() { this.removed = true; },
    emit(type) { return listeners.get(type)?.(); },
    listener(type) { return listeners.get(type) || null; },
    listenerCount() { return listeners.size; }
  };
}

function createHarness({
  existingButton = null,
  messagesList = [article('user', 'Soru'), article('assistant', 'Cevap')],
  observerFactory = null,
  clipboardWrite = async () => {},
  secureContext = true
} = {}) {
  const writes = [];
  const timers = new Map();
  const clearedTimers = [];
  let timerId = 0;
  let createdButton = null;
  let activeMessages = messagesList;
  const messages = {
    querySelectorAll: () => activeMessages
  };
  const host = {
    child: null,
    append(node) {
      this.child = node;
    }
  };
  const documentRef = {
    querySelector(selector) {
      if (selector === '#messages') return messages;
      if (selector === '.history-head') return host;
      if (selector === `#${api.CONTROL_ID}`) return existingButton;
      return null;
    },
    createElement(tag) {
      assert.equal(tag, 'button');
      createdButton = createButton();
      return createdButton;
    }
  };
  const observers = [];
  const MutationObserverImpl = observerFactory === null ? null : class {
    constructor(callback) {
      this.callback = callback;
      this.disconnected = false;
      observers.push(this);
      if (observerFactory === 'throw-constructor') throw new Error('observer constructor failure');
    }
    observe(target, options) {
      this.target = target;
      this.options = options;
      if (observerFactory === 'throw-observe') throw new Error('observer observe failure');
    }
    disconnect() { this.disconnected = true; }
    fire() { this.callback(); }
  };
  const controller = api.createController({
    documentRef,
    clipboard: {
      async writeText(value) {
        writes.push(value);
        return clipboardWrite(value);
      }
    },
    secureContext,
    MutationObserverImpl,
    setTimeoutImpl(fn) {
      timerId += 1;
      timers.set(timerId, fn);
      return timerId;
    },
    clearTimeoutImpl(id) {
      clearedTimers.push(id);
      timers.delete(id);
    }
  });
  return {
    controller,
    host,
    messages,
    writes,
    timers,
    clearedTimers,
    observers,
    button: () => existingButton || createdButton,
    setMessages(value) { activeMessages = value; },
    runTimer(id) { timers.get(id)?.(); }
  };
}

assert.equal(api.normalizeMessageText(''), null);
assert.equal(api.normalizeMessageText('   '), null);
assert.equal(api.normalizeMessageText('a\r\nb'), 'a\nb');
assert.equal(api.transcriptFromMessages([]), null);
assert.equal(
  api.transcriptFromMessages([article('user', 'Merhaba'), article('assistant', 'Selam')]),
  'Sen:\nMerhaba\n\nHafize:\nSelam'
);
assert.equal(
  api.transcriptFromMessages([article('assistant', 'Yanıt', { '.tool-activities': { textContent: 'secret tool trace' } })]),
  'Hafize:\nYanıt'
);
assert.equal(api.transcriptFromMessages([article('user', 'x'.repeat(api.MAX_COPY_CHARS))]), null);

{
  const harness = createHarness();
  assert.equal(harness.controller.mount(), true);
  const button = harness.button();
  assert.equal(button.hidden, false);
  assert.equal(button.dataset.state, 'idle');
  assert.equal(button.listenerCount(), 1);
  assert.equal(await harness.controller.copyConversation(), true);
  assert.deepEqual(harness.writes, ['Sen:\nSoru\n\nHafize:\nCevap']);
  assert.equal(button.dataset.state, 'success');
  harness.controller.destroy();
  assert.equal(button.removed, true);
  assert.equal(button.listenerCount(), 0);
  assert.equal(harness.controller.getTranscript(), null);
  assert.equal(harness.controller.syncAvailability(), false);
  assert.equal(await harness.controller.copyConversation(), false);
  harness.controller.destroy();
}

{
  const hostButton = createButton({
    hidden: true,
    disabled: true,
    textContent: 'Host copy',
    dataset: { state: 'host-state', owner: 'shell' }
  });
  const harness = createHarness({ existingButton: hostButton });
  assert.equal(harness.controller.mount(), true);
  assert.equal(hostButton.hidden, false);
  assert.equal(hostButton.listenerCount(), 1);
  await hostButton.emit('click');
  assert.equal(harness.writes.length, 1);
  harness.controller.destroy();
  assert.equal(hostButton.removed, false);
  assert.equal(hostButton.listenerCount(), 0);
  assert.equal(hostButton.hidden, true);
  assert.equal(hostButton.disabled, true);
  assert.equal(hostButton.textContent, 'Host copy');
  assert.equal(hostButton.dataset.state, 'host-state');
  assert.equal(hostButton.dataset.owner, 'shell');
}

{
  const hostButton = createButton({ textContent: 'No state' });
  const harness = createHarness({ existingButton: hostButton });
  assert.equal(Object.hasOwn(hostButton.dataset, 'state'), false);
  assert.equal(harness.controller.mount(), true);
  assert.equal(Object.hasOwn(hostButton.dataset, 'state'), false);
  harness.controller.destroy();
  assert.equal(Object.hasOwn(hostButton.dataset, 'state'), false);
  assert.equal(hostButton.textContent, 'No state');
}

{
  const harness = createHarness({ secureContext: false });
  assert.equal(harness.controller.mount(), true);
  assert.equal(await harness.controller.copyConversation(), false);
  assert.equal(harness.writes.length, 0);
  assert.equal(harness.button().dataset.state, 'error');
  harness.controller.destroy();
}

{
  let resolveWrite;
  const writeGate = new Promise((resolve) => { resolveWrite = resolve; });
  const harness = createHarness({ clipboardWrite: () => writeGate });
  assert.equal(harness.controller.mount(), true);
  const firstButton = harness.button();
  const pending = harness.controller.copyConversation();
  assert.equal(firstButton.dataset.state, 'copying');
  harness.controller.destroy();
  assert.equal(harness.controller.mount(), true);
  const secondButton = harness.button();
  assert.notEqual(secondButton, firstButton);
  assert.equal(secondButton.dataset.state, 'idle');
  resolveWrite();
  assert.equal(await pending, true);
  assert.equal(secondButton.dataset.state, 'idle');
  assert.equal(secondButton.textContent, 'Sohbeti kopyala');
  harness.controller.destroy();
}

{
  const harness = createHarness();
  assert.equal(harness.controller.mount(), true);
  assert.equal(await harness.controller.copyConversation(), true);
  const timerId = [...harness.timers.keys()][0];
  const staleTimer = harness.timers.get(timerId);
  harness.controller.destroy();
  assert.ok(harness.clearedTimers.includes(timerId));
  assert.equal(harness.controller.mount(), true);
  const remountedButton = harness.button();
  remountedButton.textContent = 'Current generation';
  staleTimer();
  assert.equal(remountedButton.textContent, 'Current generation');
  harness.controller.destroy();
}

{
  const harness = createHarness({ observerFactory: 'ok' });
  assert.equal(harness.controller.mount(), true);
  assert.equal(harness.controller.mount(), true);
  assert.equal(harness.observers.length, 1);
  const button = harness.button();
  assert.equal(button.listenerCount(), 1);
  harness.setMessages([]);
  harness.observers[0].fire();
  assert.equal(button.hidden, true);
  harness.controller.destroy();
  assert.equal(harness.observers[0].disconnected, true);
}

{
  const hostButton = createButton({
    hidden: true,
    disabled: true,
    textContent: 'Host preserved',
    dataset: { state: 'external' }
  });
  const harness = createHarness({ existingButton: hostButton, observerFactory: 'throw-observe' });
  assert.equal(harness.controller.mount(), false);
  assert.equal(hostButton.removed, false);
  assert.equal(hostButton.listenerCount(), 0);
  assert.equal(hostButton.hidden, true);
  assert.equal(hostButton.disabled, true);
  assert.equal(hostButton.textContent, 'Host preserved');
  assert.equal(hostButton.dataset.state, 'external');
  assert.equal(harness.observers[0].disconnected, true);
  assert.equal(harness.controller.syncAvailability(), false);
}

{
  const malformedButton = { dataset: {}, hidden: false, disabled: false, textContent: '' };
  const harness = createHarness({ existingButton: malformedButton });
  assert.equal(harness.controller.mount(), false);
  assert.equal(harness.host.child, null);
}

const source = fs.readFileSync(path.resolve('public/conversation-copy.js'), 'utf8');
for (const forbidden of ['fetch(', 'XMLHttpRequest', 'WebSocket', 'localStorage', 'sessionStorage', 'document.cookie', '.tool-activities', 'trace_id']) {
  assert.equal(source.includes(forbidden), false, `forbidden source token: ${forbidden}`);
}
assert.match(source, /clipboard\.writeText\(transcript\)/);
assert.match(source, /secureContext/);
assert.match(source, /removeEventListener\?\.\('click', clickHandler\)/);
assert.match(source, /restoreButton\(button, buttonSnapshot\)/);
assert.match(source, /isCurrent\(expectedGeneration\)/);
assert.match(source, /\.content/);

const loader = fs.readFileSync(path.resolve('public/chat-run-controller.js'), 'utf8');
assert.match(loader, /HafizeConversationCopy/);
assert.match(loader, /\/conversation-copy\.js/);
const sw = fs.readFileSync(path.resolve('public/sw-policy.js'), 'utf8');
assert.match(sw, /CURRENT_CACHE = `\$\{CACHE_PREFIX\}v\d+`/);
assert.match(sw, /'\/conversation-copy\.js'/);
assert.match(sw, /pathname\.startsWith\('\/api\/'\).*network-only/s);

console.log('conversation copy tests passed');