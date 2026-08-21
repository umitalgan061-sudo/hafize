import assert from 'node:assert/strict';

export class FakeElement {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.attributes = new Map();
    this.listeners = new Map();
    this.dataset = {};
    this.className = '';
    this.textContent = '';
    this.value = '';
    this.disabled = false;
    this.id = '';
  }
  get classList() {
    return {
      contains: (value) => this.className.split(/\s+/).filter(Boolean).includes(value)
    };
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
  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    if (name === 'id') this.id = String(value);
    if (name.startsWith('data-')) {
      const key = name.slice(5).replace(/-([a-z])/g, (_m, c) => c.toUpperCase());
      this.dataset[key] = String(value);
    }
  }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }
  removeEventListener(type, listener) {
    const entries = this.listeners.get(type) || [];
    this.listeners.set(type, entries.filter((entry) => entry !== listener));
  }
  dispatch(type, event = {}) {
    for (const listener of [...(this.listeners.get(type) || [])]) listener({ type, target: this, ...event });
  }
  matches(selector) {
    if (selector.startsWith('#')) return this.id === selector.slice(1);
    if (selector.startsWith('.')) {
      const required = selector.slice(1).split('.');
      const actual = this.className.split(/\s+/).filter(Boolean);
      return required.every((name) => actual.includes(name));
    }
    return false;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  querySelectorAll(selector) {
    const found = [];
    for (const child of this.children) {
      if (child.matches(selector)) found.push(child);
      found.push(...child.querySelectorAll(selector));
    }
    return found;
  }
}

export function makeGuard() {
  return {
    MAX_TITLE_CHARS: 80,
    normalizeId(value) {
      return typeof value === 'string' && /^[A-Za-z0-9_-]{1,120}$/.test(value) ? value : '';
    },
    sanitizeStoredValue(raw) {
      try {
        const value = JSON.parse(raw);
        return { value: Array.isArray(value) ? value : [] };
      } catch {
        return { value: [] };
      }
    },
    normalizeConversations(value) {
      return Array.isArray(value) ? value : [];
    }
  };
}

export function makeConversation() {
  return {
    id: 'conversation-source',
    title: 'Kaynak sohbet',
    agentId: 'minimal-engineer',
    toolsEnabled: false,
    createdAt: '2026-08-21T00:00:00.000Z',
    updatedAt: '2026-08-21T00:00:00.000Z',
    messages: [
      { id: 'user-1', role: 'user', content: 'Merhaba' },
      { id: 'assistant-1', role: 'assistant', content: 'Merhaba Ümit' }
    ]
  };
}

export function fixture({ throwOnObserve = false, throwOnButtonListener = false, existingMarker } = {}) {
  const head = new FakeElement('head');
  const body = new FakeElement('body');
  const messages = new FakeElement('section');
  messages.id = 'messages';
  body.append(messages);

  const article = new FakeElement('article');
  article.className = 'message assistant';
  article.dataset.messageId = 'assistant-1';
  if (existingMarker !== undefined) article.dataset.hafizeForkReady = existingMarker;
  const content = new FakeElement('div');
  content.className = 'content';
  article.append(content);
  messages.append(article);

  const send = new FakeElement('button');
  send.id = 'sendBtn';
  body.append(send);
  const input = new FakeElement('textarea');
  input.id = 'messageInput';
  body.append(input);

  const events = [];
  const documentRef = {
    head,
    body,
    createElement(tag) {
      const node = new FakeElement(tag);
      if (throwOnButtonListener && tag === 'button') {
        node.addEventListener = () => { throw new Error('listener failed'); };
      }
      return node;
    },
    querySelector(selector) {
      if (selector === '#messages') return messages;
      if (selector === '#sendBtn') return send;
      if (selector === '#messageInput') return input;
      if (selector.startsWith('#')) return [head, body, messages, send, input, article].find((node) => node.id === selector.slice(1)) || head.querySelector(selector) || body.querySelector(selector);
      return head.querySelector(selector) || body.querySelector(selector);
    },
    querySelectorAll(selector) { return [...head.querySelectorAll(selector), ...body.querySelectorAll(selector)]; },
    dispatchEvent(event) { events.push(event); return true; }
  };

  let observerInstance = null;
  class Observer {
    constructor(callback) { this.callback = callback; observerInstance = this; }
    observe() { if (throwOnObserve) throw new Error('observe failed'); this.observing = true; }
    disconnect() { this.disconnected = true; }
    fire() { this.callback(); }
  }

  class FakeCustomEvent {
    constructor(type, options) { this.type = type; this.detail = options?.detail; }
  }

  const source = makeConversation();
  const store = new Map([['hafize.conversations.v1', JSON.stringify([source])]]);
  let writes = 0;
  const storage = {
    getItem(key) { return store.has(key) ? store.get(key) : null; },
    setItem(key, value) { writes += 1; store.set(key, String(value)); }
  };
  let uuid = 0;
  const cryptoRef = { randomUUID: () => `00000000-0000-4000-8000-${String(++uuid).padStart(12, '0')}` };
  let reloads = 0;

  return {
    head, body, messages, article, content, send, input, documentRef, storage,
    guard: makeGuard(), MutationObserverImpl: Observer, CustomEventImpl: FakeCustomEvent,
    cryptoRef, events, store,
    now: () => new Date('2026-08-21T08:00:00.000Z'),
    reload: () => { reloads += 1; },
    getWrites: () => writes,
    getReloads: () => reloads,
    getObserver: () => observerInstance
  };
}

export function controllerOptions(f) {
  return {
    documentRef: f.documentRef,
    storage: f.storage,
    guard: f.guard,
    MutationObserverImpl: f.MutationObserverImpl,
    CustomEventImpl: f.CustomEventImpl,
    cryptoRef: f.cryptoRef,
    now: f.now,
    reload: f.reload
  };
}

export function forkButton(f) {
  const button = f.article.querySelector('.conversation-fork-btn');
  assert.ok(button, 'fork button exists');
  return button;
}
