import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const source = fs.readFileSync(new URL('../public/draft-navigation-guard.js', import.meta.url), 'utf8');
const module = { exports: {} };
vm.runInNewContext(source, { module, exports: module.exports, globalThis: {} });
const api = module.exports;
const swPolicy = require('../public/sw-policy.js');
const plain = (value) => JSON.parse(JSON.stringify(value));

assert.equal(api.MAX_DRAFT_CHARS, 12000);
assert.equal(api.hasMeaningfulDraft(''), false);
assert.equal(api.hasMeaningfulDraft('   \n'), false);
assert.equal(api.hasMeaningfulDraft('merhaba'), true);
assert.equal(api.hasMeaningfulDraft('x'.repeat(12000)), true);
assert.equal(api.hasMeaningfulDraft('x'.repeat(12001)), false);

function targetFor(selector, active = false) {
  const row = { classList: { contains: (name) => active && name === 'active' } };
  const matched = {
    '#newChatBtn': selector === '#newChatBtn' ? {} : null,
    '#clearHistoryBtn': selector === '#clearHistoryBtn' ? {} : null,
    '.conversation-open': selector === '.conversation-open' ? {} : null,
    '.conversation-delete': selector === '.conversation-delete' ? { closest: () => row } : null
  };
  return { closest: (query) => matched[query] || null };
}

assert.equal(api.isConversationNavigationTarget(targetFor('#newChatBtn')), true);
assert.equal(api.isConversationNavigationTarget(targetFor('#clearHistoryBtn')), true);
assert.equal(api.isConversationNavigationTarget(targetFor('.conversation-open')), true);
assert.equal(api.isConversationNavigationTarget(targetFor('.conversation-delete', true)), true);
assert.equal(api.isConversationNavigationTarget(targetFor('.conversation-delete', false)), false);
assert.equal(api.isConversationNavigationTarget(targetFor('.other')), false);

class FakeTarget {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, handler) {
    const list = this.listeners.get(type) || [];
    list.push(handler);
    this.listeners.set(type, list);
  }
  removeEventListener(type, handler) {
    this.listeners.set(type, (this.listeners.get(type) || []).filter((item) => item !== handler));
  }
  listenerCount(type) { return (this.listeners.get(type) || []).length; }
  emit(type, event = {}) {
    for (const handler of [...(this.listeners.get(type) || [])]) handler(event);
  }
}

class FakeStatus {
  constructor({ hidden = true, textContent = '' } = {}) {
    this.id = '';
    this.className = '';
    this.hidden = hidden;
    this.textContent = textContent;
    this.attributes = new Map();
    this.removeCalls = 0;
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  remove() { this.removeCalls += 1; }
}

class FakeInput extends FakeTarget {
  constructor(value = '') {
    super();
    this.value = value;
    this.focusCalls = 0;
  }
  focus() { this.focusCalls += 1; }
}

function makeHarness({ value = 'taslak', preexistingStatus = false } = {}) {
  let input = new FakeInput(value);
  let status = preexistingStatus ? new FakeStatus({ hidden: false, textContent: 'Host status' }) : null;
  const composer = {
    appended: [],
    append(node) {
      this.appended.push(node);
      status = node;
    }
  };
  const documentRef = new FakeTarget();
  documentRef.querySelector = (selector) => {
    if (selector === '#messageInput') return input;
    if (selector === '#composer') return composer;
    if (selector === `#${api.STATUS_ID}`) return status && status.removeCalls === 0 ? status : null;
    return null;
  };
  documentRef.createElement = () => new FakeStatus();

  return {
    documentRef,
    composer,
    get input() { return input; },
    get status() { return status; },
    replaceInput(nextValue = '') {
      const previous = input;
      input = new FakeInput(nextValue);
      return { previous, current: input };
    }
  };
}

function clickEvent(selector = '.conversation-open') {
  return {
    target: targetFor(selector),
    defaultPrevented: false,
    prevented: false,
    stopped: false,
    preventDefault() { this.prevented = true; },
    stopImmediatePropagation() { this.stopped = true; }
  };
}

{
  const h = makeHarness({ value: 'gönderilmemiş taslak' });
  const controller = api.createController({ documentRef: h.documentRef });
  assert.equal(controller.mount(), true);
  assert.equal(controller.mount(), false, 'double mount must not duplicate listeners');
  assert.deepEqual(plain(controller.snapshot()), { mounted: true, statusOwned: true, hasMountedInput: true });
  assert.equal(h.documentRef.listenerCount('click'), 1);
  assert.equal(h.input.listenerCount('input'), 1);
  assert.equal(h.status.hidden, true);

  const event = clickEvent();
  h.documentRef.emit('click', event);
  assert.equal(event.prevented, true);
  assert.equal(event.stopped, true);
  assert.equal(h.input.focusCalls, 1);
  assert.equal(h.status.hidden, false);
  assert.match(h.status.textContent, /Gönderilmemiş taslak/);

  h.input.value = '';
  h.input.emit('input');
  assert.equal(h.status.hidden, true);

  h.input.value = 'yeniden taslak';
  const { previous, current } = h.replaceInput('yeni DOM input');
  assert.equal(previous.listenerCount('input'), 1, 'mounted listener remains on original node until teardown');
  assert.equal(current.listenerCount('input'), 0);

  const ownedStatus = h.status;
  assert.equal(controller.destroy(), true);
  assert.equal(controller.snapshot().mounted, false);
  assert.equal(controller.snapshot().hasMountedInput, false);
  assert.equal(h.documentRef.listenerCount('click'), 0);
  assert.equal(previous.listenerCount('input'), 0, 'destroy must detach exact mount-time input even after DOM replacement');
  assert.equal(current.listenerCount('input'), 0);
  assert.equal(ownedStatus.removeCalls, 1, 'controller-owned status is removed on teardown');
  assert.equal(controller.destroy(), false, 'double destroy is a no-op');

  const afterDestroy = clickEvent();
  assert.equal(controller.onCaptureClick(afterDestroy), false);
  assert.equal(afterDestroy.prevented, false, 'public handler must be inert after destroy');
  assert.equal(afterDestroy.stopped, false);

  assert.equal(controller.mount(), true, 'clean remount uses the current input node');
  assert.equal(current.listenerCount('input'), 1);
  assert.equal(h.documentRef.listenerCount('click'), 1);
  assert.notEqual(h.status, ownedStatus, 'removed controller-owned status is recreated on remount');
  assert.equal(controller.destroy(), true);
  assert.equal(current.listenerCount('input'), 0);
}

{
  const h = makeHarness({ value: 'host taslağı', preexistingStatus: true });
  const hostStatus = h.status;
  const controller = api.createController({ documentRef: h.documentRef });
  assert.equal(controller.mount(), true);
  assert.deepEqual(plain(controller.snapshot()), { mounted: true, statusOwned: false, hasMountedInput: true });

  const event = clickEvent('#newChatBtn');
  h.documentRef.emit('click', event);
  assert.equal(event.prevented, true);
  assert.equal(hostStatus.textContent, api.BLOCKED_LABEL);
  assert.equal(hostStatus.hidden, false);

  assert.equal(controller.destroy(), true);
  assert.equal(hostStatus.removeCalls, 0, 'host-owned status must survive controller teardown');
  assert.equal(hostStatus.hidden, false, 'host-owned hidden state must be restored');
  assert.equal(hostStatus.textContent, 'Host status', 'host-owned text must be restored exactly');
}

{
  const h = makeHarness({ value: '', preexistingStatus: true });
  const controller = api.createController({ documentRef: h.documentRef });
  assert.equal(controller.mount(), true);
  const event = clickEvent('#newChatBtn');
  h.documentRef.emit('click', event);
  assert.equal(event.prevented, false);
  assert.equal(event.stopped, false);
  assert.equal(h.status.textContent, '');
  assert.equal(h.status.hidden, true);
  assert.equal(controller.destroy(), true);
  assert.equal(h.status.textContent, 'Host status', 'teardown restores host status after temporary clear');
  assert.equal(h.status.hidden, false);
}

assert.doesNotMatch(source, /fetch\s*\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|document\.cookie|navigator\.clipboard|requestSubmit\s*\(/);
assert.match(source, /addEventListener\('click', onCaptureClick, true\)/);
assert.match(source, /removeEventListener\?\.\('click', onCaptureClick, true\)/);
assert.match(source, /mountedInput\?\.removeEventListener\?\.\('input', onInput\)/);
assert.match(source, /statusOwned/);
assert.match(source, /stopImmediatePropagation/);

const loader = fs.readFileSync(new URL('../public/chat-run-controller.js', import.meta.url), 'utf8');
const sw = fs.readFileSync(new URL('../public/sw-policy.js', import.meta.url), 'utf8');
assert.match(loader, /HafizeDraftNavigationGuard/);
assert.match(loader, /\/draft-navigation-guard\.js/);
assert.match(sw, /\/draft-navigation-guard\.js/);
assert.match(swPolicy.CURRENT_CACHE, /^hafize-shell-v\d+$/);
assert.equal(swPolicy.classifyRequest({
  method: 'GET', url: 'https://hafize.example/api/chat', headers: {}, mode: 'cors'
}, 'https://hafize.example'), 'network-only');

console.log('draft navigation guard tests passed');