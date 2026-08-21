import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../public/message-copy.js');

class ClassList {
  constructor(node) { this.node = node; }
  contains(name) { return this.node.className.split(/\s+/).filter(Boolean).includes(name); }
}

class Node {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase();
    this.id = '';
    this.className = '';
    this.textContent = '';
    this.value = '';
    this.dataset = {};
    this.disabled = false;
    this.children = [];
    this.parentNode = null;
    this.attributes = new Map();
    this.listeners = new Map();
    this.classList = new ClassList(this);
    this.submitCount = 0;
    this.focusCount = 0;
    this.dispatched = [];
  }
  append(...nodes) {
    for (const node of nodes) {
      node.parentNode = this;
      this.children.push(node);
    }
  }
  remove() {
    if (!this.parentNode) return;
    this.parentNode.children = this.parentNode.children.filter((node) => node !== this);
    this.parentNode = null;
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }
  removeEventListener(type, listener) {
    const list = this.listeners.get(type) || [];
    this.listeners.set(type, list.filter((entry) => entry !== listener));
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  querySelectorAll(selector) {
    const matches = (node) => {
      if (selector.startsWith('#')) return node.id === selector.slice(1);
      if (selector.startsWith('.')) return node.classList.contains(selector.slice(1));
      return false;
    };
    const found = [];
    for (const child of this.children) {
      if (matches(child)) found.push(child);
      found.push(...child.querySelectorAll(selector));
    }
    return found;
  }
  requestSubmit() { this.submitCount += 1; }
  focus() { this.focusCount += 1; }
  dispatchEvent(event) { this.dispatched.push(event?.type || 'unknown'); return true; }
}

function makeMessage(role, text) {
  const article = new Node('article');
  article.className = `message ${role}`;
  const content = new Node('div');
  content.className = 'content';
  content.textContent = text;
  article.append(content);
  return { article, content };
}

function fixture({ ObserverImpl, clipboard } = {}) {
  const head = new Node('head');
  const messages = new Node('div');
  messages.id = 'messages';
  const user = makeMessage('user', 'merhaba');
  const assistant = makeMessage('assistant', 'selam');
  messages.append(user.article, assistant.article);
  const input = new Node('textarea');
  input.id = 'messageInput';
  const composer = new Node('form');
  composer.id = 'composer';
  const send = new Node('button');
  send.id = 'sendBtn';
  const timers = new Map();
  let nextTimer = 1;
  const documentRef = {
    head,
    createElement: (tag) => new Node(tag),
    querySelector(selector) {
      if (selector === '#messages') return messages;
      if (selector === '#messageInput') return input;
      if (selector === '#composer') return composer;
      if (selector === '#sendBtn') return send;
      if (selector === `#${api.STYLE_ID}`) return head.querySelector(`#${api.STYLE_ID}`);
      return null;
    }
  };
  const setTimeoutImpl = (callback, delay) => {
    const id = nextTimer++;
    timers.set(id, { callback, delay });
    return id;
  };
  const clearTimeoutImpl = (id) => timers.delete(id);
  return {
    head, messages, user, assistant, input, composer, send, timers, documentRef,
    clipboard: clipboard || { async writeText() {} },
    ObserverImpl: ObserverImpl === undefined ? class {
      constructor(callback) { this.callback = callback; fixture.lastObserver = this; }
      observe(target, options) { this.target = target; this.options = options; }
      disconnect() { this.disconnected = true; }
    } : ObserverImpl,
    setTimeoutImpl, clearTimeoutImpl
  };
}

function create(f) {
  return api.createController({
    documentRef: f.documentRef,
    clipboard: f.clipboard,
    secureContext: true,
    MutationObserverImpl: f.ObserverImpl,
    setTimeoutImpl: f.setTimeoutImpl,
    clearTimeoutImpl: f.clearTimeoutImpl,
    EventImpl: class { constructor(type) { this.type = type; } }
  });
}

function click(button) {
  const listener = button.listeners.get('click')?.[0];
  assert.equal(typeof listener, 'function');
  return listener({ type: 'click' });
}

{
  const f = fixture();
  const first = create(f);
  const second = create(f);
  assert.equal(first.mount(), true);
  assert.equal(first.getState().ownsRoot, true);
  assert.equal(second.mount(), false, 'duplicate controller must fail closed on the same message root');
  assert.equal(f.messages.querySelectorAll('.message-copy-actions').length, 2);

  assert.equal(first.destroy(), true);
  assert.equal(first.destroy(), false, 'destroy is idempotent');
  assert.equal(f.messages.querySelectorAll('.message-copy-actions').length, 0, 'owned action shells are removed');
  assert.equal(first.getState().destroyed, true);

  assert.equal(second.mount(), true, 'destroy releases ownership for a clean remount');
  assert.equal(f.messages.querySelectorAll('.message-copy-actions').length, 2);
  second.destroy();
}

{
  const f = fixture();
  const controller = create(f);
  assert.equal(controller.mount(), true);
  const actions = f.user.article.querySelector('.message-copy-actions');
  const resend = actions.children[0];
  const quote = actions.children[1];
  const copy = actions.children[2];
  const staleResend = resend.listeners.get('click')[0];
  const staleQuote = quote.listeners.get('click')[0];
  const staleCopy = copy.listeners.get('click')[0];
  controller.destroy();

  f.input.value = '';
  const submits = f.composer.submitCount;
  staleResend({ type: 'click' });
  staleQuote({ type: 'click' });
  await staleCopy({ type: 'click' });
  assert.equal(f.input.value, '', 'stale click cannot mutate composer');
  assert.equal(f.composer.submitCount, submits, 'stale click cannot submit');
  assert.equal(await controller.copyMessage(copy, f.user.content), false, 'public copy is inert after destroy');
  assert.equal(controller.resendMessage(resend, f.user.content), false, 'public resend is inert after destroy');
  assert.equal(controller.quoteMessage(quote, f.user.content), false, 'public quote is inert after destroy');
}

{
  let observerCallback = null;
  class Observer {
    constructor(callback) { observerCallback = callback; }
    observe() {}
    disconnect() {}
  }
  const f = fixture({ ObserverImpl: Observer });
  const controller = create(f);
  controller.mount();
  controller.destroy();

  const late = makeMessage('assistant', 'geç mesaj');
  f.messages.append(late.article);
  observerCallback();
  assert.equal(late.article.querySelector('.message-copy-actions'), null, 'stale observer cannot decorate after teardown');
}

{
  class FailingObserver {
    constructor(callback) { this.callback = callback; }
    observe() { throw new Error('observe failed'); }
    disconnect() { this.disconnected = true; }
  }
  const f = fixture({ ObserverImpl: FailingObserver });
  const controller = create(f);
  assert.equal(controller.mount(), false, 'observer installation failure must fail closed');
  assert.equal(f.messages.querySelectorAll('.message-copy-actions').length, 0, 'partial decoration is rolled back');
  assert.equal(f.head.querySelector(`#${api.STYLE_ID}`), null, 'controller-owned style is rolled back');

  const retry = create(f);
  assert.equal(retry.mount(), false, 'same failing observer still fails without leaked ownership');
  retry.destroy();
}

{
  const f = fixture({ ObserverImpl: null });
  const foreign = new Node('div');
  foreign.className = 'message-copy-actions';
  foreign.setAttribute('data-owner', 'host');
  f.user.article.append(foreign);
  const preexistingStyle = new Node('style');
  preexistingStyle.id = api.STYLE_ID;
  f.head.append(preexistingStyle);

  const controller = create(f);
  assert.equal(controller.mount(), true);
  assert.equal(f.user.article.querySelector('.message-copy-actions'), foreign, 'host action surface is not replaced');
  controller.destroy();
  assert.equal(f.user.article.querySelector('.message-copy-actions'), foreign, 'host action surface survives destroy');
  assert.equal(f.head.querySelector(`#${api.STYLE_ID}`), preexistingStyle, 'host-owned style survives destroy');
}

{
  const f = fixture({ ObserverImpl: null });
  const controller = create(f);
  controller.mount();
  const button = f.assistant.article.querySelector('.message-copy-actions').children[1];
  assert.equal(await controller.copyMessage(button, f.assistant.content), true);
  assert.equal(button.dataset.state, 'success');
  const timer = [...f.timers.values()].find((entry) => entry.delay === api.RESET_DELAY_MS);
  assert.ok(timer);
  controller.destroy();
  const labelAfterDestroy = button.textContent;
  timer.callback();
  assert.equal(button.textContent, labelAfterDestroy, 'stale reset timer is inert after destroy');
}

console.log('message copy lifecycle ownership tests passed');
