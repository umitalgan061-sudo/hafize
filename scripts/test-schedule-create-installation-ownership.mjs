import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const createUi = require('../public/schedule-create.js');

class FakeOption {
  constructor(text, value, defaultSelected = false, selected = false) {
    this.textContent = text;
    this.value = value;
    this.defaultSelected = defaultSelected;
    this.selected = selected;
  }
}
const PreviousOption = globalThis.Option;
globalThis.Option = FakeOption;

class FakeElement {
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.attributes = new Map();
    this.listeners = new Map();
    this.className = '';
    this.dataset = {};
    this.textContent = '';
    this.hidden = false;
    this.disabled = false;
    this.value = '';
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
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
  addEventListener(name, listener) {
    if (!this.listeners.has(name)) this.listeners.set(name, []);
    this.listeners.get(name).push(listener);
  }
  removeEventListener(name, listener) {
    const entries = this.listeners.get(name) || [];
    this.listeners.set(name, entries.filter((candidate) => candidate !== listener));
  }
  listenerCount(name) { return (this.listeners.get(name) || []).length; }
  focus() {}
  matches(selector) {
    if (selector === '.schedule-list-head') return this.className === 'schedule-list-head';
    if (selector === '.schedule-create-panel') return this.className === 'schedule-create-panel';
    if (selector === '.schedule-create-open') return this.className.includes('schedule-create-open');
    if (selector === '.schedule-create-form') return this.className === 'schedule-create-form';
    if (selector === '.schedule-create-actions') return this.className === 'schedule-create-actions';
    return false;
  }
  findAll(selector) {
    const found = [];
    for (const child of this.children) {
      if (child.matches?.(selector)) found.push(child);
      found.push(...(child.findAll?.(selector) || []));
    }
    return found;
  }
  querySelector(selector) { return this.findAll(selector)[0] || null; }
  get options() { return this.tagName === 'SELECT' ? this.children : []; }
  replaceChildren(...nodes) {
    for (const child of this.children) child.parentNode = null;
    this.children = [];
    this.append(...nodes);
  }
}

function fixture() {
  const body = new FakeElement('body');
  const card = new FakeElement('section');
  const head = new FakeElement('div');
  head.className = 'schedule-list-head';
  card.append(head);
  body.append(card);
  const sourceAgent = new FakeElement('select');
  sourceAgent.value = 'minimal-engineer';
  sourceAgent.append(new FakeOption('Minimal Engineer', 'minimal-engineer'));
  const documentListeners = new Map();
  const documentRef = {
    body,
    createElement: (tagName) => new FakeElement(tagName),
    querySelector(selector) {
      if (selector === '#scheduleListCard') return card;
      if (selector === '#agentSelect') return sourceAgent;
      if (selector === '.schedule-create-panel') return card.querySelector(selector);
      return null;
    },
    addEventListener(name, listener) {
      if (!documentListeners.has(name)) documentListeners.set(name, []);
      documentListeners.get(name).push(listener);
    },
    removeEventListener(name, listener) {
      const entries = documentListeners.get(name) || [];
      documentListeners.set(name, entries.filter((candidate) => candidate !== listener));
    }
  };
  const root = { fetch: async () => ({ ok: true, status: 201, json: async () => ({ ok: true }) }) };
  return { body, card, head, sourceAgent, documentRef, documentListeners, root };
}

function mount(f) {
  return createUi.mount(f.documentRef, f.root, {
    fetchImpl: f.root.fetch,
    now: () => new Date('2030-01-01T00:00:00Z')
  });
}

try {
  {
    const f = fixture();
    const controller = mount(f);
    assert.ok(controller);
    const open = f.head.querySelector('.schedule-create-open');
    const panel = f.card.querySelector('.schedule-create-panel');
    const form = panel.querySelector('.schedule-create-form');
    assert.ok(open && panel && form, 'controller-created UI mounted');
    assert.equal(open.listenerCount('click'), 1);
    assert.equal(form.listenerCount('submit'), 1);
    assert.equal((f.documentListeners.get('keydown') || []).length, 1);
    assert.equal(mount(f), null, 'same head cannot have two active owners');

    assert.equal(controller.destroy(), true);
    assert.equal(controller.destroy(), false, 'destroy is idempotent');
    assert.equal(f.head.querySelector('.schedule-create-open'), null);
    assert.equal(f.card.querySelector('.schedule-create-panel'), null);
    assert.equal((f.documentListeners.get('keydown') || []).length, 0);

    const remounted = mount(f);
    assert.ok(remounted, 'destroy releases ownership for clean remount');
    remounted.destroy();
  }

  {
    const f = fixture();
    let createCount = 0;
    f.documentRef.createElement = (tagName) => {
      createCount += 1;
      if (createCount === 3) throw new Error('form construction failed');
      return new FakeElement(tagName);
    };
    assert.equal(mount(f), null, 'partial UI construction fails closed');
    assert.equal(f.head.querySelector('.schedule-create-open'), null, 'open button rolled back');
    assert.equal(f.card.querySelector('.schedule-create-panel'), null, 'partial panel not retained');
    f.documentRef.createElement = (tagName) => new FakeElement(tagName);
    const retry = mount(f);
    assert.ok(retry, 'construction failure releases ownership');
    retry.destroy();
  }

  {
    const f = fixture();
    const originalCreate = f.documentRef.createElement;
    let submitForm = null;
    f.documentRef.createElement = (tagName) => {
      const node = originalCreate(tagName);
      if (tagName === 'form') {
        submitForm = node;
        node.addEventListener = (name) => {
          if (name === 'submit') throw new Error('submit listener install failed');
        };
      }
      return node;
    };
    assert.equal(mount(f), null, 'listener installation failure fails closed');
    assert.ok(submitForm);
    assert.equal(f.head.querySelector('.schedule-create-open'), null);
    assert.equal(f.card.querySelector('.schedule-create-panel'), null);
    assert.equal((f.documentListeners.get('keydown') || []).length, 0);

    f.documentRef.createElement = originalCreate;
    const retry = mount(f);
    assert.ok(retry, 'listener failure releases ownership for retry');
    retry.destroy();
  }

  {
    const f = fixture();
    f.documentRef.addEventListener = () => { throw new Error('keydown install failed'); };
    assert.equal(mount(f), null, 'document listener failure rolls back mounted UI');
    assert.equal(f.head.querySelector('.schedule-create-open'), null);
    assert.equal(f.card.querySelector('.schedule-create-panel'), null);
    assert.equal((f.documentListeners.get('keydown') || []).length, 0);
  }

  console.log('schedule create installation ownership tests passed');
} finally {
  globalThis.Option = PreviousOption;
}
