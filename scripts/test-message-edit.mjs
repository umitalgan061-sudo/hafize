import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const api = require('../public/message-edit.js');

class ClassList {
  constructor(node) { this.node = node; }
  contains(name) { return this.node.className.split(/\s+/).includes(name); }
}
class Node {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase();
    this.className = '';
    this.textContent = '';
    this.value = '';
    this.dataset = {};
    this.children = [];
    this.attributes = new Map();
    this.listeners = new Map();
    this.dispatched = [];
    this.focusCount = 0;
    this.selection = null;
    this.classList = new ClassList(this);
  }
  append(...nodes) { this.children.push(...nodes); }
  prepend(...nodes) { this.children.unshift(...nodes); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  addEventListener(name, fn) { this.listeners.set(name, fn); }
  dispatchEvent(event) { this.dispatched.push(event.type); return true; }
  focus() { this.focusCount += 1; }
  setSelectionRange(start, end) { this.selection = [start, end]; }
  querySelector(selector) {
    if (selector === '.content') return this.children.find((x) => x.classList?.contains('content')) || null;
    if (selector === '.message-copy-actions') return this.children.find((x) => x.classList?.contains('message-copy-actions')) || null;
    return null;
  }
  querySelectorAll(selector) {
    if (selector === '.message.user') return this.children.filter((x) => x.classList?.contains('message') && x.classList.contains('user'));
    return [];
  }
}
class Document {
  constructor(messages) {
    this.messages = messages;
    this.input = new Node('textarea');
    this.send = new Node('button');
  }
  createElement(tag) { return new Node(tag); }
  querySelector(selector) {
    if (selector === '#messages') return this.messages;
    if (selector === '#messageInput') return this.input;
    if (selector === '#sendBtn') return this.send;
    return null;
  }
}
class FakeEvent { constructor(type) { this.type = type; } }

function userMessage(text, withActions = true) {
  const article = new Node('article');
  article.className = 'message user';
  const content = new Node('div');
  content.className = 'content';
  content.textContent = text;
  article.append(content);
  if (withActions) {
    const actions = new Node('div');
    actions.className = 'message-copy-actions';
    article.append(actions);
  }
  return { article, content };
}

assert.equal(api.editableText('a\r\nb'), 'a\nb');
assert.equal(api.editableText('   '), null);
assert.equal(api.editableText(null), null);
assert.equal(api.editableText('x'.repeat(api.MAX_COMPOSER_CHARS + 1)), null);

const message = userMessage('Bunu düzenle');
const messages = new Node('div');
messages.append(message.article);
const documentRef = new Document(messages);
let observed = null;
let disconnected = false;
class Observer {
  constructor(cb) { this.cb = cb; }
  observe(target, options) { observed = { target, options }; }
  disconnect() { disconnected = true; }
}
const controller = api.createController({ documentRef, MutationObserverImpl: Observer, EventImpl: FakeEvent });
assert.equal(controller.mount(), true);
assert.deepEqual(observed.options, { childList: true, subtree: true });
const actions = message.article.querySelector('.message-copy-actions');
assert.equal(actions.children.length, 1);
const editButton = actions.children[0];
assert.equal(editButton.textContent, 'Düzenle');
assert.equal(editButton.attributes.get('aria-label'), 'kendi mesajını yazarda düzenle');
assert.equal(message.article.dataset[api.MARKER], '1');
assert.equal(controller.decorate(message.article), false, 'decoration must be idempotent');

assert.equal(controller.editMessage(editButton, message.content), true);
assert.equal(documentRef.input.value, 'Bunu düzenle');
assert.deepEqual(documentRef.input.dispatched, ['input']);
assert.equal(documentRef.input.focusCount, 1);
assert.deepEqual(documentRef.input.selection, ['Bunu düzenle'.length, 'Bunu düzenle'.length]);
assert.equal(editButton.textContent, 'Düzenlemeye hazır');

// A different unsent draft is never overwritten silently.
documentRef.input.value = 'Korunacak taslak';
const focusBefore = documentRef.input.focusCount;
assert.equal(controller.editMessage(editButton, message.content), false);
assert.equal(documentRef.input.value, 'Korunacak taslak');
assert.equal(documentRef.input.focusCount, focusBefore + 1);
assert.equal(editButton.textContent, 'Taslak korunuyor');

// Active generation blocks edit-to-draft.
documentRef.input.value = '';
documentRef.send.className = 'send-btn streaming';
assert.equal(controller.editMessage(editButton, message.content), false);
assert.equal(documentRef.input.value, '');
assert.equal(editButton.textContent, 'Yanıt sürüyor');
documentRef.send.className = 'send-btn';

const oversized = new Node('div');
oversized.textContent = 'x'.repeat(api.MAX_COMPOSER_CHARS + 1);
assert.equal(controller.editMessage(editButton, oversized), false);
assert.equal(documentRef.input.value, '');

// If message-copy actions are not ready yet, observer can decorate later instead of creating a parallel action surface.
const late = userMessage('Geç yüklenen', false);
messages.append(late.article);
assert.equal(controller.decorate(late.article), false);
const lateActions = new Node('div');
lateActions.className = 'message-copy-actions';
late.article.append(lateActions);
assert.equal(controller.decorate(late.article), true);
assert.equal(lateActions.children[0].textContent, 'Düzenle');

controller.destroy();
assert.equal(disconnected, true);

const paths = ['../public/message-edit.js', '../public/chat-run-controller.js', '../public/sw-policy.js']
  .map((p) => fileURLToPath(new URL(p, import.meta.url)));
const [source, loader, sw] = await Promise.all(paths.map((p) => readFile(p, 'utf8')));
for (const forbidden of ['fetch(', 'WebSocket', 'localStorage', 'sessionStorage', 'clipboard', 'Authorization', 'Bearer ', 'innerHTML', 'requestSubmit(']) {
  assert.equal(source.includes(forbidden), false, `message edit source must not contain ${forbidden}`);
}
assert.equal(source.includes("documentRef.querySelector('#messageInput')"), true);
assert.equal(source.includes("classList?.contains('streaming')"), true);
assert.equal(source.includes('MAX_COMPOSER_CHARS = 12_000'), true);
assert.equal(loader.includes("'/message-edit.js'"), true);
assert.equal(loader.includes('data-hafize-message-edit'), true);
assert.equal(sw.includes("`${CACHE_PREFIX}v21`"), true);
assert.equal(sw.includes("'/message-edit.js'"), true);
assert.equal(sw.includes("pathname.startsWith('/api/')"), true);

console.log('safe message edit-to-draft tests passed');
