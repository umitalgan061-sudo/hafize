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
    this.value = '';
    this.dataset = {};
    this.disabled = false;
    this.children = [];
    this.attributes = new Map();
    this.listeners = new Map();
    this.dispatched = [];
    this.submitCount = 0;
    this.focusCount = 0;
    this.classList = new FakeClassList(this);
  }
  append(...nodes) { this.children.push(...nodes); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  addEventListener(name, handler) { this.listeners.set(name, handler); }
  dispatchEvent(event) { this.dispatched.push(event?.type || 'unknown'); return true; }
  requestSubmit() { this.submitCount += 1; }
  focus() { this.focusCount += 1; }
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
    this.input = new FakeNode('textarea');
    this.input.id = 'messageInput';
    this.composer = new FakeNode('form');
    this.composer.id = 'composer';
    this.sendButton = new FakeNode('button');
    this.sendButton.id = 'sendBtn';
  }
  createElement(tag) { return new FakeNode(tag); }
  querySelector(selector) {
    if (selector === '#messages') return this.messages;
    if (selector === '#messageInput') return this.input;
    if (selector === '#composer') return this.composer;
    if (selector === '#sendBtn') return this.sendButton;
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
assert.equal(copyApi.composerText('yeniden gönder'), 'yeniden gönder');
assert.equal(copyApi.composerText('x'.repeat(copyApi.MAX_COMPOSER_CHARS + 1)), null);
assert.equal(copyApi.quoteText('bir\niki'), '> bir\n> iki');
assert.equal(copyApi.quoteText('x'.repeat(copyApi.MAX_COMPOSER_CHARS)), null, 'quote prefix must count toward composer bound');

const user = message('user', 'Kullanıcı mesajı');
const assistant = message('assistant', 'Hafize\nyanıtı');
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

const userActions = user.article.querySelector('.message-copy-actions');
assert.equal(userActions.children.length, 3, 'user message must expose resend, quote and copy actions');
const resendButton = userActions.children[0];
const userQuoteButton = userActions.children[1];
const userCopyButton = userActions.children[2];
assert.equal(resendButton.type, 'button');
assert.equal(resendButton.textContent, 'Tekrar gönder');
assert.equal(resendButton.attributes.get('aria-label'), 'kendi mesajını tekrar gönder');
assert.equal(userQuoteButton.textContent, 'Alıntıla');
assert.equal(userQuoteButton.attributes.get('aria-label'), 'kendi mesajını yazara alıntıla');
assert.equal(userCopyButton.textContent, 'Kopyala');
assert.equal(userCopyButton.attributes.get('aria-label'), 'kendi mesajını kopyala');
assert.equal(await controller.copyMessage(userCopyButton, user.content), true);
assert.deepEqual(writes, ['Kullanıcı mesajı']);
assert.equal(userCopyButton.dataset.state, 'success');
assert.equal(userCopyButton.textContent, 'Kopyalandı');
assert.equal([...timers.values()].some((timer) => timer.delay === copyApi.RESET_DELAY_MS), true);

assert.equal(controller.resendMessage(resendButton, user.content), true);
assert.equal(documentRef.input.value, 'Kullanıcı mesajı');
assert.deepEqual(documentRef.input.dispatched, ['input']);
assert.equal(documentRef.composer.submitCount, 1, 'resend must reuse normal composer submit path');
assert.equal(resendButton.dataset.state, 'success');
assert.equal(resendButton.textContent, 'Tekrar gönderildi');

const assistantActions = assistant.article.querySelector('.message-copy-actions');
assert.equal(assistantActions.children.length, 2, 'assistant message must expose quote and copy only');
const assistantQuoteButton = assistantActions.children[0];
const assistantCopyButton = assistantActions.children[1];
assert.equal(assistantQuoteButton.attributes.get('aria-label'), 'Hafize yanıtını yazara alıntıla');
assert.equal(assistantCopyButton.attributes.get('aria-label'), 'Hafize yanıtını kopyala');
assert.equal(await controller.copyMessage(assistantCopyButton, assistant.content), true);
assert.deepEqual(writes, ['Kullanıcı mesajı', 'Hafize\nyanıtı']);

documentRef.input.value = 'Kendi taslağım';
const submitsBeforeQuote = documentRef.composer.submitCount;
assert.equal(controller.quoteMessage(assistantQuoteButton, assistant.content), true);
assert.equal(documentRef.input.value, 'Kendi taslağım\n\n> Hafize\n> yanıtı');
assert.equal(documentRef.composer.submitCount, submitsBeforeQuote);
assert.equal(documentRef.input.focusCount, 1);
assert.equal(documentRef.input.dispatched.at(-1), 'input');
assert.equal(assistantQuoteButton.textContent, 'Alıntı eklendi');

const oversizedContent = new FakeNode('div');
oversizedContent.textContent = 'x'.repeat(copyApi.MAX_COMPOSER_CHARS + 1);
const oversizedResend = new FakeNode('button');
oversizedResend.dataset.idleLabel = 'Tekrar gönder';
assert.equal(controller.resendMessage(oversizedResend, oversizedContent), false);
assert.equal(documentRef.composer.submitCount, submitsBeforeQuote);
const oversizedQuote = new FakeNode('button');
oversizedQuote.dataset.idleLabel = 'Alıntıla';
assert.equal(controller.quoteMessage(oversizedQuote, oversizedContent), false);

const almostFullDraft = 'd'.repeat(copyApi.MAX_COMPOSER_CHARS - 2);
documentRef.input.value = almostFullDraft;
const quoteOverflowButton = new FakeNode('button');
quoteOverflowButton.dataset.idleLabel = 'Alıntıla';
assert.equal(controller.quoteMessage(quoteOverflowButton, user.content), false);
assert.equal(documentRef.input.value, almostFullDraft, 'failed quote must preserve existing draft');
assert.equal(quoteOverflowButton.textContent, 'Yazar dolu');

documentRef.input.value = '';
const beforeBusySubmit = documentRef.composer.submitCount;
documentRef.sendButton.className = 'send-btn streaming';
const busyButton = new FakeNode('button');
busyButton.dataset.idleLabel = 'Tekrar gönder';
assert.equal(controller.resendMessage(busyButton, user.content), false);
assert.equal(busyButton.textContent, 'Yanıt sürüyor');
assert.equal(documentRef.composer.submitCount, beforeBusySubmit, 'active response must block resend');
documentRef.sendButton.className = 'send-btn';

const unavailable = copyApi.createController({
  documentRef,
  clipboard: null,
  secureContext: true,
  MutationObserverImpl: null,
  setTimeoutImpl,
  clearTimeoutImpl
});
const unavailableButton = new FakeNode('button');
unavailableButton.dataset.idleLabel = 'Kopyala';
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
insecureButton.dataset.idleLabel = 'Kopyala';
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
failingButton.dataset.idleLabel = 'Kopyala';
assert.equal(await failing.copyMessage(failingButton, assistant.content), false);
assert.equal(failingButton.textContent, 'Kopyalanamadı');
assert.equal(failingButton.textContent.includes('provider detail'), false);

const emptyButton = new FakeNode('button');
emptyButton.dataset.idleLabel = 'Tekrar gönder';
const emptyContent = new FakeNode('div');
emptyContent.textContent = '';
assert.equal(controller.resendMessage(emptyButton, emptyContent), false);
controller.destroy();
assert.equal(disconnected, true);

const sourcePaths = [
  '../public/message-copy.js',
  '../public/chat-run-controller.js',
  '../public/sw-policy.js'
].map((relative) => fileURLToPath(new URL(relative, import.meta.url)));
const [copySource, loaderSource, swSource] = await Promise.all(sourcePaths.map((path) => readFile(path, 'utf8')));

for (const forbidden of ['clipboard.read', 'readText(', 'execCommand(', 'localStorage', 'sessionStorage', 'innerHTML', 'Authorization', 'Bearer ']) {
  assert.equal(copySource.includes(forbidden), false, `message action source must not contain ${forbidden}`);
}
assert.equal(copySource.includes('clipboard.writeText(text)'), true);
assert.equal(copySource.includes('content?.textContent'), true);
assert.equal(copySource.includes("button.addEventListener('click'"), true, 'message actions must require explicit user click');
assert.equal(copySource.includes("documentRef.querySelector('#composer')"), true, 'resend must reuse the canonical composer');
assert.equal(copySource.includes('composer.requestSubmit()'), true, 'resend must enter the normal submit path');
assert.equal(copySource.includes("classList?.contains('streaming')"), true, 'resend must fail closed while a response is active');
assert.equal(copySource.includes('MAX_COMPOSER_CHARS = 12_000'), true, 'composer actions must share the existing 12k message bound');
assert.equal(copySource.includes("input.focus?.()"), true, 'quote must return focus to composer');
assert.equal(copySource.includes('fetch('), false, 'message actions must not create a parallel network path');
assert.equal(loaderSource.includes("loadShellEnhancement('HafizeMessageCopy', '/message-copy.js', 'data-hafize-message-copy')"), true, 'loader must use the fixed same-origin asset through the shared idempotent loader');
assert.equal(loaderSource.includes('data-hafize-message-copy'), true, 'loader must be idempotent');
assert.equal(swSource.includes("`${CACHE_PREFIX}v160`"), true);
assert.equal(swSource.includes("'/message-copy.js'"), true);
assert.equal(swSource.includes("pathname.startsWith('/api/')"), true, 'API requests must remain network-only');

console.log('message copy, resend and quote control tests passed');
