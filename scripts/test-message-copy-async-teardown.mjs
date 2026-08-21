import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../public/message-copy.js');

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
    this.classList = { contains: (name) => this.className.split(/\s+/).includes(name) };
  }
  append(...nodes) { for (const node of nodes) { node.parentNode = this; this.children.push(node); } }
  remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter((node) => node !== this); this.parentNode = null; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  addEventListener(type, listener) { this.listeners.set(type, [listener]); }
  removeEventListener(type, listener) { this.listeners.set(type, (this.listeners.get(type) || []).filter((entry) => entry !== listener)); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  querySelectorAll(selector) {
    const found = [];
    for (const child of this.children) {
      const match = selector.startsWith('.') ? child.classList.contains(selector.slice(1)) : selector.startsWith('#') && child.id === selector.slice(1);
      if (match) found.push(child);
      found.push(...child.querySelectorAll(selector));
    }
    return found;
  }
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function makeFixture(writeText) {
  const head = new Node('head');
  const messages = new Node('div');
  messages.id = 'messages';
  const article = new Node('article');
  article.className = 'message assistant';
  const content = new Node('div');
  content.className = 'content';
  content.textContent = 'gecikmeli yanıt';
  article.append(content);
  messages.append(article);
  const input = new Node('textarea');
  const composer = new Node('form');
  composer.requestSubmit = () => { composer.submitCount = (composer.submitCount || 0) + 1; };
  const send = new Node('button');
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
  const controller = api.createController({
    documentRef,
    clipboard: { writeText },
    secureContext: true,
    MutationObserverImpl: null,
    setTimeoutImpl(callback, delay) { const id = nextTimer++; timers.set(id, { callback, delay }); return id; },
    clearTimeoutImpl(id) { timers.delete(id); },
    EventImpl: class { constructor(type) { this.type = type; } }
  });
  return { head, messages, article, content, input, composer, send, timers, documentRef, controller };
}

{
  const gate = deferred();
  let writes = 0;
  const f = makeFixture(async () => { writes += 1; return gate.promise; });
  assert.equal(f.controller.mount(), true);
  const actions = f.article.querySelector('.message-copy-actions');
  const copyButton = actions.children[1];
  const pending = f.controller.copyMessage(copyButton, f.content);
  await Promise.resolve();
  assert.equal(writes, 1);
  assert.equal(copyButton.textContent, 'Kopyalanıyor…');
  assert.equal(copyButton.disabled, true);

  f.controller.destroy();
  assert.equal(copyButton.textContent, 'Kopyala', 'destroy restores transient button state');
  assert.equal(copyButton.disabled, false);
  gate.resolve();
  assert.equal(await pending, false, 'late clipboard success cannot resurrect destroyed controller');
  assert.equal(copyButton.textContent, 'Kopyala');
  assert.equal(copyButton.dataset.state, 'idle');
}

{
  const gate = deferred();
  const f = makeFixture(async () => gate.promise);
  f.controller.mount();
  const button = f.article.querySelector('.message-copy-actions').children[1];
  const pending = f.controller.copyMessage(button, f.content);
  await Promise.resolve();
  f.controller.destroy();
  gate.reject(new Error('late provider detail'));
  assert.equal(await pending, false, 'late clipboard failure stays quarantined');
  assert.equal(button.textContent, 'Kopyala');
  assert.equal(button.textContent.includes('provider detail'), false);
}

{
  const f = makeFixture(async () => {});
  f.controller.mount();
  const actions = f.article.querySelector('.message-copy-actions');
  const quote = actions.children[0];
  const copy = actions.children[1];
  const staleQuote = quote.listeners.get('click')[0];
  const staleCopy = copy.listeners.get('click')[0];
  f.controller.destroy();
  const before = f.input.value;
  assert.equal(staleQuote({ type: 'click' }), false);
  await staleCopy({ type: 'click' });
  assert.equal(f.input.value, before);
}

{
  const f = makeFixture(async () => {});
  f.controller.mount();
  const button = f.article.querySelector('.message-copy-actions').children[1];
  assert.equal(await f.controller.copyMessage(button, f.content), true);
  const callbacks = [...f.timers.values()].map((entry) => entry.callback);
  assert.ok(callbacks.length >= 1);
  f.controller.destroy();
  for (const callback of callbacks) callback();
  assert.equal(button.dataset.state, 'idle');
  assert.equal(button.disabled, false);
}

console.log('message copy async teardown tests passed');
