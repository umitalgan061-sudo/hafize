import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  DEFAULT_PROMPT,
  mountScreenAnalysisUi
} = require('../public/screen-analysis-ui.js');

class FakeElement {
  constructor(tag = 'div', value = '') {
    this.tagName = tag.toUpperCase();
    this.value = value;
    this.textContent = '';
    this.hidden = true;
    this.disabled = false;
    this.dataset = {};
    this.children = [];
    this.listeners = new Map();
    this.attributes = new Map();
    this.removed = false;
    this.focused = false;
  }
  addEventListener(type, handler) {
    const list = this.listeners.get(type) || [];
    list.push(handler);
    this.listeners.set(type, list);
  }
  removeEventListener(type, handler) {
    const list = this.listeners.get(type) || [];
    this.listeners.set(type, list.filter((entry) => entry !== handler));
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  removeAttribute(name) { this.attributes.delete(name); }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  append(...children) { this.children.push(...children); }
  remove() { this.removed = true; }
  focus() { this.focused = true; }
  async emit(type, event = {}) {
    for (const handler of [...(this.listeners.get(type) || [])]) {
      await handler({ type, target: this, ...event });
    }
  }
  async click() { return this.emit('click'); }
}

function createHarness() {
  const analyzeButton = new FakeElement('button');
  analyzeButton.textContent = 'Hafize ile analiz et';
  const result = new FakeElement('p');
  const status = new FakeElement('span');
  const removeButton = new FakeElement('button');
  const modelSelect = new FakeElement('select', 'nvidia/vision-test');
  const previewPanel = new FakeElement('div');
  const head = new FakeElement('head');
  const elements = new Map([
    ['#screenShareAnalyze', analyzeButton],
    ['#screenAnalysisResult', result],
    ['#screenShareStatus', status],
    ['#screenShareRemove', removeButton],
    ['#modelSelect', modelSelect],
    ['#screenSharePreview', previewPanel]
  ]);
  const documentListeners = new Map();
  const rootListeners = new Map();
  const calls = [];
  const document = {
    head,
    querySelector(selector) {
      if (selector === 'link[data-hafize-screen-analysis-consent-style]') return null;
      return elements.get(selector) || null;
    },
    createElement(tag) { return new FakeElement(tag); },
    addEventListener(type, handler) {
      const list = documentListeners.get(type) || [];
      list.push(handler);
      documentListeners.set(type, list);
    },
    removeEventListener(type, handler) {
      const list = documentListeners.get(type) || [];
      documentListeners.set(type, list.filter((entry) => entry !== handler));
    }
  };
  const root = {
    document,
    addEventListener(type, handler) {
      const list = rootListeners.get(type) || [];
      list.push(handler);
      rootListeners.set(type, list);
    },
    removeEventListener(type, handler) {
      const list = rootListeners.get(type) || [];
      rootListeners.set(type, list.filter((entry) => entry !== handler));
    },
    HafizeScreenAnalysisClient: {
      async analyzeCapture(options) {
        calls.push(options);
        return { content: 'Bir hata bildirimi var.', model: options.model };
      }
    }
  };
  const emitRoot = async (type, event = {}) => {
    for (const handler of [...(rootListeners.get(type) || [])]) await handler(event);
  };
  return {
    root,
    calls,
    emitRoot,
    analyzeButton,
    result,
    status,
    removeButton,
    modelSelect,
    previewPanel,
    head,
    documentListeners,
    rootListeners
  };
}

const harness = createHarness();
const mounted = mountScreenAnalysisUi({ root: harness.root });
assert.ok(mounted);
assert.equal(harness.calls.length, 0);
assert.equal(harness.previewPanel.children.length, 1);
assert.equal(harness.head.children.length, 1);

await harness.analyzeButton.click();
assert.equal(harness.calls.length, 0);
assert.match(harness.status.textContent, /Önce paylaşılacak/);

const capture = { blob: new Blob(['jpeg'], { type: 'image/jpeg' }), width: 10, height: 10 };
await harness.emitRoot('hafize:screen-capture-ready', { detail: { capture } });
assert.equal(harness.calls.length, 0);

await harness.analyzeButton.click();
assert.equal(harness.calls.length, 0, 'first click must only prepare the explicit review');
assert.equal(harness.analyzeButton.dataset.stage, 'confirm');
assert.equal(harness.analyzeButton.textContent, 'Onayla ve gönder');
assert.match(harness.status.textContent, /Henüz hiçbir şey gönderilmedi/);

await harness.analyzeButton.click();
assert.equal(harness.calls.length, 1);
assert.equal(harness.calls[0].capture, capture);
assert.equal(harness.calls[0].model, 'nvidia/vision-test');
assert.equal(harness.calls[0].prompt, DEFAULT_PROMPT);
assert.equal(harness.calls[0].explicitUserIntent, true);
assert.ok(harness.calls[0].signal instanceof AbortSignal);
assert.equal(harness.result.textContent, 'Bir hata bildirimi var.');
assert.equal(harness.result.hidden, false);
assert.match(harness.status.textContent, /yalnız bu açık işlem için gönderildi/);
assert.equal(harness.analyzeButton.dataset.stage, 'review');

let aborted = false;
harness.root.HafizeScreenAnalysisClient.analyzeCapture = ({ signal }) => new Promise((resolve, reject) => {
  signal.addEventListener('abort', () => {
    aborted = true;
    const error = new Error('cancelled');
    error.name = 'AbortError';
    reject(error);
  }, { once: true });
});

await harness.analyzeButton.click();
const pending = harness.analyzeButton.click();
await harness.removeButton.click();
await pending;
assert.equal(aborted, true);
assert.equal(harness.result.hidden, true);
assert.equal(harness.analyzeButton.disabled, false);

await harness.emitRoot('hafize:screen-capture-cleared');
await harness.analyzeButton.click();
assert.match(harness.status.textContent, /Önce paylaşılacak/);

mounted.destroy();
assert.equal(harness.previewPanel.children[0].removed, true);
assert.equal((harness.rootListeners.get('hafize:screen-capture-ready') || []).length, 0);
assert.equal((harness.documentListeners.get('keydown') || []).length, 0);

console.log('screen analysis UI tests passed');
