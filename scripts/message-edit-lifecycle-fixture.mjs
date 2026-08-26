import assert from 'node:assert/strict';

export class FakeClassList {
  constructor(...values) { this.values = new Set(values.filter(Boolean)); }
  contains(value) { return this.values.has(value); }
  add(value) { this.values.add(value); }
  remove(value) { this.values.delete(value); }
  replaceAll(value) { this.values = new Set(String(value || '').split(/\s+/).filter(Boolean)); }
  toString() { return [...this.values].join(' '); }
}

export class FakeElement {
  constructor(tag = 'div', classes = []) {
    this.tagName = tag.toUpperCase();
    this.classList = new FakeClassList(...classes);
    this.dataset = {};
    this.children = [];
    this.parentNode = null;
    this.listeners = new Map();
    this.attributes = new Map();
    this.textContent = '';
    this.value = '';
    this.disabled = false;
    this.id = '';
  }
  get className() { return this.classList.toString(); }
  set className(value) { this.classList.replaceAll(value); }
  append(...nodes) {
    for (const node of nodes) { node.parentNode = this; this.children.push(node); }
  }
  prepend(node) { node.parentNode = this; this.children.unshift(node); }
  remove() {
    if (!this.parentNode) return;
    this.parentNode.children = this.parentNode.children.filter((child) => child !== this);
    this.parentNode = null;
  }
  contains(node) {
    if (this.children.includes(node)) return true;
    return this.children.some((child) => child.contains?.(node));
  }
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }
  removeEventListener(type, listener) {
    const list = this.listeners.get(type) || [];
    this.listeners.set(type, list.filter((entry) => entry !== listener));
  }
  click() { for (const listener of [...(this.listeners.get('click') || [])]) listener({ type: 'click', isTrusted: true }); }
  focus() { this.focused = true; }
  setSelectionRange(start, end) { this.selection = [start, end]; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  querySelectorAll(selector) {
    const found = [];
    const matches = (node) => {
      if (selector === '.content') return node.classList?.contains('content');
      if (selector === '.message-copy-actions') return node.classList?.contains('message-copy-actions');
      if (selector === '.message-edit-btn') return node.classList?.contains('message-edit-btn');
      if (selector === '.message.user') return node.classList?.contains('message') && node.classList?.contains('user');
      if (selector === '.conversation-row') return node.classList?.contains('conversation-row');
      return false;
    };
    for (const child of this.children) {
      if (matches(child)) found.push(child);
      found.push(...child.querySelectorAll(selector));
    }
    return found;
  }
}

export class MemoryStorage {
  constructor(entries = {}) { this.map = new Map(Object.entries(entries)); this.writes = []; }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) { this.map.set(key, String(value)); this.writes.push([key, String(value)]); }
  removeItem(key) { this.map.delete(key); }
}

export class FakeObserver {
  static instances = [];
  constructor(callback) { this.callback = callback; this.observed = []; this.disconnected = false; FakeObserver.instances.push(this); }
  observe(target, options) { this.observed.push({ target, options }); }
  disconnect() { this.disconnected = true; }
  fire() { this.callback([], this); }
}

export function conversation(id = 'conversation-source') {
  return {
    id,
    title: 'Kaynak sohbet',
    agentId: 'minimal-engineer',
    toolsEnabled: false,
    createdAt: '2026-08-21T03:00:00.000Z',
    updatedAt: '2026-08-21T03:00:00.000Z',
    messages: [
      { id: 'msg-user-1', role: 'user', content: 'İlk soru' },
      { id: 'msg-assistant-1', role: 'assistant', content: 'İlk yanıt' },
      { id: 'msg-user-2', role: 'user', content: 'Düzenlenecek soru' },
      { id: 'msg-assistant-2', role: 'assistant', content: 'Son yanıt' }
    ]
  };
}

export function makeUserArticle(messageId = 'msg-user-2', text = 'Düzenlenecek soru') {
  const article = new FakeElement('article', ['message', 'user']);
  article.dataset.messageId = messageId;
  const content = new FakeElement('div', ['content']);
  content.textContent = text;
  const actions = new FakeElement('div', ['message-copy-actions']);
  article.append(content, actions);
  return { article, content, actions };
}

export function fixture({ articleCount = 1, canonical = [conversation()], markerValue, throwOnButtonListener = false } = {}) {
  FakeObserver.instances.length = 0;
  const messages = new FakeElement('section');
  messages.id = 'messages';
  const composerInput = new FakeElement('textarea');
  composerInput.id = 'messageInput';
  const send = new FakeElement('button');
  send.id = 'sendBtn';
  const list = new FakeElement('div');
  list.id = 'conversationList';
  const row = new FakeElement('button', ['conversation-row', 'active']);
  list.append(row);
  const articles = [];
  for (let index = 0; index < articleCount; index += 1) {
    const made = makeUserArticle(index ? `msg-user-extra/${index}` : 'msg-user-2', index ? `Ek soru ${index}` : 'Düzenlenecek soru');
    if (markerValue !== undefined && index === 0) made.article.dataset.hafizeEditReady = markerValue;
    messages.append(made.article);
    articles.push(made);
  }
  const events = [];
  const documentRef = {
    querySelector(selector) {
      if (selector === '#messages') return messages;
      if (selector === '#messageInput') return composerInput;
      if (selector === '#sendBtn') return send;
      return null;
    },
    querySelectorAll(selector) {
      if (selector === '#conversationList .conversation-row') return [row];
      return [];
    },
    createElement(tag) {
      const node = new FakeElement(tag);
      if (throwOnButtonListener) {
        const original = node.addEventListener.bind(node);
        node.addEventListener = (type, listener) => {
          if (type === 'click') throw new Error('listener install failed');
          return original(type, listener);
        };
      }
      return node;
    },
    dispatchEvent(event) { events.push(event); return true; }
  };
  const storage = new MemoryStorage({ 'hafize.conversations.v1': JSON.stringify(canonical) });
  const handoffStorage = new MemoryStorage();
  const guard = {
    MAX_TITLE_CHARS: 80,
    normalizeId(value) { return typeof value === 'string' && /^msg-[A-Za-z0-9-]+$/.test(value) ? value : ''; },
    sanitizeStoredValue(raw) {
      try { const value = JSON.parse(raw); return Array.isArray(value) ? { value } : null; } catch { return null; }
    },
    normalizeConversations(value) { return JSON.parse(JSON.stringify(value)); }
  };
  let id = 0;
  const cryptoRef = { randomUUID: () => `id-${++id}` };
  const reloads = [];
  class CustomEventImpl { constructor(type, options) { this.type = type; this.detail = options?.detail; } }
  class EventImpl { constructor(type, options) { this.type = type; this.bubbles = Boolean(options?.bubbles); } }
  return {
    messages, composerInput, send, list, row, articles, documentRef, storage, handoffStorage, guard,
    cryptoRef, reloads, events, CustomEventImpl, EventImpl,
    options: {
      documentRef, storage, handoffStorage, guard, MutationObserverImpl: FakeObserver,
      cryptoRef, CustomEventImpl, EventImpl,
      now: () => new Date('2026-08-21T03:10:00.000Z'),
      reload: () => reloads.push('reload')
    }
  };
}

export function editButton(article) { return article.querySelector('.message-edit-btn'); }

export function assertNoEditArtifacts(f) {
  for (const { article } of f.articles) {
    assert.equal(editButton(article), null);
    assert.notEqual(article.dataset.hafizeEditReady, '1');
  }
}
