import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const copyApi = require('../public/message-copy.js');

class FakeClassList {
  constructor(node) { this.node = node; }
  contains(name) { return this.node.className.split(/\s+/).includes(name); }
}

class FakeNode {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase();
    this.className = '';
    this.id = '';
    this.textContent = '';
    this.dataset = {};
    this.disabled = false;
    this.children = [];
    this.attributes = new Map();
    this.listeners = new Map();
    this.classList = new FakeClassList(this);
  }
  append(...nodes) { this.children.push(...nodes); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  addEventListener(name, handler) { this.listeners.set(name, handler); }
  querySelector(selector) {
    if (selector === '.content') return this.children.find((child) => child.classList?.contains('content')) || null;
    if (selector === '.message-copy-actions') return this.children.find((child) => child.classList?.contains('message-copy-actions')) || null;
    return null;
  }
  querySelectorAll(selector) {
    if (selector !== '.message') return [];
    return this.children.filter((child) => child.classList?.contains('message'));
  }
}

class FakeDocument {
  constructor(messages) {
    this.messages = messages;
    this.head = new FakeNode('head');
  }
  createElement(tag) { return new FakeNode(tag); }
  querySelector(selector) {
    if (selector === '#messages') return this.messages;
    if (selector === `#${copyApi.STYLE_ID}`) return this.head.children.find((child) => child.id === copyApi.STYLE_ID) || null;
    return null;
  }
  querySelectorAll(selector) { return this.messages.querySelectorAll(selector); }
}

function message(role, text) {
  const article = new FakeNode('article');
  article.className = `message ${role}`;
  const content = new FakeNode('div');
  content.className = 'content';
  content.textContent = text;
  article.append(content);
  return { article, content };
}

assert.equal(copyApi.copyText('hello\r\nworld'), 'hello\nworld');
assert.equal(copyApi.copyText('   '), null);
assert.equal(copyApi.copyText(null), null);
assert.equal(copyApi.copyText('x'.repeat(copyApi.MAX_COPY_CHARS + 1)), null);
assert.equal(copyApi.copyText(' x '), ' x ');

const user = message('user', 'Kullanıcı mesajı');
const assistant = message('assistant', 'Hafize yanıtı');
const messages = new FakeNode('div');
messages.id = 'messages';
messages.append(user.article, assistant.article);
const documentRef = new FakeDocument(messages);

let observed = null;
let disconnected = false;
class Observer {
  constructor(callback) { this.callback = callback; }
  observe(target, options) { observed = { target, options }; }
  disconnect() { disconnected = true; }
}

let timerId = 0;
const timers = new Map();
const setTimeoutImpl = (callback, delay) => {
  timerId += 1;
  timers.set(timerId, { callback, delay });
  return timerId;
};
const clearTimeoutImpl = (id) => timers.delete(id);
const writes = [];
const clipboard = { async writeText(text) { writes.push(text); } };

const controller = copyApi.createController({
  documentRef,
  clipboard,
  secureContext: true,
  MutationObserverImpl: Observer,
  setTimeoutImpl,
  clearTimeoutImpl
});
assert.equal(controller.mount(), true);
assert.equal(documentRef.head.children.length, 1, 'styles should be installed exactly once');
assert.equal(documentRef.head.children[0].id, copyApi.STYLE_ID);
assert.equal(documentRef.head.children[0].tagName, 'STYLE');
assert.equal(user.article.querySelector('.message-copy-actions') !== null, true);
assert.equal(assistant.article.querySelector('.message-copy-actions') !== null, true);
assert.equal(controller.decorateAll(messages), 0, 'rerender decoration must be idempotent');
assert.strictEqual(observed.target, messages);
assert.deepEqual(observed.options, { childList: true, subtree: true });

const userButton = user.article.querySelector('.message-copy-actions').children[0];
assert.equal(userButton.type, 'button');
assert.equal(userButton.textContent, 'Kopyala');
assert.equal(userButton.attributes.get('aria-label'), 'kendi mesajını kopyala');
assert.equal(await controller.copyMessage(userButton, user.content), true);
assert.deepEqual(writes, ['Kullanıcı mesajı']);
assert.equal(userButton.dataset.state, 'success');
assert.equal(userButton.textContent, 'Kopyalandı');
assert.equal([...timers.values()].some((timer) => timer.delay === copyApi.RESET_DELAY_MS), true);

const assistantButton = assistant.article.querySelector('.message-copy-actions').children[0];
assert.equal(assistantButton.attributes.get('aria-label'), 'Hafize yanıtını kopyala');
assert.equal(await controller.copyMessage(assistantButton, assistant.content), true);
assert.deepEqual(writes, ['Kullanıcı mesajı', 'Hafize yanıtı']);

const unavailable = copyApi.createController({
  documentRef,
  clipboard: null,
  secureContext: true,
  MutationObserverImpl: null,
  setTimeoutImpl,
  clearTimeoutImpl
});
const unavailableButton = new FakeNode('button');
assert.equal(await unavailable.copyMessage(unavailableButton, assistant.content), false);
assert.equal(unavailableButton.dataset.state, 'error');
assert.equal(unavailableButton.textContent, 'Clipboard kapalı');

const insecure = copyApi.createController({
  documentRef,
  clipboard,
  secureContext: false,
  MutationObserverImpl: null,
  setTimeoutImpl,
  clearTimeoutImpl
});
const insecureButton = new FakeNode('button');
assert.equal(await insecure.copyMessage(insecureButton, assistant.content), false);
assert.equal(writes.length, 2, 'insecure context must never call clipboard.writeText');

const failing = copyApi.createController({
  documentRef,
  clipboard: { async writeText() { throw new Error('provider detail'); } },
  secureContext: true,
  MutationObserverImpl: null,
  setTimeoutImpl,
  clearTimeoutImpl
});
const failingButton = new FakeNode('button');
assert.equal(await failing.copyMessage(failingButton, assistant.content), false);
assert.equal(failingButton.textContent, 'Kopyalanamadı');
assert.equal(failingButton.textContent.includes('provider detail'), false);

const emptyButton = new FakeNode('button');
const emptyContent = new FakeNode('div');
emptyContent.textContent = '';
assert.equal(await controller.copyMessage(emptyButton, emptyContent), false);
assert.equal(writes.length, 2);
controller.destroy();
assert.equal(disconnected, true);

const sourcePaths = [
  '../public/message-copy.js',
  '../public/chat-run-controller.js',
  '../public/sw-policy.js'
].map((relative) => fileURLToPath(new URL(relative, import.meta.url)));
const [copySource, loaderSource, swSource] = await Promise.all(sourcePaths.map((path) => readFile(path, 'utf8')));

for (const forbidden of ['clipboard.read', 'readText(', 'execCommand(', 'localStorage', 'sessionStorage', 'innerHTML', 'Authorization', 'Bearer ']) {
  assert.equal(copySource.includes(forbidden), false, `message copy source must not contain ${forbidden}`);
}
assert.equal(copySource.includes('clipboard.writeText(text)'), true);
assert.equal(copySource.includes('content?.textContent'), true);
assert.equal(copySource.includes("button.addEventListener('click'"), true, 'copy must require explicit user click');
assert.equal(copySource.includes('fetch('), false, 'copy feature must not create a network path');
assert.equal(loaderSource.includes("script.src = '/message-copy.js'"), true, 'loader must use fixed same-origin asset path');
assert.equal(loaderSource.includes('data-hafize-message-copy'), true, 'loader must be idempotent');
assert.equal(swSource.includes("`${CACHE_PREFIX}v18`"), true);
assert.equal(swSource.includes("'/message-copy.js'"), true);
assert.equal(swSource.includes("pathname.startsWith('/api/')"), true, 'API requests must remain network-only');

console.log('message copy control tests passed');
