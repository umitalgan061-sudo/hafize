import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../public/screen-analysis-ui.js');

function classList() {
  const values = new Set();
  return {
    add(...items) { items.forEach((item) => values.add(item)); },
    remove(...items) { items.forEach((item) => values.delete(item)); },
    contains(item) { return values.has(item); }
  };
}

function element(tag = 'div') {
  const listeners = new Map();
  const attributes = new Map();
  const children = [];
  return {
    tagName: tag.toUpperCase(),
    id: '',
    className: '',
    classList: classList(),
    textContent: '',
    value: '',
    hidden: false,
    disabled: false,
    dataset: {},
    style: {},
    children,
    parentNode: null,
    focusCount: 0,
    append(...nodes) {
      for (const node of nodes) {
        node.parentNode = this;
        children.push(node);
      }
    },
    appendChild(node) { this.append(node); return node; },
    remove() {
      if (!this.parentNode) return;
      const index = this.parentNode.children.indexOf(this);
      if (index >= 0) this.parentNode.children.splice(index, 1);
      this.parentNode = null;
    },
    addEventListener(type, fn) {
      const list = listeners.get(type) || [];
      list.push(fn);
      listeners.set(type, list);
    },
    removeEventListener(type, fn) {
      const list = listeners.get(type) || [];
      listeners.set(type, list.filter((item) => item !== fn));
    },
    async dispatch(type, event = {}) {
      for (const fn of [...(listeners.get(type) || [])]) await fn({ type, target: this, ...event });
    },
    setAttribute(name, value) { attributes.set(name, String(value)); },
    getAttribute(name) { return attributes.get(name) ?? null; },
    removeAttribute(name) { attributes.delete(name); },
    focus() { this.focusCount += 1; }
  };
}

const nodes = {
  '#screenShareAnalyze': element('button'),
  '#screenAnalysisResult': element('p'),
  '#screenShareStatus': element('span'),
  '#screenShareRemove': element('button'),
  '#modelSelect': element('select'),
  '#screenSharePreview': element('section'),
  '#messageInput': element('textarea')
};
nodes['#screenShareAnalyze'].textContent = 'Hafize ile analiz et';
nodes['#modelSelect'].value = 'nvidia/vision';
nodes['#messageInput'].value = 'BU SOHBET TASLAĞI GÖNDERİLMEMELİ';

const head = element('head');
const documentListeners = new Map();
const document = {
  head,
  createElement: element,
  querySelector(selector) {
    if (selector === 'link[data-hafize-screen-analysis-consent-style]') {
      return head.children.find((child) => child.getAttribute?.('data-hafize-screen-analysis-consent-style') === '1') || null;
    }
    return nodes[selector] || null;
  },
  addEventListener(type, fn) {
    const list = documentListeners.get(type) || [];
    list.push(fn);
    documentListeners.set(type, list);
  },
  removeEventListener(type, fn) {
    const list = documentListeners.get(type) || [];
    documentListeners.set(type, list.filter((item) => item !== fn));
  },
  async dispatch(type, event = {}) {
    for (const fn of [...(documentListeners.get(type) || [])]) await fn({ type, ...event });
  }
};

const rootListeners = new Map();
let calls = [];
const root = {
  document,
  HafizeScreenAnalysisClient: {
    async analyzeCapture(args) {
      calls.push(args);
      return { content: 'Analiz sonucu', model: args.model };
    }
  },
  CustomEvent: class { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } },
  addEventListener(type, fn) {
    const list = rootListeners.get(type) || [];
    list.push(fn);
    rootListeners.set(type, list);
  },
  removeEventListener(type, fn) {
    const list = rootListeners.get(type) || [];
    rootListeners.set(type, list.filter((item) => item !== fn));
  },
  async dispatch(type, detail) {
    for (const fn of [...(rootListeners.get(type) || [])]) await fn({ type, detail });
  }
};

const mounted = api.mountScreenAnalysisUi({ root });
assert.ok(mounted);
assert.equal(head.children.length, 1, 'consent stylesheet should be mounted once');
assert.equal(nodes['#screenSharePreview'].children.length, 1, 'dedicated consent section should be appended');

const consent = nodes['#screenSharePreview'].children[0];
const promptInput = consent.children.find((child) => child.id === 'screenAnalysisPrompt');
const review = consent.children.find((child) => child.className === 'screen-analysis-review');
assert.ok(promptInput);
assert.ok(review);
assert.equal(promptInput.value, '');
assert.equal(review.hidden, true);

const capture = { blob: new Blob(['jpeg'], { type: 'image/jpeg' }), width: 1280, height: 720 };
await root.dispatch('hafize:screen-capture-ready', { capture });
assert.equal(calls.length, 0);

await nodes['#screenShareAnalyze'].dispatch('click');
assert.equal(calls.length, 0, 'first click must only prepare review');
assert.equal(review.hidden, false);
assert.equal(nodes['#screenShareAnalyze'].textContent, 'Onayla ve gönder');
assert.equal(mounted.getReviewSnapshot().prompt, api.DEFAULT_PROMPT);
assert.notEqual(mounted.getReviewSnapshot().prompt, nodes['#messageInput'].value, 'composer draft must stay isolated');

promptInput.value = 'Yalnız hata mesajını açıkla.';
await promptInput.dispatch('input');
assert.equal(mounted.getReviewSnapshot(), null, 'prompt edit must invalidate prepared review');
assert.equal(review.hidden, true);
assert.equal(calls.length, 0);

await nodes['#screenShareAnalyze'].dispatch('click');
assert.equal(calls.length, 0);
assert.equal(mounted.getReviewSnapshot().prompt, 'Yalnız hata mesajını açıkla.');
nodes['#modelSelect'].value = 'nvidia/other';
await nodes['#modelSelect'].dispatch('change');
assert.equal(mounted.getReviewSnapshot(), null, 'model edit must invalidate prepared review');

nodes['#modelSelect'].value = 'local:qwen';
await nodes['#screenShareAnalyze'].dispatch('click');
assert.equal(calls.length, 0);
assert.match(nodes['#screenShareStatus'].textContent, /NVIDIA/);

nodes['#modelSelect'].value = 'nvidia/vision';
await nodes['#screenShareAnalyze'].dispatch('click');
assert.equal(calls.length, 0);
await nodes['#screenShareAnalyze'].dispatch('click');
assert.equal(calls.length, 1, 'second unchanged click must perform one analysis request');
assert.equal(calls[0].prompt, 'Yalnız hata mesajını açıkla.');
assert.equal(calls[0].model, 'nvidia/vision');
assert.equal(calls[0].capture, capture);
assert.equal(calls[0].explicitUserIntent, true);
assert.equal(nodes['#screenAnalysisResult'].textContent, 'Analiz sonucu');

await nodes['#screenShareAnalyze'].dispatch('click');
assert.equal(calls.length, 1, 'new review cycle first click must remain network-free');
let prevented = false;
await document.dispatch('keydown', { key: 'Escape', preventDefault() { prevented = true; } });
assert.equal(prevented, true);
assert.equal(mounted.getReviewSnapshot(), null);
assert.equal(calls.length, 1);

mounted.destroy();
assert.equal(nodes['#screenSharePreview'].children.includes(consent), false);
assert.equal(nodes['#screenShareAnalyze'].textContent, 'Hafize ile analiz et');

console.log('screen analysis consent lifecycle tests passed');