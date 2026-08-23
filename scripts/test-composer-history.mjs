import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../public/composer-history.js', import.meta.url), 'utf8');
const module = { exports: {} };
vm.runInNewContext(source, { module, exports: module.exports, globalThis: {}, self: {} });
const api = module.exports;

assert.equal(api.normalizeMessage(null), null);
assert.equal(api.normalizeMessage(''), null);
assert.equal(api.normalizeMessage('   '), null);
assert.equal(api.normalizeMessage('a\r\nb\rc\u0000'), 'a\nb\nc');
assert.equal(api.normalizeMessage('x'.repeat(api.MAX_MESSAGE_CHARS + 1)), null);
assert.equal(api.normalizeMessage('x'.repeat(api.MAX_MESSAGE_CHARS)).length, api.MAX_MESSAGE_CHARS);

function article(text) {
  return { querySelector(selector) { return selector === '.content' ? { textContent: text } : null; } };
}
const root = { querySelectorAll(selector) {
  assert.equal(selector, '.message.user');
  return [article('ilk'), article('ikinci\r\nsatır'), article(''), article('son')];
}};
assert.deepEqual(Array.from(api.collectHistory(root)), ['ilk', 'ikinci\nsatır', 'son']);

const many = Array.from({ length: api.MAX_HISTORY + 7 }, (_, i) => article(`m${i}`));
const bounded = api.collectHistory({ querySelectorAll() { return many; } });
assert.equal(bounded.length, api.MAX_HISTORY);
assert.equal(bounded[0], 'm7');
assert.equal(bounded.at(-1), `m${api.MAX_HISTORY + 6}`);
assert.equal(Object.isFrozen(bounded), true);

assert.equal(api.collapsedSelection({ selectionStart: 0, selectionEnd: 0 }), 0);
assert.equal(api.collapsedSelection({ selectionStart: 1, selectionEnd: 2 }), null);
assert.equal(api.collapsedSelection({ selectionStart: null, selectionEnd: null }), null);

function key(key, extra = {}) {
  return { key, defaultPrevented: false, repeat: false, isComposing: false, ...extra };
}
const inputContract = { value: 'taslak', selectionStart: 0, selectionEnd: 0, disabled: false, readOnly: false };
assert.equal(api.canRecall(key('ArrowUp'), inputContract, -1), true);
assert.equal(api.canRecall(key('ArrowDown'), inputContract, 1), false);
inputContract.selectionStart = inputContract.selectionEnd = inputContract.value.length;
assert.equal(api.canRecall(key('ArrowDown'), inputContract, 1), true);
assert.equal(api.canRecall(key('ArrowUp'), inputContract, -1), false);
for (const variant of [
  { ctrlKey: true }, { metaKey: true }, { altKey: true }, { shiftKey: true },
  { repeat: true }, { isComposing: true }, { defaultPrevented: true }
]) {
  assert.equal(api.canRecall(key('ArrowDown', variant), inputContract, 1), false);
}
assert.equal(api.canRecall(key('Enter'), inputContract, 1), false);
assert.equal(api.canRecall(key('ArrowDown'), inputContract, 0), false);

function element() {
  const listeners = new Map();
  return {
    id: '', className: '', hidden: false, textContent: '', parent: null, attrs: new Map(), children: [],
    append(child) { child.parent = this; this.children.push(child); },
    remove() {
      if (this.parent) this.parent.children = this.parent.children.filter((child) => child !== this);
      this.parent = null;
    },
    setAttribute(name, value) { this.attrs.set(name, String(value)); },
    addEventListener(name, fn) { listeners.set(name, fn); },
    removeEventListener(name, fn) { if (listeners.get(name) === fn) listeners.delete(name); },
    emit(name, event = {}) { return listeners.get(name)?.(event); },
    listener(name) { return listeners.get(name) || null; }
  };
}

function createHarness({ hostStatus = null, historyTexts = ['ilk mesaj', 'ikinci mesaj'] } = {}) {
  const input = element();
  input.value = 'mevcut taslak';
  input.selectionStart = 0;
  input.selectionEnd = 0;
  input.disabled = false;
  input.readOnly = false;
  input.focused = false;
  input.events = [];
  input.focus = () => { input.focused = true; };
  input.setSelectionRange = (start, end) => { input.selectionStart = start; input.selectionEnd = end; };
  input.dispatchEvent = (event) => { input.events.push(event.type); return true; };

  const messages = element();
  messages.articles = historyTexts.map(article);
  messages.querySelectorAll = (selector) => {
    assert.equal(selector, '.message.user');
    return messages.articles;
  };
  const composer = element();
  let status = hostStatus;
  if (status) { status.id = api.STATUS_ID; composer.append(status); }
  const documentRef = {
    querySelector(selector) {
      if (selector === '#messageInput') return input;
      if (selector === '#messages') return messages;
      if (selector === '#composer') return composer;
      if (selector === `#${api.STATUS_ID}`) return status?.parent ? status : null;
      return null;
    },
    createElement(tag) {
      assert.equal(tag, 'p');
      const created = element();
      const append = composer.append.bind(composer);
      composer.append = (child) => { append(child); if (child.id === api.STATUS_ID) status = child; };
      return created;
    }
  };
  class EventImpl {
    constructor(type, options) { this.type = type; this.bubbles = Boolean(options?.bubbles); }
  }
  return { input, messages, composer, documentRef, EventImpl, status: () => status };
}

{
  const h = createHarness();
  const controller = api.createController({ documentRef: h.documentRef, EventImpl: h.EventImpl });
  assert.equal(controller.mount(), true);
  assert.equal(controller.mount(), true);
  assert.equal(h.composer.children.filter((child) => child.id === api.STATUS_ID).length, 1);
  assert.equal(controller.snapshot().mounted, true);
  assert.equal(controller.snapshot().historyLength, 2);

  let prevented = false;
  const up = key('ArrowUp', { target: h.input, preventDefault() { prevented = true; } });
  assert.equal(h.input.emit('keydown', up), true);
  assert.equal(prevented, true);
  assert.equal(h.input.value, 'ikinci mesaj');
  assert.equal(h.input.events.at(-1), 'input');
  assert.equal(h.status().textContent, 'Önceki mesaj 2/2');
  assert.equal(h.status().hidden, false);

  h.input.selectionStart = h.input.selectionEnd = h.input.value.length;
  assert.equal(controller.recall(1), true);
  assert.equal(h.input.value, 'mevcut taslak');
  assert.equal(controller.snapshot().navigating, false);

  h.input.selectionStart = h.input.selectionEnd = 0;
  assert.equal(controller.recall(-1), true);
  h.messages.articles.push(article('üçüncü mesaj'));
  assert.equal(h.messages.emit('hafize:conversation-changed'), true);
  assert.equal(controller.snapshot().historyLength, 3);
  assert.equal(controller.snapshot().navigating, false);

  const ownedStatus = h.status();
  assert.equal(controller.destroy(), true);
  assert.equal(controller.destroy(), false);
  assert.equal(ownedStatus.parent, null);
  assert.equal(h.input.listener('keydown'), null);
  assert.equal(h.input.listener('input'), null);
  assert.equal(h.messages.listener('hafize:conversation-changed'), null);
  assert.deepEqual({ ...controller.snapshot() }, { mounted: false, historyLength: 0, cursor: null, navigating: false, hasDraft: false });
  assert.equal(controller.recall(-1), false);
  assert.equal(controller.onKeydown(key('ArrowUp')), false);
  assert.equal(controller.onInput(), false);
  assert.equal(controller.onMessagesChanged(), false);
  assert.equal(Array.from(controller.refreshHistory()).length, 0);

  assert.equal(controller.mount(), true);
  assert.notEqual(h.status(), ownedStatus);
  assert.equal(h.composer.children.filter((child) => child.id === api.STATUS_ID).length, 1);
  assert.equal(controller.destroy(), true);
}

{
  const hostStatus = element();
  hostStatus.textContent = 'Host mesajı';
  hostStatus.hidden = false;
  hostStatus.className = 'host-status';
  hostStatus.setAttribute('data-owner', 'shell');
  const h = createHarness({ hostStatus });
  const controller = api.createController({ documentRef: h.documentRef, EventImpl: h.EventImpl });
  assert.equal(controller.mount(), true);
  assert.equal(controller.recall(-1), true);
  assert.notEqual(hostStatus.textContent, 'Host mesajı');
  assert.equal(controller.destroy(), true);
  assert.equal(hostStatus.parent, h.composer);
  assert.equal(hostStatus.textContent, 'Host mesajı');
  assert.equal(hostStatus.hidden, false);
  assert.equal(hostStatus.className, 'host-status');
  assert.equal(hostStatus.attrs.get('data-owner'), 'shell');
}

{
  const h = createHarness({ historyTexts: [] });
  const controller = api.createController({ documentRef: h.documentRef, EventImpl: h.EventImpl });
  assert.equal(controller.mount(), true);
  assert.equal(controller.recall(-1), false);
  assert.equal(h.status().textContent, 'Bu sohbette geri çağrılacak önceki mesaj yok.');
  assert.equal(controller.recall(0), false);
  assert.equal(controller.destroy(), true);
}

assert.equal(api.createController({ documentRef: { querySelector: () => null } }).mount(), false);
for (const forbidden of [
  'fetch(', 'XMLHttpRequest', 'WebSocket', 'sendBeacon', 'localStorage', 'sessionStorage',
  'navigator.clipboard', 'requestSubmit', '.submit(', 'innerHTML', 'eval('
]) assert.equal(source.includes(forbidden), false, `forbidden API: ${forbidden}`);

assert.match(source, /\.message\.user/);
assert.doesNotMatch(source, /\.message\.assistant/);
assert.match(source, /MAX_HISTORY = 50/);
assert.match(source, /MAX_MESSAGE_CHARS = 12_000/);
console.log('composer history lifecycle contract ok');
