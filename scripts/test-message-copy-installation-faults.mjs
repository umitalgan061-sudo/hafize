import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../public/message-copy.js');

class Node {
  constructor(tag = 'div', { failListener = false, failAppend = false } = {}) {
    this.tagName = tag.toUpperCase();
    this.id = '';
    this.className = '';
    this.textContent = '';
    this.value = '';
    this.dataset = {};
    this.disabled = false;
    this.children = [];
    this.parentNode = null;
    this.listeners = new Map();
    this.attributes = new Map();
    this.failListener = failListener;
    this.failAppend = failAppend;
    this.classList = { contains: (name) => this.className.split(/\s+/).includes(name) };
  }
  append(...nodes) {
    if (this.failAppend) throw new Error('append failed');
    for (const node of nodes) { node.parentNode = this; this.children.push(node); }
  }
  remove() {
    if (this.parentNode) this.parentNode.children = this.parentNode.children.filter((node) => node !== this);
    this.parentNode = null;
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  addEventListener(type, listener) {
    if (this.failListener) throw new Error('listener failed');
    this.listeners.set(type, [...(this.listeners.get(type) || []), listener]);
  }
  removeEventListener(type, listener) {
    this.listeners.set(type, (this.listeners.get(type) || []).filter((entry) => entry !== listener));
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  querySelectorAll(selector) {
    const found = [];
    for (const child of this.children) {
      if (selector.startsWith('.') && child.classList.contains(selector.slice(1))) found.push(child);
      if (selector.startsWith('#') && child.id === selector.slice(1)) found.push(child);
      found.push(...child.querySelectorAll(selector));
    }
    return found;
  }
  requestSubmit() { this.submitCount = (this.submitCount || 0) + 1; }
  dispatchEvent() { return true; }
  focus() {}
}

function build({ failButtonListener = false, failHeadAppend = false, timerThrows = false } = {}) {
  const head = new Node('head', { failAppend: failHeadAppend });
  const messages = new Node('div');
  messages.id = 'messages';
  const article = new Node('article');
  article.className = 'message user';
  const content = new Node('div');
  content.className = 'content';
  content.textContent = 'yeniden gönder';
  article.append(content);
  messages.append(article);
  const input = new Node('textarea');
  const composer = new Node('form');
  const send = new Node('button');
  let createdButtons = 0;
  const documentRef = {
    head,
    createElement(tag) {
      if (tag === 'button') {
        createdButtons += 1;
        return new Node(tag, { failListener: failButtonListener && createdButtons === 2 });
      }
      return new Node(tag);
    },
    querySelector(selector) {
      if (selector === '#messages') return messages;
      if (selector === '#messageInput') return input;
      if (selector === '#composer') return composer;
      if (selector === '#sendBtn') return send;
      if (selector === `#${api.STYLE_ID}`) return head.querySelector(`#${api.STYLE_ID}`);
      return null;
    }
  };
  let timerCalls = 0;
  const controller = api.createController({
    documentRef,
    clipboard: { async writeText() {} },
    secureContext: true,
    MutationObserverImpl: null,
    setTimeoutImpl() {
      timerCalls += 1;
      if (timerThrows) throw new Error('timer failed');
      return timerCalls;
    },
    clearTimeoutImpl() {},
    EventImpl: class { constructor(type) { this.type = type; } }
  });
  return { head, messages, article, content, input, composer, send, controller, getTimerCalls: () => timerCalls };
}

{
  const f = build({ failHeadAppend: true });
  assert.equal(f.controller.mount(), false, 'style append failure fails closed');
  assert.equal(f.controller.getState().mounted, false);
  assert.equal(f.messages.querySelector('.message-copy-actions'), null);

  f.head.failAppend = false;
  const retry = build();
  assert.equal(retry.controller.mount(), true, 'clean document can mount after unrelated failed installation');
  retry.controller.destroy();
}

{
  const f = build({ failButtonListener: true });
  assert.equal(f.controller.mount(), false, 'partial button listener installation rolls back');
  assert.equal(f.messages.querySelector('.message-copy-actions'), null);
  assert.equal(f.head.querySelector(`#${api.STYLE_ID}`), null);
  assert.equal(f.controller.getState().ownedActions, 0);
}

{
  const f = build({ timerThrows: true });
  assert.equal(f.controller.mount(), true);
  const actions = f.article.querySelector('.message-copy-actions');
  const resend = actions.children[0];
  assert.equal(f.controller.resendMessage(resend, f.content), true, 'timer failure does not duplicate submit');
  assert.equal(f.composer.submitCount, 1);
  assert.equal(resend.disabled, false, 'failed state timer restores interactive state synchronously');
  f.controller.destroy();
}

{
  const f = build();
  assert.equal(f.controller.mount(), true);
  const actions = f.article.querySelector('.message-copy-actions');
  const resend = actions.children[0];
  const submitBefore = f.composer.submitCount || 0;
  f.controller.destroy();
  assert.equal(f.controller.resendMessage(resend, f.content), false);
  assert.equal(f.composer.submitCount || 0, submitBefore, 'destroyed controller cannot submit composer');
  assert.equal(f.input.value, '', 'destroyed controller cannot populate composer');
}

{
  const f = build();
  assert.equal(f.controller.mount(), true);
  const actions = f.article.querySelector('.message-copy-actions');
  const quote = actions.children[1];
  f.controller.destroy();
  assert.equal(f.controller.quoteMessage(quote, f.content), false);
  assert.equal(f.input.value, '', 'destroyed controller cannot append quote text');
}

console.log('message copy installation fault tests passed');
